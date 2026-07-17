import { describe, expect, it } from "vitest"
import {
    PRO_WELCOME_ELIGIBILITY_WINDOW_MS,
    dismissProWelcome,
    shouldShowProWelcome
} from "../../src/lib/pro-welcome"

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

describe("Pro subscriber welcome", () => {
    it("shows only for newly created active Pro subscriptions", () => {
        const storage = createStorage()
        const now = 10_000
        const base = {
            userId: "user-1",
            subscriptionId: "sub-1",
            createdAt: 9_000,
            now,
            storage
        }

        expect(shouldShowProWelcome({ ...base, plan: "pro", status: "active" })).toBe(true)
        expect(shouldShowProWelcome({ ...base, plan: "free", status: "active" })).toBe(false)
        expect(shouldShowProWelcome({ ...base, plan: "pro", status: "past_due" })).toBe(false)
        expect(
            shouldShowProWelcome({ ...base, plan: "pro", status: "active", createdAt: undefined })
        ).toBe(false)
    })

    it("does not welcome an old subscriber on a new device or after storage is cleared", () => {
        const now = PRO_WELCOME_ELIGIBILITY_WINDOW_MS + 10_000

        expect(
            shouldShowProWelcome({
                userId: "user-1",
                plan: "pro",
                status: "active",
                subscriptionId: "sub-1",
                createdAt: 10_000,
                now,
                storage: createStorage()
            })
        ).toBe(false)
    })

    it("dismisses permanently for that subscription but welcomes a later new subscription", () => {
        const storage = createStorage()
        dismissProWelcome({ userId: "user-1", subscriptionId: "sub-1", storage })

        expect(
            shouldShowProWelcome({
                userId: "user-1",
                plan: "pro",
                status: "active",
                subscriptionId: "sub-1",
                createdAt: 1_000,
                now: 2_000,
                storage
            })
        ).toBe(false)
        expect(
            shouldShowProWelcome({
                userId: "user-1",
                plan: "pro",
                status: "active",
                subscriptionId: "sub-2",
                createdAt: 2_000,
                now: 3_000,
                storage
            })
        ).toBe(true)
    })
})
