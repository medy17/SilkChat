import { spawn } from "node:child_process"

const deployment = process.env.CLOUD_DEV_DEPLOYMENT || "dev:knowing-falcon-519"

const child = spawn(
    "bunx",
    ["convex", "dev", "--once", "--codegen", "disable", "--typecheck", "disable"],
    {
        stdio: "inherit",
        shell: process.platform === "win32",
        env: {
            ...process.env,
            CONVEX_DEPLOYMENT: deployment
        }
    }
)

child.on("exit", (code) => {
    process.exit(code ?? 1)
})
