// @vitest-environment jsdom
import { renderHook } from "@testing-library/react"
import { describe, expect, it, vi } from "vitest"
import { DefaultSettings } from "../../src/lib/default-user-settings"
import {
    getModelRoutingDisabledReason,
    useAvailableModels
} from "../../src/lib/models-providers-shared"
import { buildModelPickerSections } from "../../src/lib/model-picker-data"

vi.mock("../../src/lib/shared-models", () => ({
    useSharedModels: () => ({
        models: [
            {
                id: "model",
                name: "Model",
                adapters: ["openrouter:vendor/model"],
                abilities: [],
                routing: {
                    silkchat: {
                        available: true,
                        fetchedAt: 1,
                        pricing: { inputUsdPer1MTokens: 2, outputUsdPer1MTokens: 4 }
                    },
                    zdr: { available: false, fetchedAt: 1 },
                    floor: { available: true, fetchedAt: 1 }
                }
            }
        ]
    })
}))

describe("routing availability in model menus", () => {
    it("keeps unavailable models in normal and favorite menu sections with a disabled reason", () => {
        const settings = { ...DefaultSettings("user"), modelRouting: "zdr" as const }
        const { result } = renderHook(() => useAvailableModels(settings))
        const { pickerModels, availableModels, currentProviders } = result.current
        expect(availableModels).toEqual([])
        expect(pickerModels).toHaveLength(1)
        expect(getModelRoutingDisabledReason(pickerModels[0])).toBe("No ZDR providers available.")
        const sections = buildModelPickerSections(pickerModels, currentProviders, ["model"])
        expect(sections.flatMap((section) => section.models)).toHaveLength(2)
        expect(
            sections.every((section) =>
                section.models.every((model) => getModelRoutingDisabledReason(model))
            )
        ).toBe(true)
    })

    it("updates prices and re-enables the model after changing modes, even with missing prices", () => {
        const { result, rerender } = renderHook(
            ({ mode }) => useAvailableModels({ ...DefaultSettings("user"), modelRouting: mode }),
            {
                initialProps: { mode: "silkchat" as "silkchat" | "zdr" | "floor" }
            }
        )
        expect(result.current.availableModels[0]).toMatchObject({ inputUsdPer1MTokens: 2 })
        rerender({ mode: "zdr" })
        expect(result.current.availableModels).toEqual([])
        rerender({ mode: "floor" })
        expect(result.current.availableModels).toHaveLength(1)
        expect(result.current.availableModels[0]).toMatchObject({ inputUsdPer1MTokens: undefined })
    })
})
