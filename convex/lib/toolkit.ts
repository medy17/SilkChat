import { ABILITIES, type AbilityId } from "@/lib/tool-abilities"
import type { Tool } from "ai"
import type { GenericActionCtx } from "convex/server"
import type { Infer } from "convex/values"
import type { DataModel } from "../_generated/dataModel"
import type { UserSettings } from "../schema/settings"
import {
    type ResolvedToolAvailabilityMap,
    enforceToolIdentityPolicy,
    resolveToolAvailability,
    sanitizeEnabledTools
} from "./tools/availability"
import { CodeExecutionAdapter } from "./tools/code_execution"
import { ElectricalEngineeringAdapter } from "./tools/electrical_engineering"
import { MCPAdapter } from "./tools/mcp_adapter"
import { NativeChartAdapter } from "./tools/native_chart"
import { SupermemoryAdapter } from "./tools/supermemory"
import { WebSearchAdapter } from "./tools/web_search"

export type ToolAdapter = (params: ConditionalToolParams) => Promise<Partial<Record<string, Tool>>>
export const TOOL_ADAPTERS = [
    WebSearchAdapter,
    CodeExecutionAdapter,
    NativeChartAdapter,
    ElectricalEngineeringAdapter,
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
    settleToolCall?: (params: {
        toolName: string
        toolCallId: string
        settledMicrousd: number
        pricingSource: "sandbox_reported"
    }) => Promise<unknown>
}

const toToolExecutionError = (error: unknown) =>
    error instanceof Error ? error.message : "Unknown error"

const BUDGET_EXEMPT_TOOLS = new Set(["release_persistent_sandbox"])

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
                    if (!BUDGET_EXEMPT_TOOLS.has(toolName)) {
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
                    }

                    try {
                        const result = await toolDefinition.execute?.(input, options as never)
                        if (result && typeof result === "object" && "__toolBilling" in result) {
                            const { __toolBilling, ...publicResult } = result as Record<
                                string,
                                unknown
                            >
                            if (
                                __toolBilling &&
                                typeof __toolBilling === "object" &&
                                controller.settleToolCall
                            ) {
                                const billing = __toolBilling as {
                                    settledMicrousd?: unknown
                                    pricingSource?: unknown
                                }
                                if (
                                    typeof billing.settledMicrousd === "number" &&
                                    billing.pricingSource === "sandbox_reported"
                                ) {
                                    await controller
                                        .settleToolCall({
                                            toolName,
                                            toolCallId,
                                            settledMicrousd: billing.settledMicrousd,
                                            pricingSource: billing.pricingSource
                                        })
                                        .catch((error) =>
                                            console.error("Failed to settle tool call usage", error)
                                        )
                                }
                            }
                            return publicResult
                        }
                        return result
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

export { enforceToolIdentityPolicy, resolveToolAvailability, sanitizeEnabledTools }
export { getDeploymentSearchApiKey } from "./tools/availability"
export type { ResolvedToolAvailabilityMap, ToolFundingSource } from "./tools/availability"
