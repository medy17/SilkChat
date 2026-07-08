import { beforeEach, describe, expect, it } from "vitest"

import {
    REPRO_EVENT_LIMIT,
    type ReproEvent,
    serializeReproBundle,
    useReproRecorderStore
} from "@/lib/dev-repro-recorder"

describe("repro recorder store", () => {
    beforeEach(() => {
        useReproRecorderStore.setState({ recording: false, events: [] })
    })

    it("drops events while not recording and captures them once armed", () => {
        useReproRecorderStore.getState().push("mark", "before")
        expect(useReproRecorderStore.getState().events).toHaveLength(0)

        useReproRecorderStore.getState().setRecording(true)
        useReproRecorderStore.getState().push("route", "/chat")
        useReproRecorderStore.getState().push("error", "boom")

        const events = useReproRecorderStore.getState().events
        expect(events.map((event) => event.type)).toEqual(["route", "error"])
        expect(events.map((event) => event.detail)).toEqual(["/chat", "boom"])
    })

    it("caps the rolling log at the event limit, keeping the newest", () => {
        useReproRecorderStore.getState().setRecording(true)
        for (let index = 0; index < REPRO_EVENT_LIMIT + 25; index += 1) {
            useReproRecorderStore.getState().push("mark", `event-${index}`)
        }

        const events = useReproRecorderStore.getState().events
        expect(events).toHaveLength(REPRO_EVENT_LIMIT)
        expect(events[0].detail).toBe("event-25")
        expect(events[events.length - 1].detail).toBe(`event-${REPRO_EVENT_LIMIT + 24}`)
    })
})

describe("serializeReproBundle", () => {
    it("renders context and a relative timeline", () => {
        const events: ReproEvent[] = [
            { at: 1000, type: "route", detail: "/chat" },
            { at: 2500, type: "error", detail: "Could not find function" }
        ]

        const bundle = serializeReproBundle(events, { plan: "pro", userId: null })

        expect(bundle).toContain("**plan**: pro")
        expect(bundle).toContain("**userId**: none")
        expect(bundle).toContain("## Timeline (2)")
        expect(bundle).toContain("`+0.00s` **route** — /chat")
        expect(bundle).toContain("`+1.50s` **error** — Could not find function")
    })

    it("notes an empty timeline", () => {
        expect(serializeReproBundle([], { route: "/" })).toContain("_No events recorded._")
    })
})
