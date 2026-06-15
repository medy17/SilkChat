import { spawn } from "node:child_process"
import path from "node:path"
import dotenv from "dotenv"

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
    VITE_CONVEX_SITE_URL: getRequiredEnv("CLOUD_DEV_CONVEX_SITE_URL")
}

const child = spawn("vite", ["dev", "--port", "3000"], {
    stdio: "inherit",
    shell: process.platform === "win32",
    env: viteEnv
})

child.on("exit", (code) => {
    process.exit(code ?? 1)
})
