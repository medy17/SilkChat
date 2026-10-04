import { createOpenRouter } from "@openrouter/ai-sdk-provider"
import { generateText } from "ai"
import { expect, it } from "vitest"
import { getImageSearchTool } from "../../convex/lib/tools/image_search"

it("sends staged search images as vision inputs through the SDK and OpenRouter adapter", async () => {
    const imageUrl = "https://assets.example.com/tool-outputs/owner/image-search/run/1.webp"
    const tool = getImageSearchTool({} as never, "owner", "message" as never).image_search
    const output = await tool.toModelOutput!({
        toolCallId: "search-1",
        input: { query: "Beelzebufo fossil" },
        output: {
            success: true,
            query: "Beelzebufo fossil",
            results: [
                {
                    id: "img_run_1",
                    title: "Fossil",
                    source: "example.com",
                    sourceUrl: "https://example.com/fossil",
                    originalUrl: imageUrl,
                    storageKey: "tool-outputs/owner/image-search/run/1.webp",
                    thumbnailUrl: imageUrl
                }
            ]
        }
    })
    let request: { messages: Array<{ role: string; content: unknown }> } | undefined
    const provider = createOpenRouter({
        apiKey: "test-key",
        fetch: async (_url, init) => {
            request = JSON.parse(String(init?.body))
            return Response.json({
                id: "test",
                choices: [
                    {
                        index: 0,
                        finish_reason: "stop",
                        message: { role: "assistant", content: "Inspected" }
                    }
                ]
            })
        }
    })
    await generateText({
        model: provider.chat("openai/gpt-6.1-sol-20260929"),
        messages: [
            { role: "user", content: "Inspect the fossil image." },
            {
                role: "assistant",
                content: [
                    {
                        type: "tool-call",
                        toolName: "image_search",
                        toolCallId: "search-1",
                        input: { query: "Beelzebufo fossil" }
                    }
                ]
            },
            {
                role: "tool",
                content: [
                    {
                        type: "tool-result",
                        toolName: "image_search",
                        toolCallId: "search-1",
                        output
                    }
                ]
            }
        ]
    })
    const content = request?.messages.find((message) => message.role === "tool")?.content
    expect(content).toEqual([
        { type: "text", text: expect.stringContaining("img_run_1") },
        { type: "text", text: "Candidate img_run_1" },
        { type: "image_url", image_url: { url: imageUrl } }
    ])
})
