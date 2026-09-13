export type LandingVisualArrival = "with-transition" | "after-transition"

export function landingSceneVisibility(phase: number, viewportToSceneRatio: number) {
    // Text and prop share one envelope. Adjacent compositions never overlap,
    // even when the prop switches sides. Most travel is a readable hold.
    const band = Math.max(0.0001, viewportToSceneRatio * 0.12)
    const ease = (value: number) => {
        const t = Math.max(0, Math.min(1, value))
        return t * t * (3 - 2 * t)
    }
    const opacity = Math.min(ease(phase / band), ease((1 - phase) / band))
    return { visual: opacity, copy: opacity }
}

export function landingVisualProgress(
    phase: number,
    arrival: LandingVisualArrival = "with-transition"
) {
    const stops = arrival === "after-transition" ? [0.15, 0.6, 0.88, 1] : [0, 0.38, 0.88, 1]
    const values = [0, 0.5, 0.6, 1]
    if (phase <= stops[0]) return 0
    for (let index = 1; index < stops.length; index++) {
        if (phase <= stops[index]) {
            const t = (phase - stops[index - 1]) / (stops[index] - stops[index - 1])
            const eased = t * t * (3 - 2 * t)
            return values[index - 1] + (values[index] - values[index - 1]) * eased
        }
    }
    return 1
}

export function landingScrollProgress({
    top,
    height,
    viewport,
    inset,
    mode
}: {
    top: number
    height: number
    viewport: number
    inset: number
    mode: "enter" | "hold" | "pass" | "hero" | "focus" | "scene"
}) {
    if (mode === "scene") return (viewport * 0.25 - top) / Math.max(1, height)
    const available = Math.max(1, viewport - inset)
    if (mode === "focus") {
        // Track the visual's center across the screen: 90% to 10%.
        // Progress 0.5 is screen center; 0.6 leaves an 8vh hold before exit.
        const center = top + height / 2
        return Math.max(0, Math.min(1, (viewport * 0.9 - center) / Math.max(1, viewport * 0.8)))
    }
    // Short natural-flow scenes still get a meaningful interval, rather than
    // dividing by zero when the section fits in the viewport.
    const travel = height > available ? height - available : height * 0.75
    const value =
        mode === "hero"
            ? -top / Math.max(1, height * 0.75)
            : mode === "pass"
              ? (viewport - top) / (available + Math.max(1, height))
              : mode === "hold"
                ? (inset - top) / Math.max(1, travel)
                : (viewport - top) / (available * 0.7)
    return Math.max(0, Math.min(1, value))
}
