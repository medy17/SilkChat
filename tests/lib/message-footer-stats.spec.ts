import {
    deriveMessageFooterStats,
    getMessageFooterBrandProvider,
    isMessageFooterMetadataReady,
    mergeMessageFooterMetadata
} from "@/lib/message-footer-stats"
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

describe("getMessageFooterBrandProvider", () => {
    it("does not assign a vendor brand to custom-provider responses", () => {
        expect(
            getMessageFooterBrandProvider({
                creditProviderSource: "custom",
                displayProvider: "xai",
                runtimeProvider: "custom"
            })
        ).toBeUndefined()
    })

    it("keeps the model brand for hosted and core BYOK responses", () => {
        expect(
            getMessageFooterBrandProvider({
                creditProviderSource: "internal",
                displayProvider: "anthropic",
                runtimeProvider: "openrouter"
            })
        ).toBe("anthropic")
    })
})

describe("isMessageFooterMetadataReady", () => {
    it("waits for final usage before showing a generated-message footer", () => {
        expect(
            isMessageFooterMetadataReady({
                modelId: "openai/gpt-5.4-mini",
                modelName: "GPT 5.4 Mini",
                serverDurationMs: 800,
                timeToFirstVisibleMs: 300
            })
        ).toBe(false)

        expect(
            isMessageFooterMetadataReady({
                modelId: "openai/gpt-5.4-mini",
                modelName: "GPT 5.4 Mini",
                promptTokens: 0,
                completionTokens: 0,
                totalTokens: 0
            })
        ).toBe(true)
    })

    it("keeps model-only footers for imported messages", () => {
        expect(isMessageFooterMetadataReady({ modelName: "Imported model" })).toBe(true)
    })

    it("shows model metadata for a completed generated error", () => {
        expect(
            isMessageFooterMetadataReady(
                {
                    modelId: "openai/gpt-5.4-mini",
                    modelName: "GPT 5.4 Mini"
                },
                { completedWithError: true }
            )
        ).toBe(true)
    })
})

describe("mergeMessageFooterMetadata", () => {
    it("preserves completed metadata across an empty replacement", () => {
        expect(
            mergeMessageFooterMetadata(
                {
                    modelName: "GPT 5.4 Mini",
                    completionTokens: 159,
                    totalTokens: 916,
                    serverDurationMs: 2500
                },
                { serverDurationMs: undefined }
            )
        ).toEqual({
            modelName: "GPT 5.4 Mini",
            completionTokens: 159,
            totalTokens: 916,
            serverDurationMs: 2500
        })
    })

    it("prefers newer defined metadata", () => {
        expect(
            mergeMessageFooterMetadata(
                { serverDurationMs: 1800, completionTokens: 100 },
                { serverDurationMs: 2500, completionTokens: 159 }
            )
        ).toMatchObject({ serverDurationMs: 2500, completionTokens: 159 })
    })
})
