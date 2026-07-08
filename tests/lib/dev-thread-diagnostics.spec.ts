import { describe, expect, it } from "vitest"

import { type DiagMessage, computeThreadStats } from "@/lib/dev-thread-diagnostics"

describe("computeThreadStats", () => {
    it("counts messages by role, buckets attachments, and sums canonical tokens/cost", () => {
        const messages: DiagMessage[] = [
            {
                role: "user",
                parts: [
                    { type: "text", text: "hello there, please review these" },
                    { type: "file", filename: "spec.pdf", mediaType: "application/pdf" },
                    { type: "file", filename: "diagram.png", mediaType: "image/png" },
                    { type: "file", filename: "main.ts", mediaType: "text/plain" },
                    { type: "file", filename: "archive.zip", mediaType: "application/zip" }
                ]
            },
            {
                role: "assistant",
                parts: [{ type: "text", text: "Here is the review of your files." }],
                metadata: {
                    promptTokens: 1200,
                    completionTokens: 300,
                    estimatedCostUsd: 0.0025
                }
            },
            {
                role: "assistant",
                parts: [{ type: "text", text: "One more note." }],
                metadata: { promptTokens: 1500, completionTokens: 120, estimatedCostUsd: 0.0031 }
            }
        ]

        const stats = computeThreadStats(messages)

        expect(stats.messages).toBe(3)
        expect(stats.userMessages).toBe(1)
        expect(stats.assistantMessages).toBe(2)

        expect(stats.attachments).toEqual({
            total: 4,
            pdf: 1,
            image: 1,
            textCode: 1,
            other: 1
        })

        expect(stats.canonicalInputTokens).toBe(2700)
        expect(stats.canonicalOutputTokens).toBe(420)
        expect(stats.canonicalTotalTokens).toBe(3120)
        expect(stats.totalCostUsd).toBeCloseTo(0.0056, 6)

        // The most recent assistant turn's prompt size drives "tokens until limit".
        expect(stats.lastCanonicalPromptTokens).toBe(1500)

        // Estimator counts text content, split by role; both sides are positive here.
        expect(stats.estimatorInputTokens).toBeGreaterThan(0)
        expect(stats.estimatorOutputTokens).toBeGreaterThan(0)
        expect(stats.estimatorTotalTokens).toBe(
            stats.estimatorInputTokens + stats.estimatorOutputTokens
        )
    })

    it("ignores malformed token metadata and handles an empty thread", () => {
        expect(computeThreadStats([]).canonicalTotalTokens).toBe(0)

        const stats = computeThreadStats([
            {
                role: "assistant",
                parts: [{ type: "text", text: "hi" }],
                metadata: { promptTokens: -5, completionTokens: Number.NaN }
            }
        ])
        expect(stats.canonicalInputTokens).toBe(0)
        expect(stats.canonicalOutputTokens).toBe(0)
        expect(stats.assistantMessages).toBe(1)
        expect(stats.lastCanonicalPromptTokens).toBeNull()
    })
})
