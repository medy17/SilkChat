import { classifyPastedText, getPastedTextNames, mergePastedTextIntoDraft } from "@/lib/pasted-text"
import { describe, expect, it } from "vitest"

describe("pasted text policy", () => {
    it("keeps pastes under 5k tokens inline and turns longer pastes into a URL-backed attachment", () => {
        const inline = classifyPastedText("A short note")
        const url = classifyPastedText("word ".repeat(4_500))

        expect(inline.disposition).toBe("inline")
        expect(url.disposition).toBe("url")
        expect(getPastedTextNames(1)).toEqual({
            displayName: "Pasted Text 1",
            fileName: "Pasted Text 1.txt"
        })
    })

    it("restores pasted text without running it into an existing draft", () => {
        expect(mergePastedTextIntoDraft("Question", "Long pasted text")).toBe(
            "Question\n\nLong pasted text"
        )
        expect(mergePastedTextIntoDraft("", "Long pasted text")).toBe("Long pasted text")
    })
})
