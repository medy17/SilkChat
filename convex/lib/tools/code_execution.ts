import { tool } from "ai"
import { z } from "zod"
import { internal } from "../../_generated/api"
import { PERSISTENT_SANDBOX_CONFIRMATION_TTL_MS } from "../persistent_sandbox_policy"
import { defaultSandboxRuntimeVersion } from "../sandbox_runtime"
import type { ToolAdapter } from "../toolkit"

const DEFAULT_EXECUTION_TIMEOUT_MS = 20_000
const MAX_EXECUTION_TIMEOUT_MS = 30_000

const packageSchema = z
    .string()
    .trim()
    .min(1)
    .max(150)
    .regex(/^[a-zA-Z0-9@._+\-/[\],=<>!~^]+$/, "Invalid package specifier")
    .refine((value) => !value.startsWith("-"), "Package specifier cannot be an option")

export const codeExecutionInputSchema = z.object({
    purpose: z
        .string()
        .trim()
        .min(1)
        .max(80)
        .describe(
            "A short user-facing active phrase describing this execution's purpose, such as 'Checking smaller candidates'. Do not claim an outcome that has not been established yet."
        ),
    language: z.enum(["javascript", "python"]),
    code: z.string().min(1).max(100_000),
    dependencies: z.array(packageSchema).max(10).optional().default([]),
    sandboxMode: z
        .enum(["ephemeral", "persistent"])
        .optional()
        .default("ephemeral")
        .describe(
            "Use persistent after approval. The server always routes execution to a compatible active persistent sandbox, even if ephemeral is requested."
        ),
    timeoutMs: z
        .number()
        .int()
        .min(1_000)
        .max(MAX_EXECUTION_TIMEOUT_MS)
        .optional()
        .default(DEFAULT_EXECUTION_TIMEOUT_MS)
})

export const CodeExecutionAdapter: ToolAdapter = async (params) => {
    if (!params.enabledTools.includes("code_execution")) return {}
    if (!params.toolAvailability.code_execution.enabled) return {}

    return {
        release_persistent_sandbox: tool({
            description: [
                "Permanently release the account's active persistent code workspace once all work is complete.",
                "Call this only after required results and artifacts have been returned and no follow-up execution is needed.",
                "This cleanup operation is idempotent and does not consume the tool-call budget."
            ].join("\n"),
            inputSchema: z.object({}),
            execute: async () =>
                await params.ctx.runAction(
                    internal.persistent_sandboxes_node.releasePersistentSandboxForUser,
                    { userId: params.userSettings.userId }
                )
        }),
        request_persistent_sandbox: tool({
            description: [
                "Request user approval for one account-wide persistent code workspace.",
                "Use this only when multiple code executions must share filesystem state and an ephemeral execution cannot complete the task.",
                "This tool only prepares an Allow/Deny card; it does not create a sandbox. After a successful call, stop the turn."
            ].join("\n"),
            inputSchema: z.object({
                purpose: z
                    .string()
                    .trim()
                    .min(1)
                    .max(160)
                    .describe("A concise explanation of why filesystem persistence is required."),
                runtime: z
                    .enum(["node", "python"])
                    .describe("Runtime required by the persistent workspace."),
                ttlMinutes: z
                    .union([
                        z.literal(3),
                        z.literal(5),
                        z.literal(10),
                        z.literal(15),
                        z.literal(30)
                    ])
                    .describe("Requested lifetime in minutes. Choose the shortest sufficient TTL.")
            }),
            execute: async ({ purpose, runtime, ttlMinutes }) => {
                const active = await params.ctx.runQuery(
                    internal.persistent_sandboxes.getActivePersistentSandboxForUser,
                    { userId: params.userSettings.userId }
                )
                if (active) {
                    return {
                        success: false,
                        code: "persistent_sandbox_already_active",
                        error: "This account already has an active persistent sandbox. Reuse it or ask the user to kill it before requesting another."
                    }
                }
                const requestedAt = Date.now()
                const runtimeVersion = defaultSandboxRuntimeVersion(runtime)
                return {
                    success: true,
                    kind: "persistent_sandbox_request",
                    status: "pending_confirmation",
                    cardId: crypto.randomUUID(),
                    purpose: purpose.trim(),
                    runtime,
                    runtimeVersion,
                    ttlMinutes,
                    requestedAt,
                    confirmationExpiresAt: requestedAt + PERSISTENT_SANDBOX_CONFIRMATION_TTL_MS
                }
            }
        }),
        execute_code: tool({
            description: [
                "Execute JavaScript (Node.js 24) or Python 3.14 in an isolated Linux sandbox with public internet access.",
                "This is the general-purpose executor. When execute_math is also available, prefer execute_math for mathematical, scientific, statistical, unit, data-analysis, and graph-algorithm work covered by its included libraries.",
                "Standard libraries are available; declare third-party npm or PyPI packages in dependencies.",
                "To give the user downloadable files, write them under the directory in SILKCHAT_ARTIFACT_DIR. Supported outputs include PDF, CSV/TSV, JSON/text/Markdown, XLSX/DOCX/PPTX, ZIP, SQLite, Parquet, PNG, JPEG, and WebP. Do not print binary data or base64.",
                "Successful artifacts are attached to the response automatically. Refer to them by filename in prose. If a Markdown link is genuinely useful, copy the artifact's returned HTTPS url exactly; never link to a sandbox:, file:, /vercel/sandbox, or other local path."
            ].join("\n"),
            inputSchema: codeExecutionInputSchema,
            execute: async ({ language, code, dependencies, sandboxMode, timeoutMs }) =>
                await params.ctx.runAction(internal.lib.tools.code_execution_node.executeCode, {
                    userId: params.userSettings.userId,
                    language,
                    code,
                    dependencies,
                    sandboxMode,
                    timeoutMs
                })
        })
    }
}
