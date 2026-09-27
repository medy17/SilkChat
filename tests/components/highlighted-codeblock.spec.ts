// @vitest-environment jsdom

import { splitStreamingCode } from "@/components/codeblock"
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

describe("splitStreamingCode", () => {
    it("highlights finished lines and leaves the line being written plain", () => {
        expect(splitStreamingCode("import math\nrows = []\nfor i in ra")).toEqual({
            settled: "import math\nrows = []",
            tail: "for i in ra",
            tailStartLine: 3
        })
    })

    it("keeps a single unfinished line out of the highlighter entirely", () => {
        expect(splitStreamingCode("print(json.dumps(rows))garbage")).toEqual({
            settled: "",
            tail: "print(json.dumps(rows))garbage",
            tailStartLine: 1
        })
    })
})
