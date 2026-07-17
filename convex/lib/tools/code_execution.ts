import { tool } from "ai"
import { z } from "zod"
import { internal } from "../../_generated/api"
import type { ToolAdapter } from "../toolkit"

const DEFAULT_EXECUTION_TIMEOUT_MS = 20_000
const MAX_EXECUTION_TIMEOUT_MS = 30_000

const packageSchema = z
    .string()
    .trim()
    .min(1)
    .max(150)
    .regex(/^[a-zA-Z0-9@._+\-/\[\],=<>!~^]+$/, "Invalid package specifier")
    .refine((value) => !value.startsWith("-"), "Package specifier cannot be an option")

export const CodeExecutionAdapter: ToolAdapter = async (params) => {
    if (!params.enabledTools.includes("code_execution")) return {}
    if (!params.toolAvailability.code_execution.enabled) return {}

    return {
        execute_code: tool({
            description:
                "Execute JavaScript or Python in an isolated ephemeral Linux sandbox with public internet access. Use dependencies for packages that must be installed before execution.",
            inputSchema: z.object({
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
            }),
            execute: async ({ language, code, dependencies, timeoutMs }) =>
                await params.ctx.runAction(internal.lib.tools.code_execution_node.executeCode, {
                    language,
                    code,
                    dependencies,
                    timeoutMs
                })
        })
    }
}
