export const DEFAULT_TOOL_CALL_LIMIT_PER_TURN = 3
export const MIN_TOOL_CALL_LIMIT_PER_TURN = 1
export const MAX_TOOL_CALL_LIMIT_PER_TURN = 10

export const clampToolCallLimitPerTurn = (
    value: number | undefined,
    { hasEnabledTools }: { hasEnabledTools: boolean }
) => {
    if (!hasEnabledTools) {
        return 0
    }

    if (!Number.isFinite(value)) {
        return DEFAULT_TOOL_CALL_LIMIT_PER_TURN
    }

    return Math.min(
        MAX_TOOL_CALL_LIMIT_PER_TURN,
        Math.max(MIN_TOOL_CALL_LIMIT_PER_TURN, Math.round(value as number))
    )
}
