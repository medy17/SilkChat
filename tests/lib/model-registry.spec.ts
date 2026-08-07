import { MODELS_SHARED } from "@/convex/lib/models"
import { describe, expect, it } from "vitest"

const textModels = MODELS_SHARED.filter((model) => (model.mode ?? "text") === "text")

describe("text model registry", () => {
    it("gives every text model a non-empty, unique short name", () => {
        const shortNames = textModels.map((model) => model.shortName?.trim())

        expect(shortNames.every(Boolean)).toBe(true)
        expect(new Set(shortNames).size).toBe(shortNames.length)
    })
})
