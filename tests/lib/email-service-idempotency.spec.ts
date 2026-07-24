import { afterAll, beforeEach, describe, expect, it, vi } from "vitest"

const { originalEmailFrom, originalEmailProvider, originalResendApiKey, resendSend } = vi.hoisted(
    () => {
        const originalEmailProvider = process.env.EMAIL_PROVIDER
        const originalEmailFrom = process.env.EMAIL_FROM
        const originalResendApiKey = process.env.RESEND_API_KEY
        process.env.EMAIL_PROVIDER = "resend"
        process.env.EMAIL_FROM = "noreply@silkchat.dev"
        process.env.RESEND_API_KEY = "test-api-key"
        return {
            originalEmailProvider,
            originalEmailFrom,
            originalResendApiKey,
            resendSend: vi.fn()
        }
    }
)

vi.mock("resend", () => ({
    Resend: class {
        emails = { send: resendSend }
    }
}))

vi.mock("../../src/lib/load-server-env", () => ({
    loadServerEnv: vi.fn()
}))

import { sendEmail } from "../../src/lib/email"
import { createDefaultEmailIdempotencyKey } from "../../src/lib/email-idempotency"

beforeEach(() => {
    vi.clearAllMocks()
    resendSend.mockResolvedValue({
        data: { id: "email-1" },
        error: null
    })
})

afterAll(() => {
    if (originalEmailProvider === undefined) Reflect.deleteProperty(process.env, "EMAIL_PROVIDER")
    else process.env.EMAIL_PROVIDER = originalEmailProvider
    if (originalEmailFrom === undefined) Reflect.deleteProperty(process.env, "EMAIL_FROM")
    else process.env.EMAIL_FROM = originalEmailFrom
    if (originalResendApiKey === undefined) Reflect.deleteProperty(process.env, "RESEND_API_KEY")
    else process.env.RESEND_API_KEY = originalResendApiKey
})

describe("email service idempotency", () => {
    it("passes a deterministic default idempotency key to Resend", async () => {
        const message = {
            to: "person@example.com",
            subject: "A transactional email",
            html: "<p>Hello</p>",
            text: "Hello"
        }

        await sendEmail(message)

        expect(resendSend).toHaveBeenCalledWith(
            {
                from: "noreply@silkchat.dev",
                ...message
            },
            {
                idempotencyKey: createDefaultEmailIdempotencyKey({
                    from: "noreply@silkchat.dev",
                    ...message
                })
            }
        )
    })
})
