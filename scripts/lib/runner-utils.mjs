import { stripVTControlCharacters } from "node:util"
import { createColors } from "picocolors"

export const getHotkeyAction = (input, hotkeys) => {
    const key = input.toLowerCase()
    return hotkeys.find((hotkey) => hotkey.key === key)?.action ?? null
}

export const getHotkeyHelpLines = (columns, hotkeys) => {
    const availableColumns = Math.max(24, columns)
    const items = hotkeys.map(({ key, description }) => `[${key}] ${description}`)
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

export const formatServiceLogLine = (service, line, colour = false) => {
    let message = line.replace(/\r$/, "")
    message = message
        .replace(/^\[local-image-optimizer\]\s*/, "")
        .replace(/^\[cloud:dev:push\]\s*/, "")

    // stderr is a transport, not a severity: Bun, Vite, Convex, and other CLIs
    // use it for normal progress too. Failures are also reported from exit codes.
    const diagnostic = stripVTControlCharacters(message).trimStart()
    let level = null
    if (/^\$\s/.test(diagnostic)) {
        level = null
    } else if (/^(?:\[warn(?:ing)?\]|warn(?:ing)?\b|▲\s*\[WARNING\])/i.test(diagnostic)) {
        level = "warn"
    } else if (
        /^(?:\[error\]|error\b|\w*Error:|Unhandled\b.*(?:error|failure)|✘\s*\[ERROR\]|at\s)/i.test(
            diagnostic
        )
    ) {
        level = "error"
    }

    if (service === "tunnel") {
        const cloudflaredLine = diagnostic.match(/^\S+\s+(INF|WRN|ERR|DBG)\s+(.*)$/)
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

export class TerminalDock {
    constructor(output, interactive, hotkeys) {
        this.hotkeys = hotkeys
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
        const lines = getHotkeyHelpLines(this.output.columns ?? 80, this.hotkeys)
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

// Both entrypoints own their commands; this helper only owns process lifetimes and output.
export const createRunnerProcesses = ({
    log,
    colour = false,
    spawn = (command, options) => Bun.spawn(command, options)
}) => {
    const services = new Map()
    const children = new Set()
    const restarting = new Set()
    let stopping = false

    const start = (service, command, env = process.env, onExit) => {
        if (stopping) return null
        if (services.has(service)) return services.get(service)
        const child = spawn(command, { env, stdin: "ignore", stdout: "pipe", stderr: "pipe" })
        const outputDone = Promise.all(
            [child.stdout, child.stderr].map(async (output) => {
                const collector = createLineCollector((line) =>
                    log(formatServiceLogLine(service, line, colour))
                )
                const reader = output.getReader()
                try {
                    for (;;) {
                        const { value, done } = await reader.read()
                        if (done) break
                        collector.push(value)
                    }
                    collector.flush()
                } finally {
                    reader.releaseLock()
                }
            })
        ).catch((error) => log(`[runner:error] ${service} output failed: ${error.message}`))
        const handle = { child, done: null }
        services.set(service, handle)
        children.add(handle)
        handle.done = (async () => {
            const code = await child.exited
            await outputDone
            children.delete(handle)
            if (services.get(service) === handle) {
                services.delete(service)
                if (!stopping) onExit?.(code, child.signalCode)
            }
            return code
        })()
        return handle
    }
    const stop = async (service) => {
        const handle = services.get(service)
        if (!handle) return
        services.delete(service)
        await stopChild(handle.child)
    }
    return {
        start,
        stop,
        isStopping: () => stopping,
        async restart(service, command, env, onExit) {
            if (stopping || restarting.has(service)) return
            restarting.add(service)
            try {
                await stop(service)
                return start(service, command, env, onExit)
            } finally {
                restarting.delete(service)
            }
        },
        async stopAll() {
            stopping = true
            services.clear()
            await Promise.all([...children].map(({ child }) => stopChild(child)))
        }
    }
}

export const createBackendSync = (processes, log, prefix) => {
    let syncing = false
    return async () => {
        if (processes.isStopping()) return
        if (syncing) {
            log(`[${prefix}] Backend sync is already running.`)
            return
        }
        syncing = true
        try {
            log(`[${prefix}] Syncing backend.`)
            const handle = processes.start(
                "backend",
                ["bun", "scripts/push-cloud-dev.mjs"],
                process.env
            )
            if (!handle) return
            const code = await handle.done
            if (processes.isStopping()) return
            log(
                code === 0
                    ? `[${prefix}] Backend sync complete.`
                    : `[${prefix}:error] Backend sync exited with code ${code}.`
            )
        } catch (error) {
            if (!processes.isStopping())
                log(`[${prefix}:error] Backend sync failed: ${error.message}`)
        } finally {
            syncing = false
        }
    }
}

export const installRunnerControls = ({
    dock,
    processes,
    interactive,
    hotkeys,
    actions,
    prefix,
    showHelp = true,
    signalCodes = { SIGINT: 130, SIGTERM: 143 },
    input = process.stdin,
    output = process.stdout,
    signals = process,
    exit = (code) => process.exit(code)
}) => {
    let shuttingDown = false
    const wasRaw = input.isRaw ?? false
    const shutdown = async (code = 0) => {
        if (shuttingDown) return
        shuttingDown = true
        signals.removeListener("SIGINT", onInterrupt)
        signals.removeListener("SIGTERM", onTerminate)
        input.removeListener("data", onData)
        output.removeListener("resize", onResize)
        dock.close()
        if (interactive) input.setRawMode(wasRaw)
        input.pause()
        await processes.stopAll()
        exit(code)
    }
    const onInterrupt = () => void shutdown(signalCodes.SIGINT)
    const onTerminate = () => void shutdown(signalCodes.SIGTERM)
    const onResize = () => dock.refresh()
    const onData = (input) => {
        for (const key of input) {
            if (shuttingDown) break
            const action = key === "\u0003" ? "quit" : getHotkeyAction(key, hotkeys)
            if (action === "quit") void shutdown(0)
            else if (action && actions[action])
                void Promise.resolve()
                    .then(() => {
                        if (!shuttingDown) return actions[action]()
                    })
                    .catch((error) => dock.log(`[${prefix}:error] ${error.message}`))
        }
    }
    signals.on("SIGINT", onInterrupt)
    signals.on("SIGTERM", onTerminate)
    if (interactive) {
        input.setRawMode(true)
        input.setEncoding("utf8")
        input.resume()
        input.on("data", onData)
        output.on("resize", onResize)
        dock.refresh()
    } else if (showHelp) dock.log(`[${prefix}] Hotkeys are available in an interactive terminal.`)
    return shutdown
}
