import { createOpenRouter } from "@openrouter/ai-sdk-provider"
import { generateText } from "ai"
import { describe, expect, it, vi } from "vitest"
import { ANTHROPIC_MODELS } from "../../convex/lib/models/anthropic"
import { isModelSunset } from "../../convex/lib/models/lifecycle"
import { EPHEMERAL_CACHE_CONTROL, withCacheBreakpoint } from "../../convex/lib/prompt_caching"

type WireMessage = {
    role: string
    content: string | Array<{ type: string; cache_control?: unknown }>
    cache_control?: unknown
}

const captureRequestBody = async (run: (fetchMock: typeof fetch) => Promise<unknown>) => {
    let requestBody: Record<string, unknown> | undefined
    const fetchMock = vi.fn(async (_input: string | URL | Request, init?: RequestInit) => {
        requestBody = JSON.parse(String(init?.body)) as Record<string, unknown>

        return new Response(
            JSON.stringify({
                id: "generation-1",
                choices: [
                    {
                        index: 0,
                        finish_reason: "stop",
                        message: { role: "assistant", content: "done" }
                    }
                ],
                usage: { prompt_tokens: 1, completion_tokens: 1, total_tokens: 2 }
            }),
            { status: 200, headers: { "Content-Type": "application/json" } }
        )
    })

    await run(fetchMock)
    return requestBody
}

describe("explicit prompt caching", () => {
    it("closes the stable prefix before the volatile turn context", async () => {
        const body = await captureRequestBody((fetchMock) =>
            generateText({
                model: createOpenRouter({ apiKey: "test-key", fetch: fetchMock }).chat(
                    "anthropic/claude-sonnet-5.5"
                ),
                allowSystemInMessages: true,
                messages: [
                    withCacheBreakpoint({ role: "system", content: "Stable prompt" }),
                    { role: "user", content: "Earlier question" },
                    { role: "assistant", content: "Earlier answer" },
                    withCacheBreakpoint({
                        role: "user",
                        content: [
                            { type: "text", text: "Describe this" },
                            {
                                type: "file",
                                data: new Uint8Array([1, 2, 3]),
                                mediaType: "image/png"
                            }
                        ]
                    }),
                    { role: "system", content: "Volatile turn context" }
                ],
                providerOptions: { openrouter: { cacheControl: EPHEMERAL_CACHE_CONTROL } }
            })
        )

        const messages = body?.messages as WireMessage[]
        const blocks = (index: number) =>
            messages[index].content as Array<{ cache_control?: unknown }>

        expect(body?.cache_control).toEqual(EPHEMERAL_CACHE_CONTROL)
        expect(blocks(0)[0].cache_control).toEqual(EPHEMERAL_CACHE_CONTROL)
        // The marker lands on the trailing image, not the last text part.
        expect(blocks(3).map((block) => block.cache_control)).toEqual([
            undefined,
            EPHEMERAL_CACHE_CONTROL
        ])
        expect(blocks(4)[0].cache_control).toBeUndefined()
        expect(JSON.stringify(messages.slice(1, 3))).not.toContain("cache_control")
    })

    it("keeps the breakpoint when a message ends with a URL-referenced PDF", async () => {
        const body = await captureRequestBody((fetchMock) =>
            generateText({
                model: createOpenRouter({ apiKey: "test-key", fetch: fetchMock }).chat(
                    "anthropic/claude-sonnet-5.5"
                ),
                messages: [
                    withCacheBreakpoint({
                        role: "user",
                        content: [
                            { type: "text", text: "Summarize this" },
                            {
                                type: "file",
                                mediaType: "application/pdf",
                                filename: "report.pdf",
                                data: new URL("https://assets.example.com/report.pdf")
                            }
                        ]
                    })
                ]
            })
        )

        const [message] = body?.messages as WireMessage[]
        // The SDK drops markers on URL documents, so the text part closes the prefix.
        expect(
            (message.content as Array<{ cache_control?: unknown }>).map(
                (block) => block.cache_control
            )
        ).toEqual([EPHEMERAL_CACHE_CONTROL, undefined])
    })

    it("keeps the breakpoint when an edit leaves an empty text part", async () => {
        const body = await captureRequestBody((fetchMock) =>
            generateText({
                model: createOpenRouter({ apiKey: "test-key", fetch: fetchMock }).chat(
                    "anthropic/claude-sonnet-5.5"
                ),
                messages: [
                    withCacheBreakpoint({
                        role: "user",
                        content: [
                            {
                                type: "file",
                                data: new Uint8Array([1, 2, 3]),
                                mediaType: "image/png"
                            },
                            { type: "text", text: "" }
                        ]
                    })
                ]
            })
        )

        const [message] = body?.messages as WireMessage[]
        // The AI SDK drops the empty text part, so the image closes the prefix.
        expect(
            (message.content as Array<{ cache_control?: unknown }>).map(
                (block) => block.cache_control
            )
        ).toEqual([EPHEMERAL_CACHE_CONTROL])
    })

    it("flags every selectable Anthropic model in the registry", () => {
        expect(
            ANTHROPIC_MODELS.filter(
                (model) => !isModelSunset(model) && !model.explicitPromptCaching
            ).map((model) => model.id)
        ).toEqual([])
    })
})
