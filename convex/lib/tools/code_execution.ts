import { tool } from "ai"
import { z } from "zod"
import { internal } from "../../_generated/api"
import type { Doc } from "../../_generated/dataModel"
import { describeComputerKeys } from "../computer_keys"
import { COMPUTER_COMMAND_MAX_TIMEOUT_MS, COMPUTER_REQUEST_TTL_MS } from "../computer_policy"
import type { ToolAdapter } from "../toolkit"

const DEFAULT_EXECUTION_TIMEOUT_MS = 20_000
const MAX_EXECUTION_TIMEOUT_MS = 30_000
const PACKAGE_SPECIFIER_PUNCTUATION = "@._+-/[],=<>!~^"

const isAllowedPackageSpecifier = (value: string) =>
    [...value].every(
        (character) =>
            /[a-zA-Z0-9]/.test(character) || PACKAGE_SPECIFIER_PUNCTUATION.includes(character)
    )

const packageSchema = z
    .string()
    .trim()
    .min(1)
    .max(150)
    .refine(isAllowedPackageSpecifier, "Invalid package specifier")
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
    timeoutMs: z
        .number()
        .int()
        .min(1_000)
        .max(MAX_EXECUTION_TIMEOUT_MS)
        .optional()
        .default(DEFAULT_EXECUTION_TIMEOUT_MS)
})

export const computerRunInputSchema = z.object({
    purpose: z
        .string()
        .trim()
        .min(1)
        .max(80)
        .describe(
            "A short user-facing active phrase for this step, such as 'Running the tests'. Do not claim an outcome that has not been established yet."
        ),
    command: z.string().min(1).max(100_000),
    cwd: z
        .string()
        .trim()
        .max(500)
        .optional()
        .describe("Working directory inside /vercel/workspace. Defaults to /vercel/workspace."),
    timeoutMs: z.number().int().min(1_000).max(COMPUTER_COMMAND_MAX_TIMEOUT_MS).optional()
})

export const CodeExecutionAdapter: ToolAdapter = async (params) => {
    if (!params.enabledTools.includes("code_execution")) return {}
    if (!params.toolAvailability.code_execution.enabled) return {}

    const computerKeys: Doc<"computerKeys">[] = await params.ctx.runQuery(
        internal.computer_keys.listEnabledComputerKeys,
        { userId: params.userSettings.userId }
    )

    const computer: Doc<"computers"> | null = await params.ctx.runQuery(
        internal.computers.getComputerForUser,
        { userId: params.userSettings.userId }
    )

    return {
        request_computer: tool({
            description: [
                "One-time setup of your own computer, a long-lived Linux machine that keeps its files between chats.",
                "Call this when computer_run reports that your computer isn't set up. It shows the user an Allow card once; after that the computer is simply yours to use.",
                "After a successful call, stop the turn."
            ].join("\n"),
            inputSchema: z.object({
                purpose: z
                    .string()
                    .trim()
                    .min(1)
                    .max(160)
                    .describe("What you want your computer for, in one short plain sentence.")
            }),
            execute: async ({ purpose }) => {
                const existing = await params.ctx.runQuery(internal.computers.getComputerForUser, {
                    userId: params.userSettings.userId
                })
                if (existing) {
                    return {
                        success: false,
                        code: "computer_already_exists",
                        error: "Your computer is already set up. Use computer_run."
                    }
                }
                const requestedAt = Date.now()
                return {
                    success: true,
                    kind: "computer_request",
                    status: "pending_confirmation",
                    cardId: crypto.randomUUID(),
                    purpose: purpose.trim(),
                    requestedAt,
                    confirmationExpiresAt: requestedAt + COMPUTER_REQUEST_TTL_MS
                }
            }
        }),
        computer_run: tool({
            description: [
                "Run a bash command on your own computer, a persistent Ubuntu machine with git, gh, Node 24, npm, pnpm, bun, and Python 3.14. It is yours to use whenever it helps.",
                "Files under /vercel/workspace stay between commands and chats. Commands start there. Anything outside the workspace, including system packages, can be lost after a reset or a long break.",
                "Running processes stop about 90 seconds after your last command. To give the user a file, write it under the directory in SILKCHAT_ARTIFACT_DIR.",
                computer
                    ? "Your computer is set up and ready."
                    : "Your computer isn't set up yet. Call request_computer before using this tool.",
                describeComputerKeys(computerKeys)
            ].join("\n"),
            inputSchema: computerRunInputSchema,
            execute: async ({ command, cwd, timeoutMs }) =>
                await params.ctx.runAction(internal.computers_node.executeOnComputer, {
                    userId: params.userSettings.userId,
                    command,
                    cwd,
                    timeoutMs
                })
        }),
        execute_code: tool({
            description: [
                "One-off execution: run JavaScript (Node.js 24) or Python 3.14 in a throwaway Linux sandbox with public internet access. Nothing is kept after the call, so use computer_run on your own computer for work that should last.",
                "When execute_math is also available, prefer execute_math for mathematical, scientific, statistical, unit, data-analysis, and graph-algorithm work covered by its included libraries.",
                "Standard libraries are available; declare third-party npm or PyPI packages in dependencies.",
                "To give the user downloadable files, write them under the directory in SILKCHAT_ARTIFACT_DIR. Supported outputs include PDF, CSV/TSV, JSON/text/Markdown, XLSX/DOCX/PPTX, ZIP, SQLite, Parquet, PNG, JPEG, and WebP. Do not print binary data or base64.",
                "Successful artifacts are attached to the response automatically. Refer to them by filename in prose. If a Markdown link is genuinely useful, copy the artifact's returned HTTPS url exactly; never link to a sandbox:, file:, /vercel/sandbox, or other local path."
            ].join("\n"),
            inputSchema: codeExecutionInputSchema,
            execute: async ({ language, code, dependencies, timeoutMs }) =>
                await params.ctx.runAction(internal.lib.tools.code_execution_node.executeCode, {
                    userId: params.userSettings.userId,
                    language,
                    code,
                    dependencies,
                    timeoutMs
                })
        })
    }
}
