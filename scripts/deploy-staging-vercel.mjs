const stagingDomains = (
    process.env.STAGING_VERCEL_DOMAINS || "silkchat-staging.xyz,img.silkchat-staging.xyz"
)
    .split(",")
    .map((domain) => domain.trim())
    .filter(Boolean)

const collect = async (stream, output) => {
    let collected = ""
    const reader = stream.getReader()
    const decoder = new TextDecoder()
    for (;;) {
        const { value, done } = await reader.read()
        if (done) break
        const text = decoder.decode(value, { stream: true })
        collected += text
        output.write(text)
    }
    const remainder = decoder.decode()
    collected += remainder
    output.write(remainder)
    return collected
}

const run = async (command, args) => {
    const child = Bun.spawn([command, ...args], {
        stdin: "inherit",
        stdout: "pipe",
        stderr: "pipe"
    })
    const [code, stdout, stderr] = await Promise.all([
        child.exited,
        collect(child.stdout, process.stdout),
        collect(child.stderr, process.stderr)
    ])
    if (code !== 0) {
        throw new Error(`${command} ${args.join(" ")} failed with exit code ${code}`)
    }
    return { stdout, stderr }
}

if (stagingDomains.length === 0) {
    console.error(
        "Missing staging domains. Set STAGING_VERCEL_DOMAINS or update the script default."
    )
    process.exit(1)
}

const deployResult = await run("bunx", ["vercel", "deploy", "--target", "preview", "--yes"])

const deploymentUrl = deployResult.stdout.match(/https:\/\/[^\s]+\.vercel\.app/)?.[0]

if (!deploymentUrl) {
    console.error("Could not find the Vercel Preview deployment URL in the deploy output.")
    process.exit(1)
}

for (const domain of stagingDomains) {
    await run("bunx", ["vercel", "alias", "set", deploymentUrl, domain])
}

console.log(`[staging:vercel:deploy] ${deploymentUrl} is aliased to ${stagingDomains.join(", ")}.`)
