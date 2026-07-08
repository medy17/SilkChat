import { create } from "zustand"

/**
 * A small rolling log of what just happened, so a "copy debug bundle" turns into an actual
 * reproduction report: route changes, runtime errors, unhandled rejections, and manual
 * marks. Non-persisted and capped — it's a live recorder, not history.
 */

export type ReproEventType = "route" | "error" | "rejection" | "mark"

export type ReproEvent = {
    at: number
    type: ReproEventType
    detail: string
}

export const REPRO_EVENT_LIMIT = 100

const appendCapped = (events: ReproEvent[], event: ReproEvent): ReproEvent[] => {
    const next = [...events, event]
    return next.length > REPRO_EVENT_LIMIT ? next.slice(next.length - REPRO_EVENT_LIMIT) : next
}

type ReproRecorderState = {
    recording: boolean
    events: ReproEvent[]
    setRecording: (recording: boolean) => void
    push: (type: ReproEventType, detail: string) => void
    clear: () => void
}

export const useReproRecorderStore = create<ReproRecorderState>((set, get) => ({
    recording: false,
    events: [],
    setRecording: (recording) => set({ recording }),
    push: (type, detail) => {
        if (!get().recording) return
        set((state) => ({ events: appendCapped(state.events, { at: Date.now(), type, detail }) }))
    },
    clear: () => set({ events: [] })
}))

export const pushReproEvent = (type: ReproEventType, detail: string) => {
    useReproRecorderStore.getState().push(type, detail)
}

export type ReproBundleMeta = Record<string, unknown>

const formatTimestamp = (at: number) => new Date(at).toISOString()

/**
 * Render the recorded events + a diagnostics snapshot as a pasteable markdown bundle.
 * Pure so it can be unit tested.
 */
export const serializeReproBundle = (events: ReproEvent[], meta: ReproBundleMeta): string => {
    const lines: string[] = ["# Repro bundle", ""]

    lines.push("## Context")
    for (const [key, value] of Object.entries(meta)) {
        lines.push(
            `- **${key}**: ${value === null || value === undefined ? "none" : String(value)}`
        )
    }
    lines.push("")

    lines.push(`## Timeline (${events.length})`)
    if (events.length === 0) {
        lines.push("_No events recorded._")
    } else {
        const start = events[0].at
        for (const event of events) {
            const offset = ((event.at - start) / 1000).toFixed(2)
            lines.push(`- \`+${offset}s\` **${event.type}** — ${event.detail}`)
        }
    }
    lines.push("")

    return lines.join("\n")
}

/**
 * Attach window-level error listeners that feed the recorder. Returns a cleanup function.
 * Route changes are pushed separately by the caller (it owns the router).
 */
export const installReproErrorListeners = (): (() => void) => {
    if (typeof window === "undefined") return () => {}

    const onError = (event: ErrorEvent) => {
        pushReproEvent("error", event.message || String(event.error ?? "Unknown error"))
    }
    const onRejection = (event: PromiseRejectionEvent) => {
        const reason = event.reason
        pushReproEvent(
            "rejection",
            reason instanceof Error ? reason.message : String(reason ?? "Unknown rejection")
        )
    }

    window.addEventListener("error", onError)
    window.addEventListener("unhandledrejection", onRejection)

    return () => {
        window.removeEventListener("error", onError)
        window.removeEventListener("unhandledrejection", onRejection)
    }
}

export { formatTimestamp as formatReproTimestamp }
