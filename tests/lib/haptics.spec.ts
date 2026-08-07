// @vitest-environment jsdom

import { beforeEach, describe, expect, it, vi } from "vitest"

const actions: unknown[] = []

vi.mock("web-haptics", () => ({
    WebHaptics: class {
        trigger(pattern: unknown) {
            actions.push(["trigger", pattern])
        }

        cancel() {
            actions.push(["cancel"])
        }
    }
}))

import {
    RESPONSE_COMPLETE_PATTERN,
    RESPONSE_START_PATTERN,
    playExpandedImageDismissHaptic,
    playResponseCompleteHaptic,
    playResponseStartHaptic
} from "@/lib/haptics"
import { useHapticsSettingsStore } from "@/lib/haptics-settings-store"

describe("haptics", () => {
    beforeEach(() => {
        actions.length = 0
        useHapticsSettingsStore.setState({ enabled: true })
    })

    it("uses the selected patterns and lets completion override the start pattern", () => {
        playResponseStartHaptic()
        playResponseCompleteHaptic()
        playExpandedImageDismissHaptic()

        expect(actions).toEqual([
            ["trigger", RESPONSE_START_PATTERN],
            ["cancel"],
            ["trigger", RESPONSE_COMPLETE_PATTERN],
            ["trigger", "light"]
        ])
    })

    it("does not trigger haptics when the device preference is disabled", () => {
        useHapticsSettingsStore.setState({ enabled: false })

        playResponseStartHaptic()
        playResponseCompleteHaptic()
        playExpandedImageDismissHaptic()

        expect(
            actions.filter((action) => Array.isArray(action) && action[0] === "trigger")
        ).toEqual([])
    })
})
