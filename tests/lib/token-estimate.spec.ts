import { describe, expect, it } from "vitest"
import { estimateTokenCount } from "../../src/lib/file_constants"

describe("estimateTokenCount", () => {
    it("counts plain English prose like OpenAI's o200k, about a token per word", () => {
        // o200k splits this into 12 tokens: 11 words and the full stop.
        const text = "This is a normal English sentence with a few ordinary words."

        expect(estimateTokenCount(text)).toBeGreaterThanOrEqual(11)
        expect(estimateTokenCount(text)).toBeLessThanOrEqual(13)
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
