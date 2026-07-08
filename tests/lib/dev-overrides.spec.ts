// @vitest-environment jsdom

import { beforeEach, describe, expect, it } from "vitest"

import {
    resolveDevCapOverride,
    resolveDevReferenceLimit,
    useDevOverridesStore
} from "@/lib/dev-overrides"

describe("dev overrides store", () => {
    beforeEach(() => {
        localStorage.clear()
        useDevOverridesStore.getState().resetOverrides()
    })

    it("defaults every override off / unset", () => {
        const state = useDevOverridesStore.getState()
        expect(state.disableAnimations).toBe(false)
        expect(state.rawMarkdown).toBe(false)
        expect(state.themeAudit).toBe(false)
        expect(state.imageVariantMax).toBeNull()
        expect(state.aspectRatioOverride).toBeNull()
        expect(state.disableImageCompression).toBe(false)
        expect(state.hostedContextLimitOverride).toBeNull()
        expect(state.modelContextLimitOverride).toBeNull()
    })

    it("resetOverrides restores defaults after changes", () => {
        const store = useDevOverridesStore.getState()
        store.setDisableAnimations(true)
        store.setRawMarkdown(true)
        store.setImageVariantMax(6)
        store.setAspectRatioOverride("21:9")

        expect(useDevOverridesStore.getState().disableAnimations).toBe(true)
        expect(useDevOverridesStore.getState().imageVariantMax).toBe(6)

        useDevOverridesStore.getState().resetOverrides()

        const reset = useDevOverridesStore.getState()
        expect(reset.disableAnimations).toBe(false)
        expect(reset.rawMarkdown).toBe(false)
        expect(reset.imageVariantMax).toBeNull()
        expect(reset.aspectRatioOverride).toBeNull()
    })
})

describe("resolveDevCapOverride", () => {
    it("uses the fallback unless overrides are active and a value is set", () => {
        expect(resolveDevCapOverride(false, 8, 1, 1)).toBe(1)
        expect(resolveDevCapOverride(true, null, 1, 1)).toBe(1)
        expect(resolveDevCapOverride(true, 8, 1, 1)).toBe(8)
    })

    it("floors the override (so a cap never drops below the minimum)", () => {
        expect(resolveDevCapOverride(true, 0, 10, 1)).toBe(1)
        expect(resolveDevCapOverride(true, -5, 10, 1)).toBe(1)
    })
})

describe("resolveDevReferenceLimit", () => {
    it("passes through the model base unless an active override replaces it", () => {
        expect(resolveDevReferenceLimit(false, 5, 2)).toBe(2)
        expect(resolveDevReferenceLimit(true, null, 2)).toBe(2)
        expect(resolveDevReferenceLimit(true, 5, 2)).toBe(5)
    })

    it("returns undefined when neither override nor base constrains", () => {
        expect(resolveDevReferenceLimit(false, null, undefined)).toBeUndefined()
        expect(resolveDevReferenceLimit(true, null, undefined)).toBeUndefined()
    })

    it("allows an override of 0 to force a no-references state", () => {
        expect(resolveDevReferenceLimit(true, 0, 4)).toBe(0)
    })
})
