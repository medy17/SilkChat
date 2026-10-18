/**
 * Applies a Shift-click span from `anchorId` to `targetId` over the visible
 * thread order. The span takes the state the target would toggle to, so a
 * Shift-click on a selected thread clears the span instead of extending it.
 * Returns null when either end isn't visible, so the caller can fall back to
 * a plain toggle.
 */
export function applyThreadRangeSelection({
    orderedThreadIds,
    selectedThreadIds,
    anchorId,
    targetId
}: {
    orderedThreadIds: readonly string[]
    selectedThreadIds: readonly string[]
    anchorId: string
    targetId: string
}): string[] | null {
    const anchorIndex = orderedThreadIds.indexOf(anchorId)
    const targetIndex = orderedThreadIds.indexOf(targetId)
    if (anchorIndex === -1 || targetIndex === -1) return null

    const span = orderedThreadIds.slice(
        Math.min(anchorIndex, targetIndex),
        Math.max(anchorIndex, targetIndex) + 1
    )

    if (selectedThreadIds.includes(targetId)) {
        const spanIds = new Set(span)
        return selectedThreadIds.filter((threadId) => !spanIds.has(threadId))
    }

    return Array.from(new Set([...selectedThreadIds, ...span]))
}
