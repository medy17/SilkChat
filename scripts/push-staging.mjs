import { spawn } from "node:child_process"
import { existsSync, readFileSync, unlinkSync, writeFileSync } from "node:fs"
import path from "node:path"
import dotenv from "dotenv"

dotenv.config({
    path: [path.resolve(process.cwd(), "envs", ".env.staging")],
    override: false,
    quiet: true
})

const deployment = process.env.STAGING_CONVEX_DEPLOYMENT
const envLocalPath = path.resolve(process.cwd(), ".env.local")
const hadRootEnvLocal = existsSync(envLocalPath)
const originalEnvLocal = existsSync(envLocalPath) ? readFileSync(envLocalPath, "utf8") : null

if (!deployment?.trim()) {
    console.error(
        [
            "Missing STAGING_CONVEX_DEPLOYMENT.",
            "Set it in envs/.env.staging, for example:",
            'STAGING_CONVEX_DEPLOYMENT="dev:knowing-falcon-519"'
        ].join("\n")
    )
    process.exit(1)
}

const child = spawn(
    "bunx",
    ["convex", "dev", "--once", "--codegen", "disable", "--typecheck", "disable"],
    {
        stdio: "inherit",
        shell: process.platform === "win32",
        env: {
            ...process.env,
            CONVEX_DEPLOYMENT: deployment.trim()
        }
    }
)

child.on("exit", (code) => {
    if (originalEnvLocal !== null && existsSync(envLocalPath)) {
        const current = readFileSync(envLocalPath, "utf8")
        if (current !== originalEnvLocal) {
            writeFileSync(envLocalPath, originalEnvLocal, "utf8")
            console.log("[staging:push] Restored original .env.local after staging push.")
        }
    } else if (!hadRootEnvLocal && existsSync(envLocalPath)) {
        unlinkSync(envLocalPath)
        console.log("[staging:push] Removed .env.local created by Convex CLI.")
    }
    process.exit(code ?? 1)
})
