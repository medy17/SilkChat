import {
    type PrivateViewingOverride,
    getIsImageHidden,
    getNextPrivateViewingOverride
} from "@/lib/private-viewing"
import { describe, expect, it } from "vitest"

describe("private-viewing helpers", () => {
    it("hides images by default when private viewing is enabled", () => {
        expect(
            getIsImageHidden({
                privateViewingEnabled: true
            })
        ).toBe(true)
    })

    it("allows a visible override to reveal one image while private viewing is enabled", () => {
        expect(
            getIsImageHidden({
                privateViewingEnabled: true,
                override: "visible"
            })
        ).toBe(false)
    })

    it("allows a hidden override to keep one image private while the global setting is off", () => {
        expect(
            getIsImageHidden({
                privateViewingEnabled: false,
                override: "hidden"
            })
        ).toBe(true)
    })

    it("drops the override when toggling back to the global default", () => {
        expect(
            getNextPrivateViewingOverride({
                privateViewingEnabled: true,
                override: "visible"
            })
        ).toBeUndefined()

        expect(
            getNextPrivateViewingOverride({
                privateViewingEnabled: false,
                override: "hidden"
            })
        ).toBeUndefined()
    })

    it("creates the inverse override when toggling away from the global default", () => {
        expect(
            getNextPrivateViewingOverride({
                privateViewingEnabled: true
            })
        ).toBe("visible" satisfies PrivateViewingOverride)

        expect(
            getNextPrivateViewingOverride({
                privateViewingEnabled: false
            })
        ).toBe("hidden" satisfies PrivateViewingOverride)
    })
})
