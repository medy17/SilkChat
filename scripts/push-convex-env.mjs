import { spawn } from "node:child_process"
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs"
import os from "node:os"
import path from "node:path"
import dotenv from "dotenv"

const target = process.argv[2]
const envFile = path.resolve(process.cwd(), "envs", ".env.convex")
const targetEnvFileByTarget = {
    prod: path.resolve(process.cwd(), "envs", ".env.convex.production"),
    staging: path.resolve(process.cwd(), "envs", ".env.convex.staging"),
    "cloud-dev": path.resolve(process.cwd(), "envs", ".env.convex.cloud-dev")
}
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

const writeMergedEnvFile = (baseFile, overrideFile) => {
    const baseContent = readFileSync(baseFile, "utf8")
    const overrideContent =
        overrideFile && existsSync(overrideFile) ? readFileSync(overrideFile, "utf8") : ""
    const tempDir = mkdtempSync(path.join(os.tmpdir(), "silkchat-convex-env-"))
    const mergedFile = path.join(tempDir, ".env")
    writeFileSync(
        mergedFile,
        [baseContent.trimEnd(), overrideContent.trim()].filter(Boolean).join("\n\n") + "\n",
        "utf8"
    )
    return { mergedFile, tempDir }
}

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

const targetEnvFile = targetEnvFileByTarget[target]
const { mergedFile, tempDir } = writeMergedEnvFile(envFile, targetEnvFile)

const child = spawn(
    "bunx",
    ["convex", "env", "set", "--deployment", deployment.trim(), "--from-file", mergedFile, "--force"],
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
    rmSync(tempDir, { recursive: true, force: true })
    process.exit(code ?? 1)
})
