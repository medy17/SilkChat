import { spawn } from "node:child_process"
import { existsSync } from "node:fs"
import path from "node:path"

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

const child = spawn(
    "bunx",
    [
        "convex",
        "deploy",
        "--env-file",
        envFile,
        "--codegen",
        "disable",
        "--typecheck",
        "disable",
        ...process.argv.slice(2)
    ],
    {
        stdio: "inherit",
        shell: process.platform === "win32"
    }
)

child.on("exit", (code) => {
    process.exit(code ?? 1)
})
