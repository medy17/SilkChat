import { describe, expect, it } from "vitest"

import { estimateTokenCount } from "@/lib/file_constants"

describe("estimateTokenCount", () => {
    it("keeps ASCII prose near the classic four-character heuristic", () => {
        expect(estimateTokenCount("a".repeat(400))).toBe(100)
    })

    it("does not undercount CJK text as one whitespace-delimited token", () => {
        expect(estimateTokenCount("你好世界".repeat(25))).toBe(100)
    })

    it("counts non-Latin alphabetic text more conservatively than ASCII prose", () => {
        expect(estimateTokenCount("مرحبا".repeat(40))).toBeGreaterThan(80)
    })

    it("bumps emoji and symbol-heavy text", () => {
        expect(estimateTokenCount("🔥".repeat(20))).toBeGreaterThan(20)
    })

    it("bumps long dense tokens such as URLs or encoded blobs", () => {
        const plain = "a".repeat(96)
        const dense = `https://example.com/${"Aa0_".repeat(24)}`

        expect(estimateTokenCount(dense)).toBeGreaterThan(estimateTokenCount(plain))
    })
})
