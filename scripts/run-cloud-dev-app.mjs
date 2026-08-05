import { spawn } from "node:child_process"
import path from "node:path"
import { pathToFileURL } from "node:url"
import dotenv from "dotenv"
import { addViteAllowedHost, getCloudDevTunnelConfig } from "./lib/cloud-dev-tunnel.mjs"

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

export const formatServiceLogLine = (service, line, stream = "stdout") => {
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
    return `[${service}${levelSuffix}]${message ? ` ${message}` : ""}`
}

export const createLineCollector = (onLine) => {
    let pending = ""

    return {
        push(chunk) {
            pending += chunk.toString()
            const lines = pending.split(/\r?\n/)
            pending = lines.pop() ?? ""
            for (const line of lines) {
                onLine(line)
            }
        },
        flush() {
            if (!pending) return
            onLine(pending)
            pending = ""
        }
    }
}

export const stopChild = (child, timeoutMs = 3000) =>
    new Promise((resolve) => {
        if (child.exitCode !== null || child.signalCode !== null) {
            resolve()
            return
        }

        let settled = false
        const finish = () => {
            if (settled) return
            settled = true
            clearTimeout(timeout)
            child.removeListener("exit", finish)
            child.removeListener("error", finish)
            resolve()
        }

        child.once("exit", finish)
        child.once("error", finish)
        const timeout = setTimeout(() => {
            if (child.exitCode === null && child.signalCode === null) {
                child.kill("SIGKILL")
            }
            finish()
        }, timeoutMs)

        if (!child.kill("SIGTERM")) {
            finish()
        }
    })

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
    const tsxCliPath = path.resolve(process.cwd(), "node_modules", "tsx", "dist", "cli.mjs")
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
        dock.log(formatServiceLogLine(service, line, stream))
    }

    const attachOutput = (child, service) => {
        for (const stream of ["stdout", "stderr"]) {
            const output = child[stream]
            if (!output) continue
            const collector = createLineCollector((line) => writeServiceLine(service, stream, line))
            output.on("data", (chunk) => collector.push(chunk))
            output.on("end", () => collector.flush())
        }
    }

    const serviceDefinitions = {
        optimiser: {
            command: process.execPath,
            args: [tsxCliPath, "scripts/local-image-optimizer.ts"],
            env: viteEnv
        },
        frontend: {
            command: process.execPath,
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

        const child = spawn(definition.command, definition.args, {
            stdio: ["ignore", "pipe", "pipe"],
            env: definition.env
        })
        services.set(service, child)
        children.add(child)
        attachOutput(child, service)

        child.once("error", (error) => {
            if (services.get(service) === child) {
                services.delete(service)
            }
            dock.log(`[runner:error] ${service} could not start: ${error.message}`)
        })

        child.once("exit", (code, signal) => {
            children.delete(child)
            if (services.get(service) !== child) return
            services.delete(service)
            if (!shuttingDown) {
                const prefix = code === 0 && !signal ? "[runner]" : "[runner:error]"
                dock.log(
                    `${prefix} ${service} stopped${signal ? ` (${signal})` : code === 0 ? "" : ` with code ${code ?? 1}`}.`
                )
            }
        })

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
        const child = spawn(process.execPath, [backendSyncPath], {
            stdio: ["ignore", "pipe", "pipe"],
            env: process.env
        })
        children.add(child)
        attachOutput(child, "backend")
        dock.log("[runner] Syncing backend.")

        child.once("error", (error) => {
            dock.log(`[runner:error] Backend sync failed to start: ${error.message}`)
        })
        child.once("exit", (code) => {
            children.delete(child)
            backendSyncRunning = false
            if (!shuttingDown) {
                dock.log(
                    code === 0
                        ? "[runner] Backend sync complete."
                        : `[runner:error] Backend sync exited with code ${code ?? 1}.`
                )
            }
        })
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
        startService(service)
    }

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
