import { describe, expect, it } from "vitest"

import { buildProviderErrorPayload, classifyProviderError } from "../../src/lib/provider-errors"

const apiCallError = (statusCode: number, message: string, headers?: Record<string, string>) => ({
    name: "AI_APICallError",
    message,
    statusCode,
    ...(headers ? { responseHeaders: headers } : {})
})

const OPENROUTER_BYOK = { keySource: "byok", providerName: "OpenRouter" } as const
const CREDITS_MESSAGE =
    "This request requires more credits, or fewer max_tokens. You requested up to 64000 tokens, but can only afford 56823."

describe("classifyProviderError", () => {
    it("keeps upstream wording and the real category on BYOK", () => {
        expect(classifyProviderError(apiCallError(402, CREDITS_MESSAGE), OPENROUTER_BYOK)).toEqual({
            kind: "provider_error",
            category: "insufficient_credits",
            keySource: "byok",
            providerName: "OpenRouter",
            statusCode: 402,
            providerMessage: CREDITS_MESSAGE
        })
    })

    it("hides SilkChat's own account problems and upstream wording on hosted", () => {
        for (const error of [
            apiCallError(402, CREDITS_MESSAGE),
            apiCallError(401, "No auth credentials found"),
            { name: "AI_APICallError", message: "Cannot connect to API: fetch failed" }
        ]) {
            expect(classifyProviderError(error, { keySource: "hosted" })).toEqual({
                kind: "provider_error",
                category: "provider_unavailable",
                keySource: "hosted"
            })
        }
    })

    it("reads OpenRouter's mid-stream { code, message } shape and unwraps retry errors", () => {
        const midStream = { code: 502, message: "Upstream provider returned an invalid response" }
        const retry = {
            errors: [apiCallError(500, "first"), apiCallError(429, "Rate limit exceeded")],
            lastError: apiCallError(429, "Rate limit exceeded", { "retry-after": "20" })
        }

        expect(classifyProviderError(midStream, OPENROUTER_BYOK).category).toBe(
            "provider_unavailable"
        )
        expect(classifyProviderError(retry, { keySource: "hosted" })).toMatchObject({
            category: "rate_limited",
            retryAfterSeconds: 20
        })
    })

    it("treats 403 as moderation on OpenRouter but as a key problem on custom endpoints", () => {
        const forbidden = apiCallError(403, "Forbidden")

        expect(classifyProviderError(forbidden, OPENROUTER_BYOK).category).toBe("moderation")
        expect(classifyProviderError(forbidden, { keySource: "hosted" }).category).toBe(
            "moderation"
        )
        expect(
            classifyProviderError(forbidden, { keySource: "byok", providerName: "Azure" }).category
        ).toBe("invalid_key")
    })

    it("separates provider context overflow from other rejected requests", () => {
        const overflow = apiCallError(
            400,
            "This endpoint's maximum context length is 131072 tokens."
        )
        const rejected = apiCallError(400, "tool_choice is not supported for this model")

        expect(classifyProviderError(overflow, OPENROUTER_BYOK).category).toBe("context_overflow")
        expect(classifyProviderError(rejected, OPENROUTER_BYOK).category).toBe("invalid_request")
    })
})

describe("buildProviderErrorPayload", () => {
    it("never puts upstream wording in the hosted message", () => {
        const payload = buildProviderErrorPayload(apiCallError(402, CREDITS_MESSAGE), {
            keySource: "hosted"
        })

        expect(payload.code).toBe("provider_error")
        expect(JSON.stringify(payload)).not.toContain("afford")
    })
})
