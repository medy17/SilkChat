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

const convexEnv = {
    ...process.env,
    CONVEX_DEPLOYMENT: deployment.trim()
}

const child = Bun.spawn(
    ["bunx", "convex", "dev", "--once", "--codegen", "disable", "--typecheck", "disable"],
    {
        stdin: "inherit",
        stdout: "inherit",
        stderr: "inherit",
        env: convexEnv
    }
)

const restoreEnvLocal = () => {
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
}

let code
try {
    code = await child.exited
} catch (error) {
    restoreEnvLocal()
    console.error(error)
    process.exit(1)
}

restoreEnvLocal()
if (code !== 0) process.exit(code)

console.log("[staging:push] Syncing OpenRouter model metadata...")
const syncChild = Bun.spawn(
    [
        "bunx",
        "convex",
        "run",
        "model_provider_metadata_node:syncOpenRouterModelMetadata",
        "{}",
        "--codegen",
        "disable",
        "--typecheck",
        "disable"
    ],
    {
        stdin: "inherit",
        stdout: "inherit",
        stderr: "inherit",
        env: convexEnv
    }
)
process.exitCode = await syncChild.exited
