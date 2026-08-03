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
        (ability !== "web_search" &&
            ability !== "code_execution" &&
            ability !== "supermemory" &&
            ability !== "mcp") ||
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
