import { resolveToolCallLimitPerTurn } from "@/lib/tool-call-limit"
import { describe, expect, it } from "vitest"

describe("resolveToolCallLimitPerTurn", () => {
    it("raises a low saved limit for one retry without lowering higher preferences", () => {
        expect(
            resolveToolCallLimitPerTurn({
                configuredValue: 1,
                retryFloor: 3,
                hasEnabledTools: true
            })
        ).toBe(3)
        expect(
            resolveToolCallLimitPerTurn({
                configuredValue: 7,
                retryFloor: 3,
                hasEnabledTools: true
            })
        ).toBe(7)
    })

    it("does not allocate calls when no executable tools are enabled", () => {
        expect(
            resolveToolCallLimitPerTurn({
                configuredValue: 1,
                retryFloor: 3,
                hasEnabledTools: false
            })
        ).toBe(0)
    })
})
