import { spawn } from "node:child_process"

const stagingDomains = (
    process.env.STAGING_VERCEL_DOMAINS || "silkchat-staging.xyz,img.silkchat-staging.xyz"
)
    .split(",")
    .map((domain) => domain.trim())
    .filter(Boolean)

const run = (command, args, options = {}) =>
    new Promise((resolve, reject) => {
        const child = spawn(command, args, {
            shell: process.platform === "win32",
            ...options
        })
        let stdout = ""
        let stderr = ""

        child.stdout?.on("data", (chunk) => {
            const text = chunk.toString()
            stdout += text
            process.stdout.write(text)
        })

        child.stderr?.on("data", (chunk) => {
            const text = chunk.toString()
            stderr += text
            process.stderr.write(text)
        })

        child.on("error", reject)
        child.on("exit", (code) => {
            if (code === 0) {
                resolve({ stdout, stderr })
                return
            }

            reject(new Error(`${command} ${args.join(" ")} failed with exit code ${code}`))
        })
    })

if (stagingDomains.length === 0) {
    console.error(
        "Missing staging domains. Set STAGING_VERCEL_DOMAINS or update the script default."
    )
    process.exit(1)
}

const deployResult = await run("bunx", ["vercel", "deploy", "--target", "preview", "--yes"], {
    stdio: ["inherit", "pipe", "pipe"]
})

const deploymentUrl = deployResult.stdout.match(/https:\/\/[^\s]+\.vercel\.app/)?.[0]

if (!deploymentUrl) {
    console.error("Could not find the Vercel Preview deployment URL in the deploy output.")
    process.exit(1)
}

for (const domain of stagingDomains) {
    await run("bunx", ["vercel", "alias", "set", deploymentUrl, domain], {
        stdio: ["inherit", "pipe", "pipe"]
    })
}

console.log(`[staging:vercel:deploy] ${deploymentUrl} is aliased to ${stagingDomains.join(", ")}.`)
