import { describe, expect, it } from "vitest"

import { resolveMultimodalSubmitAction } from "@/lib/multimodal-submit-action"

describe("resolveMultimodalSubmitAction", () => {
    it("returns stop while streaming even when the input is empty", () => {
        expect(resolveMultimodalSubmitAction("streaming", "")).toBe("stop")
    })

    it("returns focus for empty input when not streaming", () => {
        expect(resolveMultimodalSubmitAction("ready", "   ")).toBe("focus")
    })

    it("returns send for non-empty input when not streaming", () => {
        expect(resolveMultimodalSubmitAction("ready", "hello")).toBe("send")
    })
})
