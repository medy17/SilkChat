import { deriveMessageFooterStats } from "@/lib/message-footer-stats"
import { describe, expect, it } from "vitest"

describe("deriveMessageFooterStats", () => {
    it("derives totals and generation speed from raw usage metadata", () => {
        expect(
            deriveMessageFooterStats({
                promptTokens: 757,
                completionTokens: 159,
                reasoningTokens: 76,
                serverDurationMs: 2500,
                timeToFirstVisibleMs: 500
            })
        ).toMatchObject({
            promptTokens: 757,
            completionTokens: 159,
            reasoningTokens: 76,
            regularOutputTokens: 83,
            totalTokens: 916,
            tokensPerSecond: 79.5
        })
    })

    it("ignores invalid metrics instead of exposing misleading footer stats", () => {
        expect(
            deriveMessageFooterStats({
                promptTokens: -1,
                completionTokens: Number.NaN,
                reasoningTokens: 0,
                serverDurationMs: Number.POSITIVE_INFINITY,
                timeToFirstVisibleMs: -20
            })
        ).toMatchObject({
            promptTokens: undefined,
            completionTokens: undefined,
            reasoningTokens: undefined,
            totalTokens: undefined,
            tokensPerSecond: undefined,
            timeToFirstVisibleMs: undefined
        })
    })
})
