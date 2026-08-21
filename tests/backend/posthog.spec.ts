import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { captureServerAiGeneration, captureServerException } from "../../convex/lib/posthog"

describe("PostHog Convex transport", () => {
    const fetchMock = vi.fn()

    beforeEach(() => {
        vi.stubEnv("POSTHOG_PROJECT_TOKEN", "phc_test")
        vi.stubEnv("POSTHOG_HOST", "https://us.i.posthog.com")
        vi.stubEnv("POSTHOG_ENVIRONMENT", "development")
        fetchMock.mockReset().mockResolvedValue(new Response(null, { status: 200 }))
        vi.stubGlobal("fetch", fetchMock)
    })

    afterEach(() => {
        vi.unstubAllEnvs()
        vi.unstubAllGlobals()
    })

    it("sends AI metrics without prompt or response content", async () => {
        await captureServerAiGeneration({
            distinctId: "user-1",
            traceId: "trace-1",
            generationId: "generation-1",
            sessionId: "thread-1",
            model: "gpt-5",
            provider: "openrouter",
            latencyMs: 1250,
            inputTokens: 10,
            outputTokens: 20,
            totalCostUsd: 0.01,
            finishReason: "stop",
            functionName: "chat-generation"
        })

        const [url, request] = fetchMock.mock.calls[0] as [string, RequestInit]
        const payload = JSON.parse(String(request.body))

        expect(url).toBe("https://us.i.posthog.com/batch/")
        expect(payload).toMatchObject({
            api_key: "phc_test",
            batch: [
                {
                    event: "$ai_generation",
                    properties: {
                        distinct_id: "user-1",
                        $ai_trace_id: "trace-1",
                        $ai_generation_id: "generation-1",
                        $ai_input_tokens: 10,
                        $ai_output_tokens: 20
                    }
                }
            ]
        })
        expect(JSON.stringify(payload)).not.toContain('$ai_input"')
        expect(JSON.stringify(payload)).not.toContain("$ai_output_choices")
    })

    it("replaces backend exception messages before sending them", async () => {
        await captureServerException({
            distinctId: "user-1",
            error: new TypeError("private provider response"),
            properties: { surface: "chat_stream" }
        })

        const request = fetchMock.mock.calls[0]?.[1] as RequestInit
        const serializedPayload = String(request.body)
        const payload = JSON.parse(serializedPayload)

        expect(serializedPayload).not.toContain("private provider response")
        expect(payload.batch[0]).toMatchObject({
            event: "$exception",
            properties: {
                distinct_id: "user-1",
                $exception_type: "TypeError",
                $exception_message: "Backend operation failed"
            }
        })
    })
})
