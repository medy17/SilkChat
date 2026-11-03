import { expect, it } from "vitest"
import type { SharedModel } from "@/convex/lib/models"
import type { UploadedFile } from "@/lib/chat-store"
import type { UIMessage } from "ai"
import {
    combineComposerContextUsage,
    estimateComposerContextUsage,
    estimateComposerDraftTokens,
    estimateComposerThreadContext,
    predictComposerContextRouting,
    resolveByokContextHint,
    resolveContextRing,
    resolveContextRingTone,
    shouldShowContextRing
} from "@/lib/composer-context"

const predict = (
    args: typeof input & Partial<Parameters<typeof estimateComposerContextUsage>[0]>
) =>
    predictComposerContextRouting({
        model: args.model,
        usage: estimateComposerContextUsage(args),
        openRouterByokEnabled: args.openRouterByokEnabled
    })

const input = {
    model: {
        id: "test",
        name: "Test",
        abilities: [],
        adapters: ["openrouter:test"],
        contextLength: 128_000,
        hostedContextLength: 2_000
    } as SharedModel,
    modelId: "test",
    text: "",
    attachments: [] as UploadedFile[],
    tokenCounts: {},
    imageDimensions: {},
    messages: [] as UIMessage[],
    openRouterByokEnabled: false
}

it("distinguishes draft and conversation overages without nudging users who have no BYOK", () => {
    const text = "word ".repeat(4_000)
    const draft = predict({ ...input, text })
    expect(draft).toMatchObject({ reason: "message", exceedsModelLimit: false })
    expect(resolveByokContextHint(draft)).toBeUndefined()
    const thread = predict({
        ...input,
        messages: [{ id: "old", role: "user", parts: [{ type: "text", text }] }]
    })
    expect(thread).toMatchObject({ reason: "thread", estimatedTokens: draft!.estimatedTokens + 4 })
    expect(resolveByokContextHint({ ...draft!, openRouterByokEnabled: true })?.ariaLabel).toBe(
        "Will use your OpenRouter key"
    )
    expect(resolveByokContextHint({ ...draft!, exceedsModelLimit: true })?.ariaLabel).toBe(
        "May exceed the model's context limit"
    )
})

it("warns at the deployment's hosted limit rather than a client-side copy", () => {
    const pricedModel = {
        ...input.model,
        contextLength: 1_000_000,
        hostedContextLength: undefined,
        inputUsdPer1MTokens: 10
    } as SharedModel
    const text = "word ".repeat(150_000)
    expect(predict({ ...input, model: pricedModel, text })).toMatchObject({
        limitTokens: 50_000
    })
    expect(
        predict({
            ...input,
            model: pricedModel,
            text,
            hostedContextPolicy: {
                maxInputCostUsd: 1,
                maxInputTokens: 256_000,
                fallbackInputTokens: 32_000
            }
        })
    ).toMatchObject({ limitTokens: 100_000 })
})

it("does not count cached image bytes as text or predict routing for other providers", () => {
    expect(
        predict({
            ...input,
            attachments: [
                {
                    key: "image",
                    fileName: "image.png",
                    fileType: "image/png",
                    fileSize: 10_000_000,
                    uploadedAt: 1
                }
            ],
            tokenCounts: { image: 1_000_000 },
            imageDimensions: { image: { width: 256, height: 256 } }
        })
    ).toBeNull()
    expect(
        predict({
            ...input,
            text: "word ".repeat(100_000),
            model: { ...input.model, adapters: ["other:test"] } as SharedModel
        })
    ).toBeNull()
})

it("counts the thread from the latest reply's real input instead of re-estimating it", () => {
    const longHistory = "word ".repeat(50_000)
    const messages = [
        { id: "u1", role: "user" as const, parts: [{ type: "text" as const, text: longHistory }] },
        {
            id: "a1",
            role: "assistant" as const,
            parts: [{ type: "text" as const, text: "ok" }],
            metadata: { modelId: "test", contextAnchor: { inputTokens: 1_000 } }
        }
    ]
    const anchored = estimateComposerContextUsage({ ...input, messages })
    const unanchored = estimateComposerContextUsage({
        ...input,
        messages: messages.map(({ metadata: _metadata, ...message }) => message)
    })

    expect(anchored!.usedTokens).toBeGreaterThan(1_000)
    expect(anchored!.usedTokens).toBeLessThan(1_100)
    expect(unanchored!.usedTokens).toBeGreaterThan(10_000)
})

it("fills the ring against the hosted cap, or the model window once the user's key can take over", () => {
    const usage = {
        draftTokens: 10,
        usedTokens: 200_000,
        hostedInputLimit: 256_000,
        modelInputLimit: 933_500,
        family: "o200k" as const,
        anchor: null
    }

    expect(resolveContextRing(usage, false)).toMatchObject({
        limitTokens: 256_000
    })
    expect(resolveContextRing(usage, false)?.fraction).toBeCloseTo(0.78, 2)
    expect(resolveContextRing(usage, true)?.fraction).toBeCloseTo(0.21, 2)
    expect(resolveContextRing(null, false)).toBeNull()
})

it("budgets a custom model with its own window and its provider model's tokenizer", () => {
    // The stand-in the composer gets for a custom model: no adapters, the user's window.
    const customModel = {
        id: "custom-fable",
        name: "Fable 5",
        abilities: [],
        adapters: [],
        contextLength: 1_000_000,
        maxTokens: 16_000
    } as unknown as SharedModel
    const text = "A long note about the transit plan. ".repeat(2_000)

    const asClaude = estimateComposerContextUsage({
        ...input,
        model: customModel,
        modelId: "custom-fable",
        providerModelId: "anthropic/claude-fable-5",
        text
    })
    const unnamed = estimateComposerContextUsage({
        ...input,
        model: customModel,
        modelId: "custom-fable",
        text
    })

    // 1M window, less the 16k output budget and the 5% safety margin.
    expect(asClaude?.modelInputLimit).toBe(934_000)
    // Claude's tokenizer reads the same prose as ~1.6x as many tokens.
    expect(asClaude!.usedTokens / unnamed!.usedTokens).toBeGreaterThan(1.5)
})

it("shows the ring near the limit, always in the nerd footers, and as dev mode says", () => {
    const show = (options: Partial<Parameters<typeof shouldShowContextRing>[0]>) =>
        shouldShowContextRing({ fraction: 0.5, hasByokHint: false, nerdMode: false, ...options })

    expect(show({})).toBe(false)
    expect(show({ fraction: 0.8 })).toBe(true)
    // The key hint already speaks for the request.
    expect(show({ fraction: 0.8, hasByokHint: true })).toBe(false)
    expect(show({ nerdMode: true })).toBe(true)
    expect(show({ fraction: null, nerdMode: true })).toBe(false)
    // New chats wait for the threshold whatever the footer.
    expect(show({ nerdMode: true, isNewChat: true })).toBe(false)
    expect(show({ fraction: 0.8, nerdMode: true, isNewChat: true })).toBe(true)
    // Dev overrides.
    expect(show({ showFromPercent: 40 })).toBe(true)
    expect(show({ visibility: "always", hasByokHint: true })).toBe(true)
    expect(show({ visibility: "always", nerdMode: true, isNewChat: true })).toBe(true)
    expect(show({ fraction: 1.2, visibility: "never" })).toBe(false)
})

it("tones the ring by the highest level reached", () => {
    expect(resolveContextRingTone(50)).toBe("muted")
    expect(resolveContextRingTone(92)).toBe("warning")
    expect(resolveContextRingTone(140)).toBe("destructive")

    // Dev levels may come in any order and add steps.
    const levels = [
        { fromPercent: 95, tone: "destructive" as const },
        { fromPercent: 0, tone: "primary" as const },
        { fromPercent: 60, tone: "foreground" as const }
    ]
    expect(resolveContextRingTone(30, levels)).toBe("primary")
    expect(resolveContextRingTone(70, levels)).toBe("foreground")
    expect(resolveContextRingTone(99, levels)).toBe("destructive")
})

it("adds the separately estimated thread and draft up to the full estimate", () => {
    const messages = [
        {
            id: "u1",
            role: "user" as const,
            parts: [{ type: "text" as const, text: "word ".repeat(500) }]
        }
    ]
    const text = "a draft still being typed"
    const thread = estimateComposerThreadContext({ model: input.model, messages })
    const draftTokens = estimateComposerDraftTokens({
        family: thread!.family,
        modelId: "test",
        text,
        attachments: [],
        tokenCounts: {},
        imageDimensions: {}
    })

    expect(combineComposerContextUsage(thread, draftTokens)).toEqual(
        estimateComposerContextUsage({ ...input, messages, text })
    )
    expect(combineComposerContextUsage(null, draftTokens)).toBeNull()
})
