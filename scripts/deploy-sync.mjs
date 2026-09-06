const targets = {
    staging: {
        branch: "staging",
        convexScript: "staging:push",
        workerScript: "fal:r2:worker:deploy:staging",
        gitRemote: "origin",
        gitBranch: "staging"
    },
    prod: {
        branch: "main",
        convexScript: "prod:push",
        workerScript: "fal:r2:worker:deploy:production",
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

const run = async (command, args, options = {}) => {
    const child = Bun.spawn([command, ...args], {
        stdin: "inherit",
        stdout: "inherit",
        stderr: "inherit",
        ...options
    })
    const code = await child.exited
    if (code !== 0) {
        throw new Error(`${command} ${args.join(" ")} failed with exit code ${code}`)
    }
}

const getOutput = (command, args) => {
    const result = Bun.spawnSync([command, ...args], {
        stdin: "ignore",
        stdout: "pipe",
        stderr: "pipe"
    })
    if (result.exitCode !== 0) {
        throw new Error(`${command} ${args.join(" ")} failed: ${result.stderr.toString().trim()}`)
    }
    return result.stdout.toString().trim()
}

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
await run("bun", [
    "run",
    "--parallel",
    "check-types",
    "fal:r2:worker:typecheck",
    "test",
    "test:bun-local"
])

console.log(`[deploy:sync] Deploying the fal R2 Worker for ${targetName}...`)
await run("bun", ["run", target.workerScript])

console.log(`[deploy:sync] Pushing Convex ${targetName} before frontend deployment...`)
await run("bun", ["run", target.convexScript])

console.log(`[deploy:sync] Pushing ${target.gitRemote}/${target.gitBranch}...`)
await run("git", ["push", target.gitRemote, target.gitBranch])

console.log(`[deploy:sync] ${targetName} deployment sync complete.`)
