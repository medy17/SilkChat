import { spawn } from "node:child_process"
import path from "node:path"
import dotenv from "dotenv"

dotenv.config({
    path: [path.resolve(process.cwd(), "envs", ".env.local")],
    override: false,
    quiet: true
})

const child = spawn("vite", ["dev", "--port", "3000"], {
    stdio: "inherit",
    shell: process.platform === "win32",
    env: process.env
})

child.on("exit", (code) => {
    process.exit(code ?? 1)
})
