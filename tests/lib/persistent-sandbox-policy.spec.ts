import { describe, expect, it } from "vitest"
import {
    MAX_PERSISTENT_SANDBOX_LIFETIME_MS,
    isPastPersistentSandboxLifetime
} from "../../convex/lib/persistent_sandbox_policy"

describe("persistent sandbox hard lifetime", () => {
    it("forces cleanup at 30 minutes regardless of the requested expiry", () => {
        const now = 2_000_000_000

        expect(
            isPastPersistentSandboxLifetime(now - MAX_PERSISTENT_SANDBOX_LIFETIME_MS + 1, now)
        ).toBe(false)
        expect(isPastPersistentSandboxLifetime(now - MAX_PERSISTENT_SANDBOX_LIFETIME_MS, now)).toBe(
            true
        )
        expect(
            isPastPersistentSandboxLifetime(now - MAX_PERSISTENT_SANDBOX_LIFETIME_MS - 1, now)
        ).toBe(true)
    })
})
