import type { AbilityId } from "@/lib/tool-abilities"
import { type Tool, tool } from "ai"
import type { ResolvedToolAvailabilityMap } from "./availability"
import { codeExecutionInputSchema } from "./code_execution"
import { supermemoryInputSchemas } from "./supermemory"
import { webSearchInputSchema } from "./web_search"

export type BlockedToolReason =
    | "user_disabled"
    | "not_configured"
    | "auth_required"
    | "deployment_unavailable"

type BlockedBuiltinTool = {
    ability: AbilityId
    label: string
    description: string
    inputSchema: Tool["inputSchema"]
}

const BLOCKED_BUILTIN_TOOLS: Record<string, BlockedBuiltinTool> = {
    web_search: {
        ability: "web_search",
        label: "Web search",
        description:
            "Search the web for current information. This tool is currently blocked; calling it records the attempted search but performs no search.",
        inputSchema: webSearchInputSchema
    },
    execute_code: {
        ability: "code_execution",
        label: "Code execution",
        description:
            "Execute JavaScript or Python. This tool is currently blocked; calling it records the proposed execution but runs no code.",
        inputSchema: codeExecutionInputSchema
    },
    get_memory_profile: {
        ability: "supermemory",
        label: "Memory",
        description:
            "Retrieve the user's memory profile. This tool is currently blocked; calling it records the attempt but retrieves nothing.",
        inputSchema: supermemoryInputSchemas.get_memory_profile
    },
    add_memory: {
        ability: "supermemory",
        label: "Memory",
        description:
            "Prepare a memory to save. This tool is currently blocked; calling it records the proposed memory but saves nothing.",
        inputSchema: supermemoryInputSchemas.add_memory
    },
    update_memory: {
        ability: "supermemory",
        label: "Memory",
        description:
            "Prepare a memory update. This tool is currently blocked; calling it records the proposed update but changes nothing.",
        inputSchema: supermemoryInputSchemas.update_memory
    },
    forget_memory: {
        ability: "supermemory",
        label: "Memory",
        description:
            "Prepare removal of a memory. This tool is currently blocked; calling it records the proposed removal but changes nothing.",
        inputSchema: supermemoryInputSchemas.forget_memory
    },
    search_memories: {
        ability: "supermemory",
        label: "Memory",
        description:
            "Search the user's memories. This tool is currently blocked; calling it records the attempted search but retrieves nothing.",
        inputSchema: supermemoryInputSchemas.search_memories
    }
}

export const resolveBlockedBuiltinToolReasons = ({
    requestedTools,
    callableTools,
    toolAvailability,
    isAnonymous
}: {
    requestedTools: AbilityId[]
    callableTools: AbilityId[]
    toolAvailability: ResolvedToolAvailabilityMap
    isAnonymous: boolean
}): Partial<Record<AbilityId, BlockedToolReason>> => {
    const reasons: Partial<Record<AbilityId, BlockedToolReason>> = {}

    for (const ability of ["web_search", "code_execution", "supermemory"] as const) {
        if (callableTools.includes(ability)) continue

        if (ability === "code_execution" && isAnonymous) {
            reasons[ability] = "auth_required"
        } else if (!toolAvailability[ability]?.enabled) {
            reasons[ability] =
                ability === "supermemory" ? "not_configured" : "deployment_unavailable"
        } else if (!requestedTools.includes(ability)) {
            reasons[ability] = "user_disabled"
        }
    }

    return reasons
}

export const getBlockedBuiltinTools = (
    reasons: Partial<Record<AbilityId, BlockedToolReason>>
): Record<string, Tool> =>
    Object.fromEntries(
        Object.entries(BLOCKED_BUILTIN_TOOLS)
            .filter(([, definition]) => reasons[definition.ability] !== undefined)
            .map(([toolName, definition]) => [
                toolName,
                tool({
                    description: definition.description,
                    inputSchema: definition.inputSchema,
                    execute: async () => ({
                        success: false,
                        code: "tool_blocked",
                        reason: reasons[definition.ability],
                        ability: definition.ability,
                        toolName,
                        toolLabel: definition.label
                    })
                })
            ])
    )
