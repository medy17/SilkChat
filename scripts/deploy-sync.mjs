import { spawn } from "node:child_process"

const targets = {
    staging: {
        branch: "staging",
        convexScript: "staging:push",
        gitRemote: "origin",
        gitBranch: "staging"
    },
    prod: {
        branch: "main",
        convexScript: "prod:push",
        gitRemote: "origin",
        gitBranch: "main"
    }
}

const targetName = process.argv[2]
const target = targets[targetName]

if (!target) {
    console.error("Usage: bun run deploy:sync <staging|prod>")
    process.exit(1)
}

const run = (command, args, options = {}) =>
    new Promise((resolve, reject) => {
        const child = spawn(command, args, {
            stdio: "inherit",
            shell: process.platform === "win32",
            ...options
        })

        child.on("error", reject)
        child.on("exit", (code) => {
            if (code === 0) {
                resolve()
                return
            }

            reject(new Error(`${command} ${args.join(" ")} failed with exit code ${code}`))
        })
    })

const getOutput = (command, args) =>
    new Promise((resolve, reject) => {
        const child = spawn(command, args, {
            stdio: ["ignore", "pipe", "pipe"],
            shell: process.platform === "win32"
        })
        let stdout = ""
        let stderr = ""

        child.stdout.on("data", (chunk) => {
            stdout += chunk.toString()
        })
        child.stderr.on("data", (chunk) => {
            stderr += chunk.toString()
        })
        child.on("error", reject)
        child.on("exit", (code) => {
            if (code === 0) {
                resolve(stdout.trim())
                return
            }

            reject(new Error(`${command} ${args.join(" ")} failed: ${stderr.trim()}`))
        })
    })

const fail = (message) => {
    console.error(message)
    process.exit(1)
}

const currentBranch = await getOutput("git", ["branch", "--show-current"])
if (currentBranch !== target.branch) {
    fail(
        `[deploy:sync] Refusing to deploy ${targetName} from ${currentBranch || "detached HEAD"}.\n` +
            `Switch to ${target.branch} first.`
    )
}

const status = await getOutput("git", ["status", "--porcelain"])
if (status) {
    fail("[deploy:sync] Refusing to deploy with uncommitted changes. Commit or stash first.")
}

console.log(`[deploy:sync] Verifying ${targetName} before deployment...`)
await run("bun", ["run", "check-types"])
await run("bun", ["run", "test"])

console.log(`[deploy:sync] Pushing Convex ${targetName} before frontend deployment...`)
await run("bun", ["run", target.convexScript])

console.log(`[deploy:sync] Pushing ${target.gitRemote}/${target.gitBranch}...`)
await run("git", ["push", target.gitRemote, target.gitBranch])

console.log(`[deploy:sync] ${targetName} deployment sync complete.`)
