import { expect, it } from "vitest"
import { getVisualAvailability } from "../../convex/lib/visual_availability"

const configured = {
    abilities: ["vision", "function_calling"],
    isAnonymous: false,
    hasSearchKey: true,
    hasPublicDelivery: true
}

it.each([
    {
        name: "configured vision model",
        input: {},
        expected: { resolveVisuals: true, imageSearch: true }
    },
    {
        name: "no vision",
        input: { abilities: ["function_calling"] },
        expected: { resolveVisuals: true, imageSearch: false }
    },
    {
        name: "no function calling",
        input: { abilities: ["vision"] },
        expected: { resolveVisuals: true, imageSearch: false }
    },
    {
        name: "anonymous user",
        input: { isAnonymous: true },
        expected: { resolveVisuals: false, imageSearch: false }
    },
    {
        name: "no search key",
        input: { hasSearchKey: false },
        expected: { resolveVisuals: false, imageSearch: false }
    },
    {
        name: "no public delivery",
        input: { hasPublicDelivery: false },
        expected: { resolveVisuals: false, imageSearch: false }
    }
])("resolves visual availability for $name", ({ input, expected }) => {
    expect(getVisualAvailability({ ...configured, ...input })).toEqual(expected)
})
