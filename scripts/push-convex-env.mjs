import { spawn } from "node:child_process"
import { existsSync, readFileSync } from "node:fs"
import path from "node:path"
import dotenv from "dotenv"

const target = process.argv[2]
const envFile = path.resolve(process.cwd(), "envs", ".env.convex")
const prodDeployFile = path.resolve(process.cwd(), "envs", ".env.convex.prod")
const cloudDevFile = path.resolve(process.cwd(), "envs", ".env.cloud-dev")
const stagingFile = path.resolve(process.cwd(), "envs", ".env.staging")

dotenv.config({
    path: [cloudDevFile, stagingFile],
    override: false,
    quiet: true
})

const readDeploymentFromFile = (filePath) => {
    if (!existsSync(filePath)) return undefined
    const match = readFileSync(filePath, "utf8").match(/^CONVEX_DEPLOYMENT=(.+)$/m)
    return match?.[1]?.split("#")[0]?.trim()?.replace(/^"|"$/g, "")
}

const toDeploymentName = (deployment) => deployment?.replace(/^(prod|dev):/, "")

const deploymentByTarget = {
    prod: toDeploymentName(readDeploymentFromFile(prodDeployFile)),
    staging: toDeploymentName(process.env.STAGING_CONVEX_DEPLOYMENT),
    "cloud-dev": toDeploymentName(process.env.CLOUD_DEV_CONVEX_DEPLOYMENT)
}

const deployment = deploymentByTarget[target]

if (!existsSync(envFile)) {
    console.error("Missing envs/.env.convex.")
    process.exit(1)
}

if (!deployment?.trim()) {
    console.error(
        [
            "Missing Convex deployment target.",
            "Usage: node scripts/push-convex-env.mjs <prod|staging|cloud-dev>",
            "For staging, set STAGING_CONVEX_DEPLOYMENT in envs/.env.staging.",
            "For cloud-dev, set CLOUD_DEV_CONVEX_DEPLOYMENT in envs/.env.cloud-dev."
        ].join("\n")
    )
    process.exit(1)
}

const child = spawn(
    "bunx",
    ["convex", "env", "set", "--deployment", deployment.trim(), "--from-file", envFile, "--force"],
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
    process.exit(code ?? 1)
})
