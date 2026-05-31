import { spawn } from "node:child_process"
import { existsSync, mkdirSync, readFileSync, unlinkSync, writeFileSync } from "node:fs"
import path from "node:path"
import dotenv from "dotenv"

dotenv.config({
    path: [path.resolve(process.cwd(), ".env.local"), path.resolve(process.cwd(), ".env")],
    override: false,
    quiet: true
})

const children = []
let shuttingDown = false
const localImageOptimizerPort = process.env.LOCAL_IMAGE_OPTIMIZER_PORT || "43177"
const localTempDir = path.resolve(process.cwd(), "temp", "local-dev")
const localConvexConfigPath = path.resolve(
    process.cwd(),
    ".convex",
    "local",
    "default",
    "config.json"
)
const requiredLocalConvexEnvVars = [
    "BETTER_AUTH_SECRET",
    "GOOGLE_CLIENT_ID",
    "GOOGLE_CLIENT_SECRET",
    "VITE_BETTER_AUTH_URL",
    "R2_BUCKET",
    "R2_ENDPOINT",
    "R2_ACCESS_KEY_ID",
    "R2_SECRET_ACCESS_KEY",
    "R2_FORCE_PATH_STYLE"
]

mkdirSync(localTempDir, { recursive: true })

const readLocalConvexConfig = () => {
    if (!existsSync(localConvexConfigPath)) {
        throw new Error(
            `Missing local Convex config at ${localConvexConfigPath}. Run \`bun run local:convex:configure\` first.`
        )
    }

    const parsed = JSON.parse(readFileSync(localConvexConfigPath, "utf8"))
    const cloudPort = parsed?.ports?.cloud
    const sitePort = parsed?.ports?.site

    if (
        typeof cloudPort !== "number" ||
        !Number.isFinite(cloudPort) ||
        typeof sitePort !== "number" ||
        !Number.isFinite(sitePort)
    ) {
        throw new Error(`Invalid local Convex config in ${localConvexConfigPath}.`)
    }

    return {
        cloudUrl: `http://127.0.0.1:${cloudPort}`,
        siteUrl: `http://127.0.0.1:${sitePort}`
    }
}

const getResolvedLocalEnv = () => {
    const localConvex = readLocalConvexConfig()

    return {
        ...process.env,
        VITE_CONVEX_URL: localConvex.cloudUrl,
        VITE_CONVEX_API_URL: `${localConvex.cloudUrl}/http`,
        VITE_CONVEX_SITE_URL: localConvex.siteUrl
    }
}

const getSpawnEnv = (overrides = {}) => ({
    ...getResolvedLocalEnv(),
    LOCAL_DISABLE_PRIVATE_BLUR: "1",
    LOCAL_IMAGE_OPTIMIZER_PORT: localImageOptimizerPort,
    VITE_LOCAL_IMAGE_OPTIMIZER_ENABLED: "1",
    TMPDIR: localTempDir,
    TMP: localTempDir,
    TEMP: localTempDir,
    ...overrides
})

const ensureLocalDeploymentSelected = () => {
    const envLocalPath = path.resolve(process.cwd(), ".env.local")
    if (!existsSync(envLocalPath)) return true

    const envLocalContent = readFileSync(envLocalPath, "utf8")
    const match = envLocalContent.match(/^CONVEX_DEPLOYMENT=(.+)$/m)
    if (!match) return true

    const rawValue = match[1].split("#")[0].trim().replace(/^"|"$/g, "")
    if (rawValue.startsWith("local:")) return true

    console.error(
        `[local-dev] CONVEX_DEPLOYMENT is '${rawValue}', not a local deployment.\n[local-dev] Run \`bun run local:convex:configure\` first, then re-run \`bun run local:dev\`.`
    )
    return false
}

const escapeDotenvValue = (value) =>
    `"${value.replace(/\\/g, "\\\\").replace(/\n/g, "\\n").replace(/"/g, '\\"')}"`

const syncRequiredLocalConvexEnvVars = () =>
    new Promise((resolve, reject) => {
        const resolvedEnv = getResolvedLocalEnv()
        const missingEnvVars = requiredLocalConvexEnvVars.filter(
            (name) => !resolvedEnv[name]?.trim()
        )

        if (missingEnvVars.length > 0) {
            reject(
                new Error(
                    `Missing required local Convex env vars in .env.local: ${missingEnvVars.join(", ")}`
                )
            )
            return
        }

        const envFilePath = path.join(localTempDir, "convex-local-required.env")
        const envFileContents = [...requiredLocalConvexEnvVars, "VITE_CONVEX_SITE_URL"]
            .map((name) => `${name}=${escapeDotenvValue(resolvedEnv[name].trim())}`)
            .join("\n")

        writeFileSync(envFilePath, `${envFileContents}\n`, "utf8")
        console.log("[local-dev] syncing required Convex env vars to local deployment...")

        const child = spawn(
            "bunx",
            ["convex", "env", "set", "--deployment", "local", "--from-file", envFilePath, "--force"],
            {
                stdio: "inherit",
                shell: process.platform === "win32",
                env: getSpawnEnv()
            }
        )

        child.on("exit", (code) => {
            try {
                unlinkSync(envFilePath)
            } catch {}

            if (code === 0) {
                resolve()
                return
            }

            reject(new Error(`Convex env sync failed with exit code ${code}`))
        })
    })

const start = (label, command, args) => {
    const child = spawn(command, args, {
        stdio: "inherit",
        shell: process.platform === "win32",
        env: getSpawnEnv()
    })

    child.on("exit", (code) => {
        if (shuttingDown) return
        shuttingDown = true
        for (const running of children) {
            if (!running.killed) {
                running.kill("SIGTERM")
            }
        }
        process.exit(code ?? 1)
    })

    console.log(`[local-dev] started ${label}`)
    children.push(child)
}

const runConvexBootstrap = () =>
    new Promise((resolve, reject) => {
        console.log("[local-dev] bootstrapping Convex local deployment...")

        const child = spawn(
            "bunx",
            [
                "convex",
                "dev",
                "--local",
                "--local-force-upgrade",
                "--once",
                "--tail-logs",
                "disable",
                "--codegen",
                "disable",
                "--typecheck",
                "disable"
            ],
            {
                stdio: ["pipe", "inherit", "inherit"],
                shell: process.platform === "win32",
                env: getSpawnEnv()
            }
        )

        // Non-interactive environments can stall on backend upgrade prompts.
        // Sending "y" proactively allows the bootstrap to continue when prompted.
        child.stdin?.write("y\n")
        child.stdin?.end()

        child.on("exit", (code) => {
            if (code === 0) {
                resolve()
                return
            }
            reject(new Error(`Convex bootstrap failed with exit code ${code}`))
        })
    })

const shutdown = () => {
    if (shuttingDown) return
    shuttingDown = true
    for (const child of children) {
        if (!child.killed) {
            child.kill("SIGTERM")
        }
    }
    setTimeout(() => process.exit(0), 200)
}

process.on("SIGINT", shutdown)
process.on("SIGTERM", shutdown)

if (!ensureLocalDeploymentSelected()) {
    process.exit(1)
}

syncRequiredLocalConvexEnvVars()
    .then(() => runConvexBootstrap())
    .then(() => {
        start("Convex local", "bunx", [
            "convex",
            "dev",
            "--local",
            "--local-force-upgrade",
            "--tail-logs",
            "pause-on-deploy",
            "--codegen",
            "disable",
            "--typecheck",
            "disable"
        ])
        start("Local image optimizer", "bun", ["run", "local:image-optimizer"])
        start("Web app", "bun", ["run", "dev"])
    })
    .catch((error) => {
        console.error(`[local-dev] ${error.message}`)
        process.exit(1)
    })
