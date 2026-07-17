"use node"

import { Sandbox } from "@vercel/sandbox"
import { v } from "convex/values"
import { internalAction } from "../../_generated/server"

const DEPENDENCY_INSTALL_TIMEOUT_MS = 30_000
const SANDBOX_SESSION_TIMEOUT_MS = 70_000
const MAX_OUTPUT_CHARS_PER_STREAM = 32_000
const MAX_CODE_CHARS = 100_000
const MAX_DEPENDENCIES = 10
const PACKAGE_SPECIFIER = /^[a-zA-Z0-9@._+\-/\[\],=<>!~^]+$/

export const getVercelSandboxCredentials = () => {
    const teamId = process.env.VERCEL_TEAM_ID?.trim()
    const projectId = process.env.VERCEL_PROJECT_ID?.trim()
    const token = process.env.VERCEL_TOKEN?.trim()

    return teamId && projectId && token ? { teamId, projectId, token } : null
}

export const truncateCodeExecutionOutput = (
    value: string,
    maxChars = MAX_OUTPUT_CHARS_PER_STREAM
): { value: string; truncated: boolean } => {
    if (value.length <= maxChars) return { value, truncated: false }
    return {
        value: `${value.slice(0, maxChars)}\n[output truncated]`,
        truncated: true
    }
}

const collectCommandOutput = async (command: {
    stdout: () => Promise<string>
    stderr: () => Promise<string>
}) => {
    const [rawStdout, rawStderr] = await Promise.all([command.stdout(), command.stderr()])
    const stdout = truncateCodeExecutionOutput(rawStdout)
    const stderr = truncateCodeExecutionOutput(rawStderr)

    return {
        stdout: stdout.value,
        stderr: stderr.value,
        outputTruncated: stdout.truncated || stderr.truncated
    }
}

const validateExecutionInput = (code: string, dependencies: string[]) => {
    if (code.length === 0 || code.length > MAX_CODE_CHARS) {
        throw new Error("Code exceeds the supported execution size")
    }
    if (dependencies.length > MAX_DEPENDENCIES) {
        throw new Error("Too many dependencies")
    }
    if (
        dependencies.some(
            (dependency) =>
                dependency.length === 0 ||
                dependency.length > 150 ||
                dependency.startsWith("-") ||
                !PACKAGE_SPECIFIER.test(dependency)
        )
    ) {
        throw new Error("Invalid dependency specifier")
    }
}

export const executeCode = internalAction({
    args: {
        language: v.union(v.literal("javascript"), v.literal("python")),
        code: v.string(),
        dependencies: v.array(v.string()),
        timeoutMs: v.number()
    },
    handler: async (_ctx, { language, code, dependencies, timeoutMs }) => {
        validateExecutionInput(code, dependencies)
        const credentials = getVercelSandboxCredentials()
        if (!credentials) {
            return {
                success: false,
                phase: "sandbox",
                language,
                error: "Vercel Sandbox is not configured"
            }
        }

        const runtime = language === "javascript" ? "node24" : "python3.13"
        const filename = language === "javascript" ? "main.mjs" : "main.py"
        let sandbox: Awaited<ReturnType<typeof Sandbox.create>> | undefined

        try {
            sandbox = await Sandbox.create({
                ...credentials,
                runtime,
                resources: { vcpus: 1 },
                timeout: SANDBOX_SESSION_TIMEOUT_MS,
                persistent: false,
                networkPolicy: "allow-all",
                tags: { app: "silkchat", feature: "code-execution" }
            })

            await sandbox.writeFiles([{ path: filename, content: Buffer.from(code) }])

            if (dependencies.length > 0) {
                const installCommand =
                    language === "javascript"
                        ? {
                              cmd: "npm",
                              args: ["install", "--no-audit", "--no-fund", "--", ...dependencies]
                          }
                        : {
                              cmd: "python",
                              args: [
                                  "-m",
                                  "pip",
                                  "install",
                                  "--disable-pip-version-check",
                                  "--no-input",
                                  ...dependencies
                              ]
                          }
                const installResult = await sandbox.runCommand({
                    ...installCommand,
                    timeoutMs: DEPENDENCY_INSTALL_TIMEOUT_MS
                })

                if (installResult.exitCode !== 0) {
                    return {
                        success: false,
                        phase: "dependency_install",
                        language,
                        dependencies,
                        exitCode: installResult.exitCode,
                        durationMs: installResult.durationMs,
                        ...(await collectCommandOutput(installResult))
                    }
                }
            }

            const result = await sandbox.runCommand({
                cmd: language === "javascript" ? "node" : "python",
                args: [filename],
                timeoutMs: Math.min(30_000, Math.max(1_000, Math.round(timeoutMs)))
            })

            return {
                success: result.exitCode === 0,
                phase: "execution",
                language,
                dependencies,
                networkAccess: "public-internet",
                exitCode: result.exitCode,
                durationMs: result.durationMs,
                ...(await collectCommandOutput(result))
            }
        } catch (error) {
            return {
                success: false,
                phase: "sandbox",
                language,
                error: error instanceof Error ? error.message : "Sandbox execution failed"
            }
        } finally {
            if (sandbox) {
                await sandbox.delete().catch(async (error) => {
                    console.error("Failed to delete code execution sandbox", error)
                    await sandbox
                        ?.stop()
                        .catch((stopError) =>
                            console.error("Failed to stop code execution sandbox", stopError)
                        )
                })
            }
        }
    }
})
