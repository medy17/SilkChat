import { fenceCode, splitSilkAppContent } from "@/lib/silk-app/segments"
import { describe, expect, it } from "vitest"

describe("splitSilkAppContent", () => {
    it("lifts a finished app out of the surrounding prose", () => {
        expect(
            splitSilkAppContent("Intro.\n\n```silk-app\nconst a = 1\n```\n\nWhat to try.")
        ).toEqual([
            { type: "markdown", content: "Intro.\n" },
            { type: "silk-app", code: "const a = 1", complete: true },
            { type: "markdown", content: "\nWhat to try." }
        ])
    })

    it("marks an app whose fence is still streaming as incomplete", () => {
        expect(splitSilkAppContent("Intro.\n~~~silk-app\nconst a = 1\nconst b")).toEqual([
            { type: "markdown", content: "Intro." },
            { type: "silk-app", code: "const a = 1\nconst b", complete: false }
        ])
    })

    it("leaves an app fence shown inside another code block as code", () => {
        const content = "````markdown\n```silk-app\nconst a = 1\n```\n````"

        expect(splitSilkAppContent(content)).toEqual([{ type: "markdown", content }])
    })

    it("leaves an app fence inside a list item in the list", () => {
        const content = "1. Open it:\n   ```silk-app\n   const a = 1\n   ```\n2. Play."

        expect(splitSilkAppContent(content)).toEqual([{ type: "markdown", content }])
    })

    it("reads a line starting with inline triple-backtick code as prose", () => {
        expect(splitSilkAppContent("```js``` is inline.\n```silk-app\nconst a = 1\n```")).toEqual([
            { type: "markdown", content: "```js``` is inline." },
            { type: "silk-app", code: "const a = 1", complete: true }
        ])
    })
})

describe("fenceCode", () => {
    it("uses a fence longer than any backtick run in the code", () => {
        expect(fenceCode("const s = ```x```", "tsx")).toBe("````tsx\nconst s = ```x```\n````")
    })
})
