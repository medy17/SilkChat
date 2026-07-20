// @vitest-environment jsdom

import { HighlightedCodeblock, createCodeFence } from "@/components/highlighted-codeblock"
import { render, waitFor } from "@testing-library/react"
import { createElement } from "react"
import { describe, expect, it } from "vitest"

describe("createCodeFence", () => {
    it("creates a language-tagged fence around ordinary source", () => {
        expect(createCodeFence("print('hello')", "python")).toBe("```python\nprint('hello')\n```")
    })

    it("uses a longer fence when source contains backtick runs", () => {
        expect(createCodeFence("const block = ```value```", "javascript")).toBe(
            "````javascript\nconst block = ```value```\n````"
        )
    })

    it("sanitizes the language tag", () => {
        expect(createCodeFence("value", "python injected\ntext")).toBe(
            "```pythoninjectedtext\nvalue\n```"
        )
    })

    it("renders Shiki token colors through the Streamdown code plugin", async () => {
        const { container } = render(
            createElement(HighlightedCodeblock, {
                source: "def greet(name):\n    return f'Hello {name}'",
                language: "python"
            })
        )

        await waitFor(() => {
            const coloredTokens = Array.from(container.querySelectorAll("code span[style]")).filter(
                (token) => token.getAttribute("style")?.includes("--sdm-c")
            )

            expect(coloredTokens.length).toBeGreaterThan(0)
        })
    })
})
