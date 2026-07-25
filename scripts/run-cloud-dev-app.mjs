import { spawn } from "node:child_process"
import path from "node:path"
import dotenv from "dotenv"
import { addViteAllowedHost, getCloudDevTunnelConfig } from "./lib/cloud-dev-tunnel.mjs"

const children = []
let shuttingDown = false
const localImageOptimizerPort = process.env.LOCAL_IMAGE_OPTIMIZER_PORT || "43177"

dotenv.config({
    path: [
        path.resolve(process.cwd(), "envs", ".env.cloud-dev"),
        path.resolve(process.cwd(), "envs", ".env.local")
    ],
    override: false,
    quiet: true
})

const getRequiredEnv = (name) => {
    const value = process.env[name]?.trim()
    if (!value) {
        throw new Error(`Missing ${name}. Add it to envs/.env.cloud-dev.`)
    }
    return value
}

const tunnelConfig = getCloudDevTunnelConfig(process.env)
const childBaseEnv = { ...process.env }
childBaseEnv.CLOUDFLARE_TUNNEL_TOKEN = undefined
childBaseEnv.TUNNEL_TOKEN = undefined

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

const stopChildrenAndExit = (exitCode) => {
    if (shuttingDown) return
    shuttingDown = true
    for (const running of children) {
        if (!running.killed) {
            running.kill("SIGTERM")
        }
    }
    process.exit(exitCode)
}

const start = (label, command, args, env = viteEnv) => {
    const child = spawn(command, args, {
        stdio: "inherit",
        shell: process.platform === "win32",
        env
    })

    child.on("exit", (code) => {
        if (shuttingDown) return
        stopChildrenAndExit(code ?? 1)
    })

    child.on("error", (error) => {
        console.error(`[cloud-dev-app] failed to start ${label}: ${error.message}`)
        stopChildrenAndExit(1)
    })

    console.log(`[cloud-dev-app] started ${label}`)
    children.push(child)
}

const shutdown = () => {
    if (shuttingDown) return
    shuttingDown = true
    for (const child of children) {
        if (!child.killed) {
            child.kill("SIGTERM")
        }
    }
    setTimeout(() => process.exit(0), 200)
}

process.on("SIGINT", shutdown)
process.on("SIGTERM", shutdown)

// Forward any extra CLI args to Vite, e.g. `bun run dev --host` to expose the
// dev server on the LAN for testing on a real phone.
const forwardedViteArgs = process.argv.slice(2)

start("Local image optimizer", "bun", ["run", "local:image-optimizer"])
start("Web app", "vite", ["dev", "--port", "3000", ...forwardedViteArgs])

if (tunnelConfig) {
    start("Cloudflare tunnel", "cloudflared", ["tunnel", "--no-autoupdate", "run"], {
        ...childBaseEnv,
        TUNNEL_TOKEN: tunnelConfig.token
    })
    console.log(`[cloud-dev-app] public URL: ${tunnelConfig.publicUrl}`)
}
