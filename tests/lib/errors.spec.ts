import { describe, expect, it } from "vitest"

import { ChatError, getMessageByErrorCode, parseChatError } from "@/lib/errors"

describe("ChatError", () => {
    it("returns user-visible error responses for chat/auth/api surfaces", async () => {
        const response = new ChatError("unauthorized:chat", "missing-session").toResponse()

        await expect(response.json()).resolves.toEqual({
            code: "unauthorized:chat",
            message: "You need to sign in to view this chat. Please sign in and try again.",
            cause: "missing-session"
        })
        expect(response.status).toBe(401)
    })

    it("hides database errors behind a generic response", async () => {
        const response = new ChatError("bad_request:database").toResponse()

        await expect(response.json()).resolves.toEqual({
            code: "",
            message: "Something went wrong. Please try again later."
        })
        expect(response.status).toBe(400)
        expect(response.headers.get("Access-Control-Allow-Origin")).toBe("*")
    })
})

describe("parseChatError", () => {
    it("parses the structured JSON body the AI SDK surfaces as an Error message", () => {
        const body = new ChatError("forbidden:chat", "Pro plan required for the selected model.", {
            kind: "plan_required",
            requiredPlan: "pro",
            currentPlan: "free",
            feature: "chat"
        })

        const error = new Error(
            JSON.stringify({
                code: "forbidden:chat",
                message: body.message,
                cause: body.cause,
                detail: body.detail
            })
        )

        expect(parseChatError(error)).toEqual({
            code: "forbidden:chat",
            message: body.message,
            cause: "Pro plan required for the selected model.",
            detail: {
                kind: "plan_required",
                requiredPlan: "pro",
                currentPlan: "free",
                feature: "chat"
            }
        })
    })

    it("parses context-limit details", () => {
        const error = new Error(
            JSON.stringify({
                code: "rate_limit:chat",
                message: "Context limit reached.",
                detail: {
                    kind: "context_limit_exceeded",
                    limitType: "hosted",
                    estimatedTokens: 65000,
                    limitTokens: 64000,
                    modelId: "shared-text",
                    canUseByok: true
                }
            })
        )

        expect(parseChatError(error)).toEqual({
            code: "rate_limit:chat",
            message: "Context limit reached.",
            detail: {
                kind: "context_limit_exceeded",
                limitType: "hosted",
                estimatedTokens: 65000,
                limitTokens: 64000,
                modelId: "shared-text",
                canUseByok: true
            }
        })
    })

    it("falls back to plain text for non-JSON error messages", () => {
        expect(parseChatError(new Error("Failed to fetch the chat response."))).toEqual({
            code: "",
            message: "Failed to fetch the chat response."
        })
    })

    it("returns null when there is no error", () => {
        expect(parseChatError(undefined)).toBeNull()
        expect(parseChatError(null)).toBeNull()
    })
})

describe("getMessageByErrorCode", () => {
    it("maps known codes and falls back safely for unknown ones", () => {
        expect(getMessageByErrorCode("rate_limit:chat")).toBe(
            "You have exceeded your maximum number of messages for the day. Please try again later."
        )
        expect(getMessageByErrorCode("bad_request:stream")).toBe(
            "Something went wrong. Please try again later."
        )
    })
})
