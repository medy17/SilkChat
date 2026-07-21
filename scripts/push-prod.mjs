import { spawn } from "node:child_process"
import { existsSync } from "node:fs"
import path from "node:path"
import dotenv from "dotenv"

const envFile = path.resolve(process.cwd(), "envs", ".env.convex.prod")

if (!existsSync(envFile)) {
    console.error(
        [
            "Missing envs/.env.convex.prod.",
            "Create it with the production deployment selector, for example:",
            'CONVEX_DEPLOYMENT="prod:fearless-bobcat-351"'
        ].join("\n")
    )
    process.exit(1)
}

dotenv.config({ path: envFile, override: true, quiet: true })

const deployment = process.env.CONVEX_DEPLOYMENT
if (!deployment?.trim()) {
    console.error(`Missing CONVEX_DEPLOYMENT in ${envFile}.`)
    process.exit(1)
}

const run = (args) =>
    new Promise((resolve, reject) => {
        const child = spawn("bunx", args, {
            stdio: "inherit",
            shell: process.platform === "win32",
            env: {
                ...process.env,
                CONVEX_DEPLOYMENT: deployment.trim()
            }
        })

        child.on("error", reject)
        child.on("exit", (code) => {
            if (code === 0) {
                resolve()
                return
            }

            reject(new Error(`bunx ${args.join(" ")} failed with exit code ${code}`))
        })
    })

try {
    await run([
        "convex",
        "deploy",
        "--env-file",
        envFile,
        "--codegen",
        "disable",
        "--typecheck",
        "disable",
        ...process.argv.slice(2)
    ])

    console.log("[prod:push] Syncing OpenRouter model metadata...")
    await run([
        "convex",
        "run",
        "model_provider_metadata_node:syncOpenRouterModelMetadata",
        "{}",
        "--codegen",
        "disable",
        "--typecheck",
        "disable"
    ])
} catch (error) {
    console.error(error instanceof Error ? error.message : error)
    process.exit(1)
}
