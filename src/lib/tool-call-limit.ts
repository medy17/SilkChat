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

export const resolveToolCallLimitPerTurn = ({
    configuredValue,
    retryFloor,
    hasEnabledTools
}: {
    configuredValue?: number
    retryFloor?: number
    hasEnabledTools: boolean
}) =>
    clampToolCallLimitPerTurn(
        Math.max(
            configuredValue ?? DEFAULT_TOOL_CALL_LIMIT_PER_TURN,
            Number.isFinite(retryFloor) ? (retryFloor as number) : 0
        ),
        { hasEnabledTools }
    )
