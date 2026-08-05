import { spawn } from "node:child_process"
import { existsSync, readFileSync, unlinkSync, writeFileSync } from "node:fs"
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

const deployment = process.env.CLOUD_DEV_CONVEX_DEPLOYMENT
const envLocalPath = path.resolve(process.cwd(), ".env.local")
const convexCliPath = path.resolve(process.cwd(), "node_modules", "convex", "bin", "main.js")
const hadRootEnvLocal = existsSync(envLocalPath)
const originalEnvLocal = existsSync(envLocalPath) ? readFileSync(envLocalPath, "utf8") : null

if (!deployment?.trim()) {
    console.error(
        [
            "Missing CLOUD_DEV_CONVEX_DEPLOYMENT.",
            "Create a cloud dev deployment, then set it in envs/.env.cloud-dev, for example:",
            'CLOUD_DEV_CONVEX_DEPLOYMENT="dev:your-cloud-dev-deployment"'
        ].join("\n")
    )
    process.exit(1)
}

const child = spawn(
    process.execPath,
    [convexCliPath, "dev", "--once", "--codegen", "disable", "--typecheck", "disable"],
    {
        stdio: "inherit",
        env: {
            ...process.env,
            CONVEX_DEPLOYMENT: deployment.trim()
        }
    }
)

const forwardSignal = (signal) => {
    if (child.exitCode === null && child.signalCode === null) {
        child.kill(signal)
    }
}

process.on("SIGINT", () => forwardSignal("SIGINT"))
process.on("SIGTERM", () => forwardSignal("SIGTERM"))

child.on("exit", (code) => {
    if (originalEnvLocal !== null && existsSync(envLocalPath)) {
        const current = readFileSync(envLocalPath, "utf8")
        if (current !== originalEnvLocal) {
            writeFileSync(envLocalPath, originalEnvLocal, "utf8")
            console.log("[cloud:dev:push] Restored original .env.local after cloud dev push.")
        }
    } else if (!hadRootEnvLocal && existsSync(envLocalPath)) {
        unlinkSync(envLocalPath)
        console.log("[cloud:dev:push] Removed .env.local created by Convex CLI.")
    }
    process.exit(code ?? 1)
})
