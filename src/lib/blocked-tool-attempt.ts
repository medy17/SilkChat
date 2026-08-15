import type { AbilityId } from "@/lib/tool-abilities"
import type { UIMessage } from "ai"

export type BlockedToolReason =
    | "user_disabled"
    | "not_configured"
    | "auth_required"
    | "deployment_unavailable"

export type BlockedToolAttempt = {
    ability: AbilityId
    toolName: string
    toolLabel: string
    reason: BlockedToolReason
    input: unknown
    summary?: string
}

export type MalformedToolAttempt = {
    ability: AbilityId
    toolName: string
    toolLabel: string
    reason: "malformed_tool_call"
    input: unknown
    summary?: string
}

export type ToolFailureAttempt = BlockedToolAttempt | MalformedToolAttempt

type UnknownRecord = Record<string, unknown>

const isRecord = (value: unknown): value is UnknownRecord =>
    typeof value === "object" && value !== null && !Array.isArray(value)

const asTrimmedString = (value: unknown) =>
    typeof value === "string" && value.trim() ? value.trim() : undefined

const summarizeAttempt = (toolName: string, input: unknown) => {
    if (!isRecord(input)) return undefined

    switch (toolName) {
        case "execute_code":
            return (
                asTrimmedString(input.purpose) ??
                (input.language === "python"
                    ? "Run Python code"
                    : input.language === "javascript"
                      ? "Run JavaScript code"
                      : undefined)
            )
        case "web_search":
            return asTrimmedString(input.query)
        case "search_memories":
            return asTrimmedString(input.query)
        case "add_memory":
            return asTrimmedString(input.content)
        case "update_memory":
            return asTrimmedString(input.newContent)
        case "forget_memory":
            return asTrimmedString(input.content)
        case "get_memory_profile":
            return "Retrieve the memory profile"
        default:
            return undefined
    }
}

const BLOCKED_REASONS = new Set<BlockedToolReason>([
    "user_disabled",
    "not_configured",
    "auth_required",
    "deployment_unavailable"
])

const TOOL_PRESENTATION: Record<string, { ability: AbilityId; label: string }> = {
    web_search: { ability: "web_search", label: "Web search" },
    execute_code: { ability: "code_execution", label: "Code execution" },
    execute_math: { ability: "mathematical_instruments", label: "Math execution" },
    render_chart: { ability: "mathematical_instruments", label: "Chart renderer" },
    render_network: { ability: "mathematical_instruments", label: "Network renderer" },
    get_memory_profile: { ability: "supermemory", label: "Memory" },
    add_memory: { ability: "supermemory", label: "Memory" },
    update_memory: { ability: "supermemory", label: "Memory" },
    forget_memory: { ability: "supermemory", label: "Memory" },
    search_memories: { ability: "supermemory", label: "Memory" }
}

const MALFORMED_TOOL_ERROR_PATTERN =
    /(?:AI_InvalidToolInputError|Invalid input for tool|Type validation failed|invalid tool input)/i

const getInvocationToolName = (part: UIMessage["parts"][number] & { toolName?: string }) =>
    asTrimmedString(part.toolName) ?? part.type.replace(/^tool-/, "")

export const getMalformedToolAttempt = (
    part: UIMessage["parts"][number]
): MalformedToolAttempt | null => {
    if (!part.type.startsWith("tool-") && part.type !== "dynamic-tool") return null

    const invocation = part as typeof part & {
        toolName?: string
        input?: unknown
        errorText?: string
    }
    const isLiveMalformedAttempt =
        typeof invocation.errorText === "string" &&
        MALFORMED_TOOL_ERROR_PATTERN.test(invocation.errorText)

    if (!isLiveMalformedAttempt) return null

    const toolName = getInvocationToolName(invocation)
    const presentation = TOOL_PRESENTATION[toolName]
    if (!presentation) return null

    return {
        ability: presentation.ability,
        toolName,
        toolLabel: presentation.label,
        reason: "malformed_tool_call",
        input: invocation.input,
        summary: summarizeAttempt(toolName, invocation.input)
    }
}

export const getBlockedToolAttempt = (
    part: UIMessage["parts"][number]
): BlockedToolAttempt | null => {
    if (!part.type.startsWith("tool-") && part.type !== "dynamic-tool") return null

    const invocation = part as typeof part & {
        toolName?: string
        input?: unknown
        output?: unknown
    }
    if (!isRecord(invocation.output) || invocation.output.code !== "tool_blocked") return null

    const ability = invocation.output.ability
    const reason = invocation.output.reason
    const toolName =
        asTrimmedString(invocation.output.toolName) ??
        asTrimmedString(invocation.toolName) ??
        part.type.replace(/^tool-/, "")
    const toolLabel = asTrimmedString(invocation.output.toolLabel)

    if (
        (ability !== "web_search" && ability !== "code_execution" && ability !== "supermemory") ||
        typeof reason !== "string" ||
        !BLOCKED_REASONS.has(reason as BlockedToolReason) ||
        !toolLabel
    ) {
        return null
    }

    return {
        ability,
        toolName,
        toolLabel,
        reason: reason as BlockedToolReason,
        input: invocation.input,
        summary: summarizeAttempt(toolName, invocation.input)
    }
}

export const getBlockedToolAttempts = (message: Pick<UIMessage, "role" | "parts">) => {
    if (message.role !== "assistant") return []

    return message.parts.flatMap((part) => {
        const attempt = getBlockedToolAttempt(part)
        return attempt ? [attempt] : []
    })
}

export const getToolFailureAttempt = (
    part: UIMessage["parts"][number]
): ToolFailureAttempt | null => getBlockedToolAttempt(part) ?? getMalformedToolAttempt(part)

export const getToolFailureAttempts = (message: Pick<UIMessage, "role" | "parts">) => {
    if (message.role !== "assistant") return []

    return message.parts.flatMap((part) => {
        const attempt = getToolFailureAttempt(part)
        return attempt ? [attempt] : []
    })
}
