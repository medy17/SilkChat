import {
    classifyPastedText,
    getEnabledToolsForPastedText,
    getPastedTextNames,
    mergePastedTextIntoDraft
} from "@/lib/pasted-text"
import { describe, expect, it } from "vitest"

describe("pasted text policy", () => {
    it("keeps pastes under 16k tokens inline and turns longer pastes into a URL-backed attachment", () => {
        const inline = classifyPastedText("A short note", {
            canReferenceLongTextAttachments: true
        })
        const url = classifyPastedText("word ".repeat(14_000), {
            canReferenceLongTextAttachments: true
        })

        expect(inline.disposition).toBe("inline")
        expect(url.disposition).toBe("url")
        expect(getPastedTextNames(1)).toEqual({
            displayName: "Pasted Text 1",
            fileName: "Pasted Text 1.txt"
        })
    })

    it("keeps medium pastes inline when code execution cannot retrieve them", () => {
        const medium = classifyPastedText("word ".repeat(14_000), {
            canReferenceLongTextAttachments: false
        })
        const enormous = classifyPastedText("word ".repeat(30_000), {
            canReferenceLongTextAttachments: false
        })

        expect(medium.disposition).toBe("inline")
        expect(enormous.disposition).toBe("attachment")
    })

    it("keeps code execution enabled after turning a long paste into a URL reference", () => {
        const decision = classifyPastedText("word ".repeat(14_000), {
            canReferenceLongTextAttachments: true
        })

        expect(getEnabledToolsForPastedText(decision, ["web_search"])).toEqual([
            "web_search",
            "code_execution"
        ])
        expect(getEnabledToolsForPastedText(decision, ["code_execution"])).toEqual([
            "code_execution"
        ])
    })

    it("restores pasted text without running it into an existing draft", () => {
        expect(mergePastedTextIntoDraft("Question", "Long pasted text")).toBe(
            "Question\n\nLong pasted text"
        )
        expect(mergePastedTextIntoDraft("", "Long pasted text")).toBe("Long pasted text")
    })
})
