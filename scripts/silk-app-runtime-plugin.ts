// Wires the SilkChat app runtime (scripts/build-silk-app-runtime.mjs) into Vite. The dev
// server builds it on start and again whenever one of its source files changes; a
// production build uses the hashed build `prebuild` made. Either way the host learns the
// runtime's version through __SILK_APP_RUNTIME_VERSION__.

import { spawn } from "node:child_process"
import { readFileSync, readdirSync } from "node:fs"
import path from "node:path"
import type { Plugin } from "vite"

const BUILD_SCRIPT = "scripts/build-silk-app-runtime.mjs"
const OUT_DIR = "public/silk-app"
const INPUTS_FILE = "node_modules/.cache/silk-app/inputs.json"
const DEV_VERSION = "dev"
const REBUILD_DELAY_MS = 100

const normalize = (file: string) => {
    const resolved = path.resolve(file)
    return process.platform === "win32" ? resolved.toLowerCase() : resolved
}

const readInputs = (root: string) => {
    try {
        const inputs: string[] = JSON.parse(readFileSync(path.join(root, INPUTS_FILE), "utf8"))
        return new Set(inputs.map(normalize))
    } catch {
        return new Set<string>()
    }
}

// The build writes a single directory, named for its version.
const readBuiltVersion = (root: string) => {
    let entries: string[] = []
    try {
        entries = readdirSync(path.join(root, OUT_DIR))
    } catch {}
    const version = entries.find((entry) => entry !== DEV_VERSION)
    if (!version) {
        throw new Error(
            `No SilkChat app runtime build in ${OUT_DIR}. Run \`bun run silk-app:build\` first.`
        )
    }
    return version
}

const runDevBuild = (root: string) =>
    new Promise<string>((resolve, reject) => {
        const child = spawn("bun", [BUILD_SCRIPT, "--dev"], {
            cwd: root,
            stdio: ["ignore", "pipe", "pipe"]
        })
        let output = ""
        child.stdout.on("data", (chunk) => {
            output += chunk
        })
        child.stderr.on("data", (chunk) => {
            output += chunk
        })
        child.on("error", reject)
        child.on("close", (code) =>
            code === 0
                ? resolve(output.trim())
                : reject(new Error(output.trim() || `Exited with code ${code}`))
        )
    })

export const silkAppRuntime = (): Plugin => {
    let root = process.cwd()

    return {
        name: "silk-app-runtime",
        config(config, { command }) {
            if (config.root) root = path.resolve(config.root)
            const version = command === "serve" ? DEV_VERSION : readBuiltVersion(root)
            return { define: { __SILK_APP_RUNTIME_VERSION__: JSON.stringify(version) } }
        },
        async configureServer(server) {
            const { logger } = server.config
            let inputs = new Set<string>()
            let running = false
            let queued = false
            let timer: ReturnType<typeof setTimeout> | undefined

            const build = async () => {
                if (running) {
                    queued = true
                    return
                }
                running = true
                try {
                    logger.info(await runDevBuild(root), { timestamp: true })
                } catch (error) {
                    logger.error(
                        `[silk-app-runtime] ${error instanceof Error ? error.message : String(error)}`,
                        { timestamp: true }
                    )
                }
                inputs = readInputs(root)
                running = false
                if (queued) {
                    queued = false
                    await build()
                }
            }

            await build()
            server.watcher.on("change", (file) => {
                if (!inputs.has(normalize(file))) return
                clearTimeout(timer)
                timer = setTimeout(() => void build(), REBUILD_DELAY_MS)
            })
        }
    }
}
