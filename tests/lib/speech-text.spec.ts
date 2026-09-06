import { describe, expect, it } from "vitest"
import {
    getMessageSpeechText,
    speechTextFromMarkdown,
    splitSpeechText
} from "../../src/lib/speech-text"

describe("read-aloud text", () => {
    it("reads inline code and replaces fenced and indented code without exposing their contents", () => {
        const text = speechTextFromMarkdown(
            "Run `bun run test` now.\n\n```ts\nconst secret = 1\n```\n\n    hidden()\n\nDone."
        )
        expect(text).toContain("Run bun run test now.")
        expect(
            text.match(/You can see this code block in our conversation history\./g)
        ).toHaveLength(2)
        expect(text).not.toMatch(/secret|hidden/)
        expect(text).toContain("Done.")
    })

    it("extracts recipes across blank lines with quantities and timer labels", () => {
        const text = speechTextFromMarkdown(`Before.

<recipe servings="2" visual="do not read this">
# Soup

<description>A warm soup.</description>

<ingredients>
- <qty value="2" unit="cup-us">2 cups</qty> water
</ingredients>

<steps>
<step>Simmer for <timer value="PT10M">10 minutes</timer>.<visual>secret visual cue</visual></step>
</steps>

<notes>
Serve warm.
</notes>
</recipe>

After.`)
        expect(text).toContain("Soup")
        expect(text).toContain("Serves 2.")
        expect(text).toContain("2 cups water")
        expect(text).toContain("10 minutes")
        expect(text).toContain("Serve warm.")
        expect(text).toContain("After.")
        expect(text).not.toMatch(/visual|<|>/)
    })

    it("omits charts, tables, reasoning, images and tool results but keeps surrounding prose and link labels", () => {
        const text = getMessageSpeechText([
            { type: "reasoning", text: "private reasoning" },
            { type: "tool-render_chart", text: "secret data" },
            {
                type: "text",
                text: "See [the guide](https://example.com).\n\n| A | B |\n|---|---|\n| 123 | 456 |\n\n```mermaid\ngraph TD\n```\n\n![secret image](image.png)\n\n$$\nx=999\n$$\n\n<artifact>\n\nsecret artifact\n\n</artifact>\n\nDone."
            }
        ])
        expect(text).toBe("See the guide.\nDone.")
    })

    it("does not extract a recipe inside a code example", () => {
        expect(speechTextFromMarkdown("```xml\n<recipe>hidden</recipe>\n```")).toBe(
            "You can see this code block in our conversation history."
        )
    })

    it("has nothing to speak for rich-content-only messages", () => {
        expect(getMessageSpeechText([{ type: "tool-render_chart" }])).toBe("")
    })

    it("bounds long inputs without losing words or splitting surrogate pairs", () => {
        const text = "First sentence. Another longer sentence here. Last sentence."
        const chunks = splitSpeechText(text, 25)
        expect(chunks.join(" ")).toBe(text)
        expect(chunks.every((chunk) => chunk.length <= 25)).toBe(true)
        expect(splitSpeechText("aaaa😀bbbb", 5)).toEqual(["aaaa", "😀bbb", "b"])
    })
})
