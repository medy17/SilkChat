import { describe, expect, it, vi } from "vitest"
import { getOrThrowUserIdentity, getUserIdentity } from "../../convex/lib/identity"

describe("getUserIdentity", () => {
    it("prefers the legacy userId claim when present", async () => {
        const auth = {
            getUserIdentity: vi.fn().mockResolvedValue({
                subject: "auth-user-1",
                userId: "legacy-user-1",
                isAnonymous: false
            })
        }

        const result = await getUserIdentity(auth as never, { allowAnons: false })

        expect(result).toEqual({
            subject: "auth-user-1",
            userId: "legacy-user-1",
            isAnonymous: false,
            id: "legacy-user-1",
            authId: "auth-user-1"
        })
    })

    it("falls back to the auth subject when no legacy userId claim exists", async () => {
        const auth = {
            getUserIdentity: vi.fn().mockResolvedValue({
                subject: "auth-user-2",
                isAnonymous: false
            })
        }

        const result = await getUserIdentity(auth as never, { allowAnons: false })

        expect(result).toEqual({
            subject: "auth-user-2",
            isAnonymous: false,
            id: "auth-user-2",
            authId: "auth-user-2"
        })
    })

    it("throws for unauthorized users in the strict helper", async () => {
        const auth = {
            getUserIdentity: vi.fn().mockResolvedValue(null)
        }

        await expect(getOrThrowUserIdentity(auth as never, { allowAnons: false })).rejects.toThrow(
            "Unauthorized"
        )
    })
})
