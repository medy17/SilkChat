import { createOpenRouter } from "@openrouter/ai-sdk-provider"
import { generateText } from "ai"
import { describe, expect, it, vi } from "vitest"
import { getNativeChartTool, getNativeNetworkTool } from "../../convex/lib/tools/native_chart"

describe("OpenRouter strict tools", () => {
    it.each([false, true])(
        "selects the chart wire contract with useStrictCharts=%s independently of provider strict mode",
        async (useStrictCharts) => {
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
                    render_chart: getNativeChartTool({ enabled: true, useStrictCharts })
                        .render_chart!,
                    render_network: getNativeNetworkTool({ enabled: true, strict: true })
                        .render_network!
                }
            })

            expect(fetchMock).toHaveBeenCalledOnce()
            expect(requestBody).toMatchObject({
                tools: [
                    {
                        type: "function",
                        function: {
                            name: "render_chart",
                            parameters: {
                                required: expect.arrayContaining(["series", "data"])
                            }
                        }
                    },
                    {
                        type: "function",
                        function: {
                            name: "render_network",
                            strict: true
                        }
                    }
                ]
            })
            const chart = (
                requestBody?.tools as Array<{
                    function: {
                        strict?: boolean
                        parameters: { properties: Record<string, unknown>; required: string[] }
                    }
                }>
            )[0].function
            expect(chart.strict).toBeUndefined()
            expect([...chart.parameters.required].sort()).toEqual(
                useStrictCharts
                    ? Object.keys(chart.parameters.properties).sort()
                    : ["title", "type", "xKey", "series", "data"].sort()
            )
        }
    )
})
