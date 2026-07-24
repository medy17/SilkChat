import { createHash } from "node:crypto"

export interface EmailIdempotencyInput {
    from: string
    to: string
    subject: string
    html: string
    text?: string
    idempotencyKey?: string
}

const MAX_EMAIL_IDEMPOTENCY_KEY_LENGTH = 256

export const createDefaultEmailIdempotencyKey = ({
    from,
    to,
    subject,
    html,
    text
}: EmailIdempotencyInput) => {
    const payloadHash = createHash("sha256")
        .update(JSON.stringify([from, to, subject, html, text ?? null]))
        .digest("hex")
    return `email/${payloadHash}`
}

export const resolveEmailIdempotencyKey = (input: EmailIdempotencyInput) => {
    if (input.idempotencyKey === undefined) {
        return createDefaultEmailIdempotencyKey(input)
    }

    const key = input.idempotencyKey.trim()
    if (!key || key.length > MAX_EMAIL_IDEMPOTENCY_KEY_LENGTH) {
        throw new Error("Email idempotency key must contain between 1 and 256 characters")
    }
    return key
}
