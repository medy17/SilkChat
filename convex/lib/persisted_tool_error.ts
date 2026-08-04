const INVALID_TOOL_INPUT_PATTERN =
    /(?:AI_InvalidToolInputError|Invalid input for tool|Type validation failed|invalid tool input)/i

export type PersistedToolError = {
    kind: "silkchat_tool_error"
    code: "invalid_tool_input" | "tool_execution_failed"
    success: false
}

export const createPersistedToolError = (error: unknown): PersistedToolError => ({
    kind: "silkchat_tool_error",
    code: INVALID_TOOL_INPUT_PATTERN.test(String(error))
        ? "invalid_tool_input"
        : "tool_execution_failed",
    success: false
})

export const getPersistedToolError = (value: unknown): PersistedToolError | null => {
    if (!value || typeof value !== "object" || Array.isArray(value)) return null

    const candidate = value as Partial<PersistedToolError>
    if (
        candidate.kind !== "silkchat_tool_error" ||
        candidate.success !== false ||
        (candidate.code !== "invalid_tool_input" && candidate.code !== "tool_execution_failed")
    ) {
        return null
    }

    return candidate as PersistedToolError
}

export const getPersistedToolErrorText = (error: PersistedToolError, toolName: string) =>
    error.code === "invalid_tool_input"
        ? `Invalid input for tool ${toolName}`
        : `The ${toolName} tool call failed.`
