"use node"

import { Sandbox } from "@vercel/sandbox"
import { v } from "convex/values"
import { internal } from "../../_generated/api"
import type { Id } from "../../_generated/dataModel"
import { internalAction } from "../../_generated/server"
import { PERSISTENT_SANDBOX_IDLE_SUSPEND_MS } from "../persistent_sandbox_policy"
import {
    calculateSandboxUsageMicrousd,
    collectSandboxBillableUsage,
    sandboxSessionNeedsStop
} from "../sandbox_billing"

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

type PersistentSandboxCandidate = {
    status: string
    runtime: "node24" | "python3.13"
    sandboxName?: string
    expiresAt?: number
}

export const resolveCodeSandbox = ({
    requestedMode,
    runtime,
    activeSandbox,
    now
}: {
    requestedMode: "ephemeral" | "persistent"
    runtime: "node24" | "python3.13"
    activeSandbox: PersistentSandboxCandidate | null
    now: number
}): { mode: "ephemeral" } | { mode: "persistent"; sandboxName: string } | { error: string } => {
    const available =
        activeSandbox?.status === "active" &&
        Boolean(activeSandbox.sandboxName) &&
        typeof activeSandbox.expiresAt === "number" &&
        activeSandbox.expiresAt > now

    if (available && activeSandbox) {
        if (activeSandbox.runtime !== runtime) {
            return {
                error: `The active persistent sandbox uses ${activeSandbox.runtime}; ${runtime} execution cannot use an ephemeral sandbox until the active sandbox is killed.`
            }
        }
        return { mode: "persistent", sandboxName: activeSandbox.sandboxName as string }
    }

    if (requestedMode === "persistent") {
        return {
            error: "No active persistent sandbox is available. Ask the user to approve one first."
        }
    }
    return { mode: "ephemeral" }
}

export const executeCode = internalAction({
    args: {
        userId: v.string(),
        language: v.union(v.literal("javascript"), v.literal("python")),
        code: v.string(),
        dependencies: v.array(v.string()),
        sandboxMode: v.union(v.literal("ephemeral"), v.literal("persistent")),
        timeoutMs: v.number()
    },
    handler: async (ctx, { userId, language, code, dependencies, sandboxMode, timeoutMs }) => {
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
        const extension = language === "javascript" ? "mjs" : "py"
        const filename = `main-${crypto.randomUUID()}.${extension}`
        let sandbox: Sandbox | undefined
        let persistent = false
        let effectiveSandboxMode: "ephemeral" | "persistent" = sandboxMode
        let persistentSandboxId: Id<"persistentSandboxes"> | undefined
        let activityLeaseId: string | undefined

        const finalizeToolBilling = async () => {
            if (persistent)
                return { settledMicrousd: 0, pricingSource: "sandbox_reported" as const }
            if (!sandbox) return { settledMicrousd: 0, pricingSource: "sandbox_reported" as const }

            const ephemeralSandbox = sandbox
            sandbox = undefined
            try {
                if (sandboxSessionNeedsStop(ephemeralSandbox.status)) {
                    await ephemeralSandbox.stop()
                }
                const usage = await collectSandboxBillableUsage(ephemeralSandbox)
                const settledMicrousd = calculateSandboxUsageMicrousd(usage)
                await ephemeralSandbox.delete()
                return { settledMicrousd, pricingSource: "sandbox_reported" as const }
            } catch (error) {
                console.error("Failed to capture ephemeral sandbox billing", error)
                await ephemeralSandbox.delete().catch(() => undefined)
                return undefined
            }
        }

        try {
            const activeSandbox = await ctx.runQuery(
                internal.persistent_sandboxes.getActivePersistentSandboxForUser,
                { userId }
            )
            const selection = resolveCodeSandbox({
                requestedMode: sandboxMode,
                runtime,
                activeSandbox,
                now: Date.now()
            })
            if ("error" in selection) {
                return {
                    success: false,
                    phase: "sandbox",
                    language,
                    sandboxMode,
                    error: selection.error,
                    __toolBilling: await finalizeToolBilling()
                }
            }
            effectiveSandboxMode = selection.mode

            if (selection.mode === "persistent") {
                if (!activeSandbox) throw new Error("Persistent sandbox record disappeared")
                activityLeaseId = crypto.randomUUID()
                const executionRecord = await ctx.runMutation(
                    internal.persistent_sandboxes.beginPersistentSandboxExecution,
                    {
                        sandboxId: activeSandbox._id,
                        userId,
                        activityLeaseId,
                        now: Date.now()
                    }
                )
                if (!executionRecord) {
                    throw new Error(
                        "The persistent sandbox is expiring or being suspended. Retry once shortly."
                    )
                }
                persistentSandboxId = activeSandbox._id
                if (executionRecord.scheduledIdleStopId) {
                    await ctx.scheduler
                        .cancel(executionRecord.scheduledIdleStopId)
                        .catch(() => undefined)
                }
                sandbox = await Sandbox.get({
                    ...credentials,
                    name: selection.sandboxName
                })
                persistent = true
            } else {
                sandbox = await Sandbox.create({
                    ...credentials,
                    runtime,
                    resources: { vcpus: 1 },
                    timeout: SANDBOX_SESSION_TIMEOUT_MS,
                    persistent: false,
                    networkPolicy: "allow-all",
                    tags: { app: "silkchat", feature: "code-execution" }
                })
            }

            if (!sandbox) throw new Error("Sandbox failed to initialize")
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
                        sandboxMode: effectiveSandboxMode,
                        exitCode: installResult.exitCode,
                        durationMs: installResult.durationMs,
                        ...(await collectCommandOutput(installResult)),
                        __toolBilling: await finalizeToolBilling()
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
                sandboxMode: effectiveSandboxMode,
                networkAccess: "public-internet",
                exitCode: result.exitCode,
                durationMs: result.durationMs,
                ...(await collectCommandOutput(result)),
                __toolBilling: await finalizeToolBilling()
            }
        } catch (error) {
            return {
                success: false,
                phase: "sandbox",
                language,
                sandboxMode: effectiveSandboxMode,
                error: error instanceof Error ? error.message : "Sandbox execution failed",
                __toolBilling: await finalizeToolBilling()
            }
        } finally {
            if (persistentSandboxId && activityLeaseId) {
                let scheduledIdleStopId: Id<"_scheduled_functions"> | undefined
                try {
                    scheduledIdleStopId = await ctx.scheduler.runAfter(
                        PERSISTENT_SANDBOX_IDLE_SUSPEND_MS,
                        internal.persistent_sandboxes_node.suspendIdlePersistentSandbox,
                        { sandboxId: persistentSandboxId, activityLeaseId }
                    )
                } catch (error) {
                    console.error("Failed to schedule persistent sandbox idle suspension", error)
                }
                const scheduled = await ctx.runMutation(
                    internal.persistent_sandboxes.finishPersistentSandboxExecution,
                    {
                        sandboxId: persistentSandboxId,
                        activityLeaseId,
                        scheduledIdleStopId,
                        now: Date.now()
                    }
                )
                if (!scheduled && scheduledIdleStopId) {
                    await ctx.scheduler.cancel(scheduledIdleStopId).catch(() => undefined)
                }
            }
            if (sandbox && !persistent) {
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
