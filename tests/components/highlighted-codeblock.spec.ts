// @vitest-environment jsdom

import { createCodeFence } from "@/components/highlighted-codeblock"
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
})
