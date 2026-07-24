import { describe, expect, it } from "vitest"
import {
    createDefaultEmailIdempotencyKey,
    resolveEmailIdempotencyKey
} from "../../src/lib/email-idempotency"

const email = {
    from: "noreply@silkchat.dev",
    to: "person@example.com",
    subject: "Your account export is ready",
    html: "<p>Your export is ready.</p>",
    text: "Your export is ready."
}

describe("email idempotency", () => {
    it("derives the same bounded key for identical email payloads", () => {
        const first = createDefaultEmailIdempotencyKey(email)
        const retry = createDefaultEmailIdempotencyKey({ ...email })

        expect(retry).toBe(first)
        expect(first).toMatch(/^email\/[a-f0-9]{64}$/)
    })

    it("uses a different default key when the provider payload changes", () => {
        expect(
            createDefaultEmailIdempotencyKey({
                ...email,
                subject: "A different email"
            })
        ).not.toBe(createDefaultEmailIdempotencyKey(email))
    })

    it("preserves an explicit operation key across rendered payload changes", () => {
        expect(
            resolveEmailIdempotencyKey({
                ...email,
                html: "<p>Updated rendering.</p>",
                idempotencyKey: "account-export/job-1"
            })
        ).toBe("account-export/job-1")
    })
})
