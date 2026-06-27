import { describe, expect, it } from "vitest"
import { estimateTokenCount } from "../../src/lib/file_constants"

describe("estimateTokenCount", () => {
    it("keeps plain ASCII prose close to the legacy characters-over-four estimate", () => {
        const text = "This is a normal English sentence with a few ordinary words."

        expect(estimateTokenCount(text)).toBeGreaterThanOrEqual(Math.ceil(text.length / 4))
        expect(estimateTokenCount(text)).toBeLessThanOrEqual(Math.ceil((text.length / 4) * 1.25))
    })

    it("counts CJK text more conservatively than a character-count estimate", () => {
        const text = "これは日本語の文章です。長い会話でも過小評価しないようにします。"

        expect(estimateTokenCount(text)).toBeGreaterThan(Math.ceil(text.length / 4) * 3)
    })

    it("treats code-like content as denser than comparable prose", () => {
        const prose = "export const value is mentioned in prose but not written as code"
        const code = "export const value = items.map((item) => item.id).join(',')"

        expect(estimateTokenCount(code)).toBeGreaterThan(estimateTokenCount(prose))
    })

    it("handles symbols and emoji pessimistically", () => {
        const text = "ok 🔥✨⚙️💡"

        expect(estimateTokenCount(text)).toBeGreaterThan(Math.ceil(text.length / 4))
    })
})
