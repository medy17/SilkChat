import { describe, expect, it } from "vitest"
import {
    INACTIVITY_NOTICE_MONTHS,
    getInactiveAccountCutoff
} from "../../convex/lib/account_activity"

describe("inactive account notice timing", () => {
    it("uses a 24-month authenticated-inactivity cutoff", () => {
        const now = Date.UTC(2026, 6, 24, 12, 30)

        expect(INACTIVITY_NOTICE_MONTHS).toBe(24)
        expect(getInactiveAccountCutoff(now)).toBe(Date.UTC(2024, 6, 24, 12, 30))
    })
})
