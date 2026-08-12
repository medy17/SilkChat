import { createOpenRouter } from "@openrouter/ai-sdk-provider"
import { generateText, tool } from "ai"
import { describe, expect, it, vi } from "vitest"
import { z } from "zod"

describe("OpenRouter strict tools", () => {
    it("forwards AI SDK strict mode in function tool definitions", async () => {
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
                    usage: {
                        prompt_tokens: 1,
                        completion_tokens: 1,
                        total_tokens: 2
                    }
                }),
                { status: 200, headers: { "Content-Type": "application/json" } }
            )
        })
        const openrouter = createOpenRouter({ apiKey: "test-key", fetch: fetchMock })

        await generateText({
            model: openrouter.chat("x-ai/grok-4.6"),
            prompt: "Render a chart.",
            tools: {
                render_chart: tool({
                    strict: true,
                    description: "Render a chart.",
                    inputSchema: z.object({ data: z.array(z.number()) })
                })
            }
        })

        expect(fetchMock).toHaveBeenCalledOnce()
        expect(requestBody).toMatchObject({
            tools: [
                {
                    type: "function",
                    function: {
                        name: "render_chart",
                        strict: true
                    }
                }
            ]
        })
    })
})
