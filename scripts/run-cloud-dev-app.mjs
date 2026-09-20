import path from "node:path"
import { pathToFileURL } from "node:url"
import dotenv from "dotenv"
import { LOCAL_IMAGE_OPTIMIZER_HEALTH_PATH } from "../src/lib/local-image-optimizer.ts"
import { addViteAllowedHost, getCloudDevTunnelConfig } from "./lib/cloud-dev-tunnel.mjs"

import {
    TerminalDock,
    createRunnerProcesses,
    createBackendSync,
    installRunnerControls,
    waitForHttpReady
} from "./lib/runner-utils.mjs"

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

const getRequiredEnv = (name) => {
    const value = process.env[name]?.trim()
    if (!value) {
        throw new Error(`Missing ${name}. Add it to envs/.env.cloud-dev.`)
    }
    return value
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
    const dock = new TerminalDock(process.stdout, interactive, DEV_HOTKEYS)
    const processes = createRunnerProcesses({
        log: (message) => dock.log(message),
        colour: interactive
    })

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

    const serviceArgs = (service) => {
        const definition = serviceDefinitions[service]
        if (!definition) {
            dock.log(
                `[runner] ${service === "tunnel" ? "Tunnel is not configured." : `Unknown service: ${service}`}`
            )
            return null
        }
        return [
            service,
            [definition.command, ...definition.args],
            definition.env,
            (code, signal) => {
                const prefix = code === 0 && !signal ? "[runner]" : "[runner:error]"
                dock.log(
                    `${prefix} ${service} stopped${signal ? ` (${signal})` : code === 0 ? "" : ` with code ${code ?? 1}`}.`
                )
            }
        ]
    }
    const startService = (service) => {
        const args = serviceArgs(service)
        if (!args) return
        try {
            if (processes.start(...args)) dock.log(`[runner] ${service} started.`)
        } catch (error) {
            dock.log(`[runner:error] ${service} could not start: ${error.message}`)
        }
    }
    const restartService = async (service) => {
        const args = serviceArgs(service)
        if (args) await processes.restart(...args)
    }
    const syncBackend = createBackendSync(processes, (message) => dock.log(message), "runner")

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

    installRunnerControls({
        dock,
        processes,
        interactive,
        hotkeys: DEV_HOTKEYS,
        prefix: "runner",
        signalCodes: { SIGINT: 0, SIGTERM: 0 },
        actions: {
            syncBackend,
            restartFrontend: () => restartService("frontend"),
            restartOptimizer: () => restartService("optimiser"),
            purgeOptimizerCache,
            restartTunnel: () => restartService("tunnel"),
            restartServices: () => Promise.all(Object.keys(serviceDefinitions).map(restartService))
        }
    })

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
}

const entrypoint = process.argv[1]
if (entrypoint && pathToFileURL(path.resolve(entrypoint)).href === import.meta.url) {
    runCloudDevApp()
}
