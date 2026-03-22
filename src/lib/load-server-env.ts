import path from "node:path"
import dotenv from "dotenv"

let loaded = false

export function loadServerEnv() {
    if (loaded) return

    const cwd = process.cwd()
    const envFiles = [".env.local", ".env"]

    for (const envFile of envFiles) {
        dotenv.config({
            path: path.join(cwd, envFile),
            override: false
        })
    }

    loaded = true
}
