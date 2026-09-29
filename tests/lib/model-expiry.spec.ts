import { describe, expect, it } from "vitest"
import { getModelExpiry } from "@/lib/model-expiry"

const now = Date.UTC(2026, 8, 28, 22, 0) // 28 Sep 2026, late in the UTC day

describe("getModelExpiry", () => {
    it("counts down in the final week and flags it as soon", () => {
        expect(getModelExpiry("2026-09-28", now)).toEqual({ label: "Leaves today", isSoon: true })
        expect(getModelExpiry("2026-09-29", now)).toEqual({
            label: "Leaves tomorrow",
            isSoon: true
        })
        expect(getModelExpiry("2026-10-05", now)).toEqual({
            label: "Leaves in 7 days",
            isSoon: true
        })
    })

    it("shows the date when removal is further off", () => {
        const expiry = getModelExpiry("2026-10-20", now)

        expect(expiry?.isSoon).toBe(false)
        expect(expiry?.label).toMatch(/^Leaves /)
        expect(expiry?.label).toContain("20")
        expect(expiry?.label).not.toContain("2026")
    })

    it("returns nothing for past or malformed dates", () => {
        expect(getModelExpiry("2026-09-27", now)).toBeNull()
        expect(getModelExpiry("soon", now)).toBeNull()
    })
})
