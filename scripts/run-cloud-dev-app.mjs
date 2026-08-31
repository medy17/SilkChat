import path from "node:path"
import { pathToFileURL } from "node:url"
import dotenv from "dotenv"
import { createColors } from "picocolors"
import { LOCAL_IMAGE_OPTIMIZER_HEALTH_PATH } from "../src/lib/local-image-optimizer.ts"
import { addViteAllowedHost, getCloudDevTunnelConfig } from "./lib/cloud-dev-tunnel.mjs"

export const CLOUD_DEV_FAL_R2_WORKER = "silkchat-fal-r2-ingest-cloud-dev"

export const DEV_HOTKEYS = [
    { key: "b", action: "syncBackend", description: "Sync Backend" },
    { key: "f", action: "restartFrontend", description: "Restart Frontend" },
    { key: "i", action: "restartOptimizer", description: "Restart Optimiser" },
    { key: "c", action: "purgeOptimizerCache", description: "Bust Optimiser Cache" },
    { key: "t", action: "restartTunnel", description: "Restart Tunnel" },
    { key: "r", action: "restartServices", description: "Restart All" },
    { key: "q", action: "quit", description: "Quit" }
]

export const getHotkeyAction = (input) => {
    const key = input.toLowerCase()
    return DEV_HOTKEYS.find((hotkey) => hotkey.key === key)?.action ?? null
}

export const getHotkeyHelpLines = (columns = 80) => {
    const availableColumns = Math.max(24, columns)
    const items = DEV_HOTKEYS.map(({ key, description }) => `[${key}] ${description}`)
    const lines = []

    for (const item of items) {
        const currentLine = lines.at(-1)
        if (!currentLine || currentLine.length + item.length + 3 > availableColumns) {
            lines.push(item)
        } else {
            lines[lines.length - 1] = `${currentLine}   ${item}`
        }
    }

    return lines
}

export const waitForHttpReady = async (
    url,
    { timeoutMs = 10_000, intervalMs = 50, fetchImpl = fetch } = {}
) => {
    const deadline = performance.now() + timeoutMs
    let lastError

    while (performance.now() < deadline) {
        try {
            const response = await fetchImpl(url)
            if (response.ok) return
            lastError = new Error(`readiness endpoint returned ${response.status}`)
        } catch (error) {
            lastError = error
        }

        await new Promise((resolve) => setTimeout(resolve, intervalMs))
    }

    throw new Error(
        `Timed out waiting for ${url}${lastError instanceof Error ? `: ${lastError.message}` : ""}`
    )
}

const colourServiceTag = (service, level) => {
    const colours = createColors(true)
    const colourService =
        {
            frontend: colours.cyan,
            optimiser: colours.magenta,
            worker: colours.yellow,
            tunnel: colours.green,
            backend: colours.blue
        }[service] ?? colours.white
    const colourLevel =
        level === "error"
            ? colours.red
            : level === "warn"
              ? colours.yellow
              : level === "debug"
                ? colours.gray
                : null

    return `[${colourService(service)}${level && colourLevel ? `:${colourLevel(level)}` : ""}]`
}

export const formatServiceLogLine = (service, line, stream = "stdout", colour = false) => {
    let message = line.replace(/\r$/, "")
    let level = stream === "stderr" ? "error" : null

    if (service === "tunnel") {
        const cloudflaredLine = message.match(/^\S+\s+(INF|WRN|ERR|DBG)\s+(.*)$/)
        if (cloudflaredLine) {
            const [, cloudflaredLevel, cloudflaredMessage] = cloudflaredLine
            message = cloudflaredMessage
            level =
                cloudflaredLevel === "ERR"
                    ? "error"
                    : cloudflaredLevel === "WRN"
                      ? "warn"
                      : cloudflaredLevel === "DBG"
                        ? "debug"
                        : null
        }
    }

    message = message
        .replace(/^\[local-image-optimizer\]\s*/, "")
        .replace(/^\[cloud:dev:push\]\s*/, "")

    const levelSuffix = level ? `:${level}` : ""
    const tag = `[${service}${levelSuffix}]`
    return `${colour ? colourServiceTag(service, level) : tag}${message ? ` ${message}` : ""}`
}

export const createLineCollector = (onLine) => {
    let pending = ""
    const decoder = new TextDecoder()

    return {
        push(chunk) {
            pending += typeof chunk === "string" ? chunk : decoder.decode(chunk, { stream: true })
            const lines = pending.split(/\r?\n/)
            pending = lines.pop() ?? ""
            for (const line of lines) {
                onLine(line)
            }
        },
        flush() {
            pending += decoder.decode()
            if (!pending) return
            onLine(pending)
            pending = ""
        }
    }
}

export const stopChild = async (child, timeoutMs = 3000) => {
    if (child.exitCode !== null) return

    child.kill("SIGTERM")
    let timeout
    await Promise.race([
        child.exited,
        new Promise((resolve) => {
            timeout = setTimeout(() => {
                if (child.exitCode === null) child.kill("SIGKILL")
                resolve()
            }, timeoutMs)
        })
    ])
    clearTimeout(timeout)
}

const getRequiredEnv = (name) => {
    const value = process.env[name]?.trim()
    if (!value) {
        throw new Error(`Missing ${name}. Add it to envs/.env.cloud-dev.`)
    }
    return value
}

class TerminalDock {
    constructor(output, interactive) {
        this.output = output
        this.interactive = interactive
        this.renderedLineCount = 0
    }

    clear() {
        if (!this.interactive || this.renderedLineCount === 0) return
        this.output.write(`\u001B[${this.renderedLineCount}A\r\u001B[0J`)
        this.renderedLineCount = 0
    }

    render() {
        if (!this.interactive) return
        const lines = getHotkeyHelpLines(this.output.columns ?? 80)
        this.output.write(`\u001B[2m${lines.join("\n")}\u001B[22m\n`)
        this.renderedLineCount = lines.length
    }

    log(message) {
        this.clear()
        this.output.write(`${message}\n`)
        this.render()
    }

    refresh() {
        this.clear()
        this.render()
    }

    close() {
        this.clear()
        this.interactive = false
    }
}

export const runCloudDevApp = () => {
    dotenv.config({
        path: [
            path.resolve(process.cwd(), "envs", ".env.cloud-dev"),
            path.resolve(process.cwd(), "envs", ".env.local")
        ],
        override: false,
        quiet: true
    })

    const localImageOptimizerPort = process.env.LOCAL_IMAGE_OPTIMIZER_PORT || "43177"
    const viteCliPath = path.resolve(process.cwd(), "node_modules", "vite", "bin", "vite.js")
    const backendSyncPath = path.resolve(process.cwd(), "scripts", "push-cloud-dev.mjs")
    const tunnelConfig = getCloudDevTunnelConfig(process.env)
    const childBaseEnv = Object.fromEntries(
        Object.entries(process.env).filter(
            ([name]) => name !== "CLOUDFLARE_TUNNEL_TOKEN" && name !== "TUNNEL_TOKEN"
        )
    )

    const viteEnv = {
        ...childBaseEnv,
        VITE_CONVEX_URL: getRequiredEnv("CLOUD_DEV_CONVEX_URL"),
        VITE_CONVEX_API_URL: getRequiredEnv("CLOUD_DEV_CONVEX_API_URL"),
        VITE_CONVEX_SITE_URL: getRequiredEnv("CLOUD_DEV_CONVEX_SITE_URL"),
        VITE_LOCAL_IMAGE_OPTIMIZER_ENABLED: "1",
        LOCAL_IMAGE_OPTIMIZER_PORT: localImageOptimizerPort,
        ...(tunnelConfig
            ? {
                  __VITE_ADDITIONAL_SERVER_ALLOWED_HOSTS: addViteAllowedHost(
                      childBaseEnv,
                      tunnelConfig.hostname
                  )
              }
            : {})
    }

    const interactive = Boolean(process.stdin.isTTY && process.stdout.isTTY)
    const dock = new TerminalDock(process.stdout, interactive)
    const services = new Map()
    const children = new Set()
    let shuttingDown = false
    let backendSyncRunning = false

    const writeServiceLine = (service, stream, line) => {
        dock.log(formatServiceLogLine(service, line, stream, interactive))
    }

    const attachOutput = (child, service) => {
        for (const stream of ["stdout", "stderr"]) {
            const output = child[stream]
            if (!output || typeof output.getReader !== "function") continue
            const collector = createLineCollector((line) => writeServiceLine(service, stream, line))
            void (async () => {
                const reader = output.getReader()
                for (;;) {
                    const { value, done } = await reader.read()
                    if (done) break
                    collector.push(value)
                }
                collector.flush()
            })()
        }
    }

    const serviceDefinitions = {
        worker: {
            command: "bunx",
            args: ["wrangler", "tail", CLOUD_DEV_FAL_R2_WORKER],
            env: childBaseEnv
        },
        optimiser: {
            command: "bun",
            args: ["scripts/local-image-optimizer.ts"],
            env: viteEnv
        },
        frontend: {
            command: "bun",
            args: [viteCliPath, "dev", "--port", "3000", ...process.argv.slice(2)],
            env: viteEnv
        },
        ...(tunnelConfig
            ? {
                  tunnel: {
                      command: "cloudflared",
                      args: ["tunnel", "--no-autoupdate", "run"],
                      env: {
                          ...childBaseEnv,
                          TUNNEL_TOKEN: tunnelConfig.token
                      }
                  }
              }
            : {})
    }

    const startService = (service) => {
        if (shuttingDown || services.has(service)) return
        const definition = serviceDefinitions[service]
        if (!definition) {
            dock.log(
                `[runner] ${service === "tunnel" ? "Tunnel is not configured." : `Unknown service: ${service}`}`
            )
            return
        }

        let child
        try {
            child = Bun.spawn([definition.command, ...definition.args], {
                stdin: "ignore",
                stdout: "pipe",
                stderr: "pipe",
                env: definition.env,
                onExit(exitedChild, code, signalCode, error) {
                    children.delete(exitedChild)
                    if (services.get(service) !== exitedChild) return
                    services.delete(service)
                    if (shuttingDown) return
                    if (error) {
                        dock.log(`[runner:error] ${service} stopped: ${error.message}`)
                        return
                    }
                    const prefix = code === 0 && !signalCode ? "[runner]" : "[runner:error]"
                    dock.log(
                        `${prefix} ${service} stopped${signalCode ? ` (${signalCode})` : code === 0 ? "" : ` with code ${code ?? 1}`}.`
                    )
                }
            })
        } catch (error) {
            dock.log(`[runner:error] ${service} could not start: ${error.message}`)
            return
        }
        services.set(service, child)
        children.add(child)
        attachOutput(child, service)

        dock.log(`[runner] ${service} started.`)
    }

    const restartService = async (service) => {
        const child = services.get(service)
        if (child) {
            services.delete(service)
            dock.log(`[runner] Restarting ${service}.`)
            await stopChild(child)
        }
        startService(service)
    }

    const restartServices = async () => {
        await Promise.all(Object.keys(serviceDefinitions).map((service) => restartService(service)))
    }

    const syncBackend = () => {
        if (backendSyncRunning) {
            dock.log("[runner] Backend sync is already running.")
            return
        }

        backendSyncRunning = true
        let child
        try {
            child = Bun.spawn(["bun", backendSyncPath], {
                stdin: "ignore",
                stdout: "pipe",
                stderr: "pipe",
                env: process.env,
                onExit(exitedChild, code, _signalCode, error) {
                    children.delete(exitedChild)
                    backendSyncRunning = false
                    if (shuttingDown) return
                    if (error) {
                        dock.log(`[runner:error] Backend sync failed: ${error.message}`)
                        return
                    }
                    dock.log(
                        code === 0
                            ? "[runner] Backend sync complete."
                            : `[runner:error] Backend sync exited with code ${code ?? 1}.`
                    )
                }
            })
        } catch (error) {
            backendSyncRunning = false
            dock.log(`[runner:error] Backend sync failed to start: ${error.message}`)
            return
        }
        children.add(child)
        attachOutput(child, "backend")
        dock.log("[runner] Syncing backend.")
    }

    const purgeOptimizerCache = async () => {
        try {
            const response = await fetch(
                `http://127.0.0.1:${localImageOptimizerPort}/_silkchat/image/__cache`,
                { method: "DELETE" }
            )
            if (!response.ok) {
                throw new Error(`optimizer returned ${response.status}`)
            }
            const result = await response.json()
            const removed = typeof result.removed === "number" ? result.removed : 0
            dock.log(`[runner] Optimiser cache cleared (${removed} removed).`)
        } catch (error) {
            dock.log(`[runner:error] Optimiser cache purge failed: ${error.message}`)
        }
    }

    const shutdown = async (exitCode = 0) => {
        if (shuttingDown) return
        shuttingDown = true
        dock.close()
        if (interactive && process.stdin.isRaw) {
            process.stdin.setRawMode(false)
        }
        process.stdin.pause()

        await Promise.all([...children].map((child) => stopChild(child)))
        process.exit(exitCode)
    }

    const actions = {
        syncBackend,
        restartFrontend: () => restartService("frontend"),
        restartOptimizer: () => restartService("optimiser"),
        purgeOptimizerCache,
        restartTunnel: () => restartService("tunnel"),
        restartServices,
        quit: () => shutdown(0)
    }

    process.on("SIGINT", () => shutdown(0))
    process.on("SIGTERM", () => shutdown(0))

    for (const service of Object.keys(serviceDefinitions)) {
        if (service !== "frontend") startService(service)
    }

    void (async () => {
        const optimizerHealthUrl = `http://127.0.0.1:${localImageOptimizerPort}${LOCAL_IMAGE_OPTIMIZER_HEALTH_PATH}`
        try {
            await waitForHttpReady(optimizerHealthUrl)
            dock.log("[runner] optimiser ready.")
        } catch (error) {
            dock.log(`[runner:error] ${error.message}`)
        }
        startService("frontend")
    })()

    if (tunnelConfig) {
        dock.log(`[runner] Public URL: ${tunnelConfig.publicUrl}`)
    }

    if (interactive) {
        process.stdin.setRawMode(true)
        process.stdin.setEncoding("utf8")
        process.stdin.resume()
        process.stdin.on("data", (input) => {
            for (const key of input) {
                if (key === "\u0003") {
                    void shutdown(0)
                    continue
                }
                const action = getHotkeyAction(key)
                if (action) {
                    void actions[action]()
                }
            }
        })
        process.stdout.on("resize", () => dock.refresh())
        dock.refresh()
    } else {
        console.log("[runner] Hotkeys are available in an interactive terminal.")
    }
}

const entrypoint = process.argv[1]
if (entrypoint && pathToFileURL(path.resolve(entrypoint)).href === import.meta.url) {
    runCloudDevApp()
}
