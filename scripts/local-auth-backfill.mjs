import { spawn } from "node:child_process"
import { existsSync, mkdirSync, readFileSync, unlinkSync, writeFileSync } from "node:fs"
import path from "node:path"
import dotenv from "dotenv"

dotenv.config({
    path: [path.resolve(process.cwd(), ".env.local"), path.resolve(process.cwd(), ".env")],
    override: false,
    quiet: true
})

const localTempDir = path.resolve(process.cwd(), "temp", "local-dev")
const requiredEnvVars = ["BETTER_AUTH_SECRET", "DATABASE_URL", "DATABASE_SSL"]

mkdirSync(localTempDir, { recursive: true })

const run = (label, command, args) =>
    new Promise((resolve, reject) => {
        console.log(`\n[local-auth-backfill] ${label}`)
        const child = spawn(command, args, {
            stdio: "inherit",
            shell: process.platform === "win32"
        })

        child.on("exit", (code) => {
            if (code === 0) {
                resolve()
                return
            }

            reject(new Error(`${label} failed with exit code ${code}`))
        })
    })

const escapeDotenvValue = (value) =>
    `"${value.replace(/\\/g, "\\\\").replace(/\n/g, "\\n").replace(/"/g, '\\"')}"`

const ensureLocalDeploymentSelected = () => {
    const envLocalPath = path.resolve(process.cwd(), ".env.local")
    if (!existsSync(envLocalPath)) return true

    const envLocalContent = readFileSync(envLocalPath, "utf8")
    const match = envLocalContent.match(/^CONVEX_DEPLOYMENT=(.+)$/m)
    if (!match) return true

    const rawValue = match[1].split("#")[0].trim().replace(/^"|"$/g, "")
    if (rawValue.startsWith("local:")) return true

    throw new Error(
        `CONVEX_DEPLOYMENT is '${rawValue}', not a local deployment. Run \`bun run local:convex:configure\` first.`
    )
}

const syncBackfillEnvVars = async () => {
    const missingEnvVars = requiredEnvVars.filter((name) => !process.env[name]?.trim())
    if (missingEnvVars.length > 0) {
        throw new Error(
            `Missing required env vars in .env.local for local auth backfill: ${missingEnvVars.join(", ")}`
        )
    }

    const envFilePath = path.join(localTempDir, "convex-local-auth-backfill.env")
    const envFileContents = requiredEnvVars
        .map((name) => `${name}=${escapeDotenvValue(process.env[name].trim())}`)
        .join("\n")

    writeFileSync(envFilePath, `${envFileContents}\n`, "utf8")

    try {
        await run("Syncing auth backfill env vars to local Convex", "bunx", [
            "convex",
            "env",
            "set",
            "--deployment",
            "local",
            "--from-file",
            envFilePath,
            "--force"
        ])
    } finally {
        try {
            unlinkSync(envFilePath)
        } catch {}
    }
}

const main = async () => {
    ensureLocalDeploymentSelected()
    await syncBackfillEnvVars()
    await run("Backfilling local Postgres auth data into local Convex", "bunx", [
        "convex",
        "run",
        "auth_backfill:backfillFromPostgres",
        `{"secret":${JSON.stringify(process.env.BETTER_AUTH_SECRET.trim())}}`
    ])
}

main().catch((error) => {
    console.error(`\n[local-auth-backfill] ${error.message}`)
    process.exit(1)
})
