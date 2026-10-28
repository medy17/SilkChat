import type { ChatErrorDetail, ProviderErrorCategory, ProviderKeySource } from "./errors"

export type ProviderErrorDetail = Extract<ChatErrorDetail, { kind: "provider_error" }>

export type ProviderErrorSource = {
    keySource: ProviderKeySource
    /** Shown on BYOK so the user knows which of their accounts to look at. */
    providerName?: string
}

/** Categories that describe SilkChat's own upstream account. Users can't act on these. */
const HOSTED_OPERATIONAL_CATEGORIES = new Set<ProviderErrorCategory>([
    "insufficient_credits",
    "invalid_key",
    "network"
])

const MAX_PROVIDER_MESSAGE_LENGTH = 500

const CONTEXT_OVERFLOW_PATTERN =
    /context (length|window)|maximum context|too many tokens|prompt is too long|input is too long/i

const asRecord = (value: unknown): Record<string, unknown> | null =>
    value && typeof value === "object" ? (value as Record<string, unknown>) : null

/** The AI SDK wraps exhausted retries in a RetryError; the last attempt holds the real failure. */
const unwrapRetryError = (error: unknown): unknown => {
    const record = asRecord(error)
    if (record && Array.isArray(record.errors) && record.lastError) {
        return unwrapRetryError(record.lastError)
    }
    return error
}

/**
 * APICallError carries `statusCode`. OpenRouter's mid-stream errors arrive as a
 * plain `{ code, message }` object instead, with the HTTP status as the code.
 */
const readStatusCode = (error: unknown): number | undefined => {
    const record = asRecord(error)
    if (!record) return undefined
    if (typeof record.statusCode === "number") return record.statusCode

    const code = record.code ?? asRecord(record.error)?.code
    const numeric =
        typeof code === "number"
            ? code
            : typeof code === "string" && /^\d{3}$/.test(code)
              ? Number(code)
              : undefined
    return numeric !== undefined && numeric >= 400 && numeric < 600 ? numeric : undefined
}

const readMessage = (error: unknown): string | undefined => {
    if (typeof error === "string") return error
    const record = asRecord(error)
    if (!record) return undefined
    if (typeof record.message === "string" && record.message) return record.message
    const nested = asRecord(record.error)
    return typeof nested?.message === "string" ? nested.message : undefined
}

const readRetryAfterSeconds = (error: unknown): number | undefined => {
    const headers = asRecord(asRecord(error)?.responseHeaders)
    const value = headers?.["retry-after"]
    const seconds = typeof value === "string" ? Number(value) : Number.NaN
    return Number.isFinite(seconds) && seconds > 0 ? Math.ceil(seconds) : undefined
}

/** The SDK reports failed fetches as a status-less APICallError ("Cannot connect to API: ..."). */
const isNetworkFailure = (error: unknown, message: string | undefined) => {
    const record = asRecord(error)
    if (message?.startsWith("Cannot connect to API")) return true
    return record?.name === "TypeError" && /fetch/i.test(message ?? "")
}

const categorize = (
    statusCode: number | undefined,
    message: string | undefined,
    error: unknown,
    source: ProviderErrorSource
): ProviderErrorCategory => {
    if (statusCode === undefined) {
        return isNetworkFailure(error, message) ? "network" : "unknown"
    }
    if (statusCode === 402) return "insufficient_credits"
    if (statusCode === 401) return "invalid_key"
    // OpenRouter uses 403 for moderation flags. Elsewhere it means the key lacks access.
    if (statusCode === 403) {
        return source.keySource === "hosted" || source.providerName === "OpenRouter"
            ? "moderation"
            : "invalid_key"
    }
    if (statusCode === 429) return "rate_limited"
    if (statusCode === 408 || statusCode === 504 || statusCode === 524) return "timeout"
    if (statusCode === 413) return "context_overflow"
    if (statusCode >= 500) return "provider_unavailable"
    if (message && CONTEXT_OVERFLOW_PATTERN.test(message)) return "context_overflow"
    return "invalid_request"
}

/**
 * Turn an upstream provider failure into a detail that's safe to show. Hosted
 * errors drop the upstream wording and hide SilkChat's account problems; BYOK
 * errors keep both, since the user owns that account and can fix it.
 */
export const classifyProviderError = (
    error: unknown,
    source: ProviderErrorSource
): ProviderErrorDetail => {
    const upstream = unwrapRetryError(error)
    const statusCode = readStatusCode(upstream)
    const message = readMessage(upstream)?.trim()
    const category = categorize(statusCode, message, upstream, source)
    const retryAfterSeconds = readRetryAfterSeconds(upstream)

    if (source.keySource === "hosted") {
        return {
            kind: "provider_error",
            category: HOSTED_OPERATIONAL_CATEGORIES.has(category)
                ? "provider_unavailable"
                : category,
            keySource: "hosted",
            ...(retryAfterSeconds ? { retryAfterSeconds } : {})
        }
    }

    return {
        kind: "provider_error",
        category,
        keySource: "byok",
        ...(source.providerName ? { providerName: source.providerName } : {}),
        ...(statusCode ? { statusCode } : {}),
        ...(message ? { providerMessage: message.slice(0, MAX_PROVIDER_MESSAGE_LENGTH) } : {}),
        ...(retryAfterSeconds ? { retryAfterSeconds } : {})
    }
}

const formatWait = (seconds: number | undefined) =>
    seconds
        ? `Try again in ${seconds} second${seconds === 1 ? "" : "s"}`
        : "Wait a moment and try again"

/** User-facing title and description for a provider error, per key source. */
export const getProviderErrorCopy = (
    detail: ProviderErrorDetail
): { title: string; description: string } => {
    const byok = detail.keySource === "byok"
    const provider = detail.providerName ?? "Your provider"
    const providerInline = detail.providerName ?? "your provider"

    switch (detail.category) {
        case "insufficient_credits":
            return {
                title: `Not enough ${detail.providerName ?? "provider"} credits`,
                description: `Your ${detail.providerName ?? "provider"} account can't cover this request. Add credits there or pick a cheaper model.`
            }
        case "invalid_key":
            return {
                title: `${provider} rejected your key`,
                description:
                    "The key may be revoked, mistyped, or missing access to this model. Update it in Providers."
            }
        case "moderation":
            return {
                title: "Message blocked by a safety filter",
                description: byok
                    ? `${provider} flagged this message. Rephrase it or try a different model.`
                    : "The model's provider flagged this message. Rephrase it or try a different model."
            }
        case "rate_limited":
            return byok
                ? {
                      title: `${provider} is rate-limiting your key`,
                      description: `${formatWait(detail.retryAfterSeconds)}, or check your plan's limits with ${providerInline}.`
                  }
                : {
                      title: "This model is busy",
                      description: `Too many requests are reaching this model right now. ${formatWait(detail.retryAfterSeconds)}, or pick another model.`
                  }
        case "timeout":
            return {
                title: "The model took too long to respond",
                description:
                    "The provider didn't answer in time. Try again, or pick a faster model."
            }
        case "context_overflow":
            return {
                title: "This thread is too long",
                description:
                    "The model can't fit this conversation. Edit your message, start a new chat, or pick a model with a longer context."
            }
        case "invalid_request":
            return byok
                ? {
                      title: `${provider} rejected this request`,
                      description:
                          "The model ID or one of the request settings may not be supported by your provider."
                  }
                : {
                      title: "The model couldn't process this request",
                      description:
                          "Something in this request wasn't accepted, often an attachment or setting the model doesn't support. Try again or pick another model."
                  }
        case "provider_unavailable":
            return byok
                ? {
                      title: `${provider} is having trouble`,
                      description:
                          "The provider returned a server error. Try again shortly or pick another model."
                  }
                : {
                      title: "This model is unavailable right now",
                      description:
                          "Its provider is having trouble. Try again shortly or pick another model."
                  }
        case "network":
            return {
                title: `Couldn't reach ${providerInline}`,
                description:
                    "Check that the endpoint URL is correct and the server is running, then try again."
            }
        default:
            return {
                title: "Something went wrong",
                description: byok
                    ? `${provider} returned an unexpected error. Please try again.`
                    : "The response stopped unexpectedly. Please try again."
            }
    }
}

/**
 * The `{ code, message, detail }` body the chat stream sends as `errorText` and
 * persists as an error part. `message` is plain copy so older clients still read well.
 */
export const buildProviderErrorPayload = (error: unknown, source: ProviderErrorSource) => {
    const detail = classifyProviderError(error, source)
    return {
        code: "provider_error",
        message: getProviderErrorCopy(detail).description,
        detail
    }
}
