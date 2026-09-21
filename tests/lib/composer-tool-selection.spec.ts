import { describe, expect, it } from "vitest"
import { filterComposerTools } from "../../src/lib/composer-tool-selection"
import type { ResolvedToolAvailabilityMap } from "../../convex/lib/tools/availability"
import type { AbilityId } from "../../src/lib/tool-abilities"

const availability: ResolvedToolAvailabilityMap = {
    web_search: { enabled: true, fundingSource: "deployment" },
    code_execution: { enabled: false, fundingSource: "none" },
    mathematical_instruments: { enabled: true, fundingSource: "none" },
    supermemory: { enabled: true, fundingSource: "deployment" }
}

describe("composer tool availability", () => {
    it("preserves saved choices until both availability and model metadata are loaded", () => {
        const saved: AbilityId[] = ["web_search", "code_execution"]
        expect(filterComposerTools(saved, null, true)).toBe(saved)
        expect(filterComposerTools(saved, availability, undefined)).toBe(saved)
        expect(filterComposerTools(saved, availability, true)).toEqual(["web_search"])
        expect(filterComposerTools(saved, availability, false)).toEqual([])
    })
})
