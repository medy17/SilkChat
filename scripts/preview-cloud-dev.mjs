import path from "node:path"
import { pathToFileURL } from "node:url"
import dotenv from "dotenv"
import { getCloudDevTunnelConfig } from "./lib/cloud-dev-tunnel.mjs"
import {
    TerminalDock,
    createRunnerProcesses,
    createBackendSync,
    installRunnerControls
} from "./lib/runner-utils.mjs"

export const getBundledCloudDevEnv = (env) => {
    const result = { ...env }
    for (const name of ["CONVEX_URL", "CONVEX_API_URL", "CONVEX_SITE_URL"]) {
        const value = env[`CLOUD_DEV_${name}`]?.trim()
        if (!value) {
            throw new Error(`Missing CLOUD_DEV_${name}. Add it to envs/.env.cloud-dev.`)
        }
        // Always target cloud dev, even if the shell contains production Vite values.
        result[`VITE_${name}`] = value
    }

    delete result.CLOUDFLARE_TUNNEL_TOKEN
    delete result.TUNNEL_TOKEN
    return {
        ...result,
        NODE_ENV: "production",
        NITRO_PRESET: "node-server",
        // Keep the usual dev origin for auth cookies and tunnel routing.
        PORT: "3000",
        NITRO_PORT: "3000",
        HOST: "0.0.0.0",
        NITRO_HOST: "0.0.0.0",
        VITE_LOCAL_IMAGE_OPTIMIZER_ENABLED: "0",
        // Local previews must not upload source maps to PostHog.
        POSTHOG_API_KEY: ""
    }
}

export const BUNDLED_HOTKEYS = [
    { key: "b", action: "syncBackend", description: "Sync Backend" },
    { key: "f", action: "rebuildFrontend", description: "Rebuild Frontend" },
    { key: "t", action: "restartTunnel", description: "Restart Tunnel" },
    { key: "r", action: "restartAll", description: "Rebuild & Restart All" },
    { key: "q", action: "quit", description: "Quit" }
]

// A build replaces .output, so stop the old server first and serialize rebuilds.
export const createBundledRebuilder = ({
    stopFrontend,
    build,
    startFrontend,
    restartTunnel,
    isStopping,
    log
}) => {
    let rebuilding = false
    return async (restartAll = false) => {
        if (rebuilding || isStopping()) {
            if (rebuilding) log("[bundled] A rebuild is already running.")
            return false
        }
        rebuilding = true
        try {
            await stopFrontend()
            if (isStopping()) return false
            await build()
            if (isStopping()) return false
            if (restartAll) await restartTunnel()
            if (isStopping()) return false
            await startFrontend()
            return true
        } catch (error) {
            log(`[bundled:error] ${error.message}. Press f to retry.`)
            return false
        } finally {
            rebuilding = false
        }
    }
}

export const previewCloudDev = async ({ buildOnly = false } = {}) => {
    dotenv.config({
        path: [path.resolve("envs/.env.cloud-dev"), path.resolve("envs/.env.local")],
        override: false,
        quiet: true
    })
    const env = getBundledCloudDevEnv(process.env)
    const tunnel = buildOnly ? null : getCloudDevTunnelConfig(process.env)
    const interactive = !buildOnly && Boolean(process.stdin.isTTY && process.stdout.isTTY)
    const dock = new TerminalDock(process.stdout, interactive, BUNDLED_HOTKEYS)
    const processes = createRunnerProcesses({
        log: (message) => dock.log(message),
        colour: interactive
    })
    const stoppedUnexpectedly = (service, code) => {
        dock.log(`[bundled:error] ${service} stopped with code ${code}.`)
        if (!interactive) void shutdown(code || 1)
    }
    const frontendArgs = [
        "frontend",
        ["bun", ".output/server/index.mjs"],
        env,
        (code) => stoppedUnexpectedly("Frontend", code)
    ]
    const tunnelArgs = tunnel
        ? [
              "tunnel",
              ["cloudflared", "tunnel", "--no-autoupdate", "run"],
              { ...env, TUNNEL_TOKEN: tunnel.token },
              (code) => stoppedUnexpectedly("Tunnel", code)
          ]
        : null
    const startTunnel = () => {
        if (tunnelArgs) processes.start(...tunnelArgs)
    }
    const restartTunnel = async () => {
        if (tunnelArgs) await processes.restart(...tunnelArgs)
        else dock.log("[bundled] Tunnel is not configured.")
    }

    const rebuild = createBundledRebuilder({
        log: (message) => dock.log(message),
        isStopping: processes.isStopping,
        stopFrontend: () => processes.stop("frontend"),
        build: async () => {
            dock.log("[bundled] Building production assets against cloud dev.")
            const handle = processes.start("build", ["bun", "run", "build"], env)
            if (!handle) return
            const code = await handle.done
            if (code !== 0) throw new Error(`Build exited with code ${code}`)
        },
        restartTunnel,
        startFrontend: () => {
            if (buildOnly) return
            processes.start(...frontendArgs)
            startTunnel()
            dock.log(`[bundled] Preview: ${tunnel?.publicUrl ?? "http://localhost:3000"}`)
            dock.log("[bundled] Build complete. Reload the browser to test the new bundle.")
        }
    })

    const shutdown = installRunnerControls({
        dock,
        processes,
        interactive,
        hotkeys: BUNDLED_HOTKEYS,
        prefix: "bundled",
        showHelp: !buildOnly,
        actions: {
            syncBackend: createBackendSync(processes, (message) => dock.log(message), "bundled"),
            rebuildFrontend: () => rebuild(),
            restartTunnel,
            restartAll: () => rebuild(true)
        }
    })
    const success = await rebuild()
    if (buildOnly || (!success && !interactive)) await shutdown(success ? 0 : 1)
}

const entrypoint = process.argv[1]
if (entrypoint && pathToFileURL(path.resolve(entrypoint)).href === import.meta.url) {
    await previewCloudDev({ buildOnly: process.argv.includes("--build-only") })
}
