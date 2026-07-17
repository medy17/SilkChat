import { describe, expect, it } from "vitest"
import {
    PAST_DUE_RENEWAL_DISMISSAL_TTL_MS,
    clearPastDueRenewalDismissal,
    dismissPastDueRenewalNudge,
    shouldShowPastDueRenewalNudge
} from "../../src/lib/past-due-renewal"

const createStorage = (): Storage => {
    const values = new Map<string, string>()
    return {
        get length() {
            return values.size
        },
        clear: () => values.clear(),
        getItem: (key) => values.get(key) ?? null,
        key: (index) => [...values.keys()][index] ?? null,
        removeItem: (key) => values.delete(key),
        setItem: (key, value) => values.set(key, value)
    }
}

describe("past-due renewal dismissal", () => {
    it("only nudges users whose latest subscription is past due", () => {
        const storage = createStorage()

        expect(
            shouldShowPastDueRenewalNudge({
                userId: "user-1",
                status: "past_due",
                subscriptionId: "sub-1",
                storage
            })
        ).toBe(true)
        expect(
            shouldShowPastDueRenewalNudge({
                userId: "user-1",
                status: "active",
                subscriptionId: "sub-1",
                storage
            })
        ).toBe(false)
    })

    it("hides a dismissed incident until its TTL expires", () => {
        const storage = createStorage()
        const now = 1_000

        dismissPastDueRenewalNudge({ userId: "user-1", subscriptionId: "sub-1", now, storage })

        expect(
            shouldShowPastDueRenewalNudge({
                userId: "user-1",
                status: "past_due",
                subscriptionId: "sub-1",
                now: now + PAST_DUE_RENEWAL_DISMISSAL_TTL_MS - 1,
                storage
            })
        ).toBe(false)
        expect(
            shouldShowPastDueRenewalNudge({
                userId: "user-1",
                status: "past_due",
                subscriptionId: "sub-1",
                now: now + PAST_DUE_RENEWAL_DISMISSAL_TTL_MS,
                storage
            })
        ).toBe(true)
    })

    it("shows again for a different subscription or after recovery clears the dismissal", () => {
        const storage = createStorage()
        dismissPastDueRenewalNudge({
            userId: "user-1",
            subscriptionId: "sub-1",
            now: 1_000,
            storage
        })

        expect(
            shouldShowPastDueRenewalNudge({
                userId: "user-1",
                status: "past_due",
                subscriptionId: "sub-2",
                now: 2_000,
                storage
            })
        ).toBe(true)

        clearPastDueRenewalDismissal({ userId: "user-1", storage })
        expect(
            shouldShowPastDueRenewalNudge({
                userId: "user-1",
                status: "past_due",
                subscriptionId: "sub-1",
                now: 2_000,
                storage
            })
        ).toBe(true)
    })
})
