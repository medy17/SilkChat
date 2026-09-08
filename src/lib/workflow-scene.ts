// Phase 0 is the article's top at the viewport center; phase 1 is its bottom.
// Normalizing by article height keeps crossfades consistent on tall displays.
export function workflowScenePhase(scrollProgress: number, viewportToSceneRatio: number) {
    return scrollProgress * (1 + viewportToSceneRatio) - viewportToSceneRatio / 2
}

export function workflowObjectOpacity(phase: number) {
    return Math.max(0, Math.min(1, (phase + 0.2) / 0.4, (1.2 - phase) / 0.4))
}
