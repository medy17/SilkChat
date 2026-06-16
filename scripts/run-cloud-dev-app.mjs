import { spawn } from "node:child_process"
import path from "node:path"
import dotenv from "dotenv"

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

const viteEnv = {
    ...process.env,
    VITE_CONVEX_URL: getRequiredEnv("CLOUD_DEV_CONVEX_URL"),
    VITE_CONVEX_API_URL: getRequiredEnv("CLOUD_DEV_CONVEX_API_URL"),
    VITE_CONVEX_SITE_URL: getRequiredEnv("CLOUD_DEV_CONVEX_SITE_URL"),
    VITE_LOCAL_IMAGE_OPTIMIZER_ENABLED: "1",
    LOCAL_IMAGE_OPTIMIZER_PORT: localImageOptimizerPort
}

const start = (label, command, args) => {
    const child = spawn(command, args, {
        stdio: "inherit",
        shell: process.platform === "win32",
        env: viteEnv
    })

    child.on("exit", (code) => {
        if (shuttingDown) return
        shuttingDown = true
        for (const running of children) {
            if (!running.killed) {
                running.kill("SIGTERM")
            }
        }
        process.exit(code ?? 1)
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

start("Local image optimizer", "bun", ["run", "local:image-optimizer"])
start("Web app", "vite", ["dev", "--port", "3000"])
