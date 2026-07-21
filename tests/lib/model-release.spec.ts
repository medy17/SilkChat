import type { SharedModel } from "@/convex/lib/models"
import { NEW_MODEL_TIMEFRAME_MS, isNewModelRelease } from "@/lib/model-release"
import { describe, expect, it } from "vitest"

const NOW = Date.parse("2026-07-21T00:00:00.000Z")

const createModel = (overrides: Partial<SharedModel> = {}): SharedModel =>
    ({
        id: "test-model",
        name: "Test Model",
        adapters: ["openrouter:vendor/model"],
        abilities: [],
        ...overrides
    }) as SharedModel

describe("new model releases", () => {
    it("includes recent releases through the configured boundary", () => {
        expect(isNewModelRelease(createModel({ addedOn: "2026-07-20" }), NOW)).toBe(true)
        expect(
            isNewModelRelease(
                createModel({ addedOn: new Date(NOW - NEW_MODEL_TIMEFRAME_MS).toISOString() }),
                NOW
            )
        ).toBe(true)
    })

    it("excludes old, future, invalid, legacy, and custom models", () => {
        expect(isNewModelRelease(createModel({ addedOn: "2026-07-06" }), NOW)).toBe(false)
        expect(isNewModelRelease(createModel({ addedOn: "2026-07-22" }), NOW)).toBe(false)
        expect(isNewModelRelease(createModel({ addedOn: "not-a-date" }), NOW)).toBe(false)
        expect(isNewModelRelease(createModel({}), NOW)).toBe(false)
        expect(isNewModelRelease(createModel({ addedOn: "2026-07-20", legacy: true }), NOW)).toBe(
            false
        )
        expect(
            isNewModelRelease(
                {
                    id: "custom-model",
                    name: "Custom Model",
                    abilities: [],
                    isCustom: true,
                    providerId: "openrouter"
                },
                NOW
            )
        ).toBe(false)
    })

    it("leaves access filtering to the viewer-resolved model list", () => {
        expect(
            isNewModelRelease(createModel({ addedOn: "2026-07-20", requiredRole: "admin" }), NOW)
        ).toBe(true)
    })
})
