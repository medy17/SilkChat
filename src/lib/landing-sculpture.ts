export type SculptureKind = "conversation" | "source"

export const SOURCE_BRACE_PATH =
    "M125 24H103C78 24 66 38 66 62V99C66 120 56 135 35 138V162C56 165 66 180 66 201V238C66 262 78 276 103 276H125V248H107C98 248 95 244 95 234V198C95 175 88 159 75 150C88 141 95 125 95 102V66C95 56 98 52 107 52H125Z"

export function sculpturePose(kind: SculptureKind, progress: number) {
    const p = Math.max(0, Math.min(1, progress))
    // Source braces use visual-center progress: finish at center, hold 8vh,
    // then exit. The hero retains its separate opening timeline.
    const arrivalEnd = kind === "source" ? 0.5 : 0.35
    const exitStart = kind === "source" ? 0.6 : 0.75
    const arrival = Math.min(1, p / arrivalEnd)
    const exit = Math.max(0, (p - exitStart) / (1 - exitStart))
    return {
        x: -0.22 + arrival * 0.15 + exit * 0.06,
        y: -0.65 + arrival * 0.8 + exit * 0.25,
        z: 0.1 - arrival * 0.1 - exit * 0.06,
        spread: kind === "source" ? 0.05 + arrival * 0.4 : (1 - arrival) * 0.34,
        scale: 0.92 + arrival * 0.08 - exit * 0.05
    }
}
