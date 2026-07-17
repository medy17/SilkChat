import { ABILITIES, type AbilityId } from "@/lib/tool-abilities"
import type { Tool } from "ai"
import type { GenericActionCtx } from "convex/server"
import type { Infer } from "convex/values"
import type { DataModel } from "../_generated/dataModel"
import type { UserSettings } from "../schema/settings"
import {
    type ResolvedToolAvailabilityMap,
    resolveToolAvailability,
    sanitizeEnabledTools
} from "./tools/availability"
import { CodeExecutionAdapter } from "./tools/code_execution"
import { MCPAdapter } from "./tools/mcp_adapter"
import { SupermemoryAdapter } from "./tools/supermemory"
import { WebSearchAdapter } from "./tools/web_search"

export type ToolAdapter = (params: ConditionalToolParams) => Promise<Partial<Record<string, Tool>>>
export const TOOL_ADAPTERS = [
    WebSearchAdapter,
    CodeExecutionAdapter,
    SupermemoryAdapter,
    MCPAdapter
]
export { ABILITIES }
export type { AbilityId }

export type ConditionalToolParams = {
    ctx: GenericActionCtx<DataModel>
    enabledTools: AbilityId[]
    userSettings: Infer<typeof UserSettings>
    toolAvailability: ResolvedToolAvailabilityMap
}

export type ToolCallBudgetController = {
    consumeToolCall: (params: {
        toolName: string
        toolCallId: string
    }) => Promise<{ allowed: boolean; remainingCalls?: number | null }>
}

const toToolExecutionError = (error: unknown) =>
    error instanceof Error ? error.message : "Unknown error"

export const wrapToolsWithExecutionLimits = (
    tools: Record<string, Tool>,
    controller?: ToolCallBudgetController
): Record<string, Tool> => {
    if (!controller) {
        return tools
    }

    return Object.fromEntries(
        Object.entries(tools).map(([toolName, toolDefinition]) => [
            toolName,
            {
                ...toolDefinition,
                execute: async (input: unknown, options: { toolCallId?: string } = {}) => {
                    const toolCallId =
                        typeof options.toolCallId === "string" ? options.toolCallId : toolName
                    const reservation = await controller.consumeToolCall({
                        toolName,
                        toolCallId
                    })

                    if (!reservation.allowed) {
                        return {
                            success: false,
                            code: "tool_budget_exhausted",
                            error: "No remaining tool calls for this turn.",
                            remainingToolCalls: 0
                        }
                    }

                    try {
                        return await toolDefinition.execute?.(input, options as never)
                    } catch (error) {
                        return {
                            success: false,
                            code: "tool_execution_failed",
                            error: toToolExecutionError(error)
                        }
                    }
                }
            } satisfies Tool
        ])
    )
}

export const getToolkit = async (
    ctx: GenericActionCtx<DataModel>,
    enabledTools: AbilityId[],
    userSettings: Infer<typeof UserSettings>,
    controller?: ToolCallBudgetController
): Promise<Record<string, Tool>> => {
    const toolAvailability = resolveToolAvailability(userSettings)
    const sanitizedEnabledTools = sanitizeEnabledTools(enabledTools, toolAvailability)
    const toolResults = await Promise.all(
        TOOL_ADAPTERS.map((adapter) =>
            adapter({
                ctx,
                enabledTools: sanitizedEnabledTools,
                userSettings,
                toolAvailability
            })
        )
    )

    const tools: Record<string, Tool> = {}
    for (const toolResult of toolResults) {
        for (const [key, value] of Object.entries(toolResult)) {
            if (value) {
                tools[key] = value
            }
        }
    }

    console.log("tools", Object.keys(tools))
    return wrapToolsWithExecutionLimits(tools, controller)
}

export { resolveToolAvailability, sanitizeEnabledTools }
export { getDeploymentSearchApiKey } from "./tools/availability"
export type { ResolvedToolAvailabilityMap, ToolFundingSource } from "./tools/availability"
