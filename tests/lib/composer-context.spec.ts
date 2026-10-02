import { expect, it } from "vitest"
import type { SharedModel } from "@/convex/lib/models"
import { predictComposerContextRouting, resolveByokContextHint } from "@/lib/composer-context"

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
    attachments: [],
    tokenCounts: {},
    imageDimensions: {},
    messages: [],
    openRouterByokEnabled: false
}

it("distinguishes draft and conversation overages without nudging users who have no BYOK", () => {
    const text = "word ".repeat(4_000)
    const draft = predictComposerContextRouting({ ...input, text })
    expect(draft).toMatchObject({ reason: "message", exceedsModelLimit: false })
    expect(resolveByokContextHint(draft)).toBeUndefined()
    const thread = predictComposerContextRouting({
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

it("does not count cached image bytes as text or predict routing for other providers", () => {
    expect(
        predictComposerContextRouting({
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
        predictComposerContextRouting({
            ...input,
            text: "word ".repeat(100_000),
            model: { ...input.model, adapters: ["other:test"] } as SharedModel
        })
    ).toBeNull()
})
