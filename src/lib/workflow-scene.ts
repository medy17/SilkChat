// Phase 0 is the article's top at the anchor line; phase 1 is its bottom.
// The anchor is a fraction of the viewport height (0.5 = viewport center);
// sticky stages pass their own center so text lines up with the visual.
// Normalizing by article height keeps crossfades consistent on tall displays.
export function workflowScenePhase(
    scrollProgress: number,
    viewportToSceneRatio: number,
    anchor = 0.5
) {
    return scrollProgress * (1 + viewportToSceneRatio) - viewportToSceneRatio * (1 - anchor)
}

export function workflowObjectOpacity(phase: number) {
    return Math.max(0, Math.min(1, (phase + 0.2) / 0.4, (1.2 - phase) / 0.4))
}
