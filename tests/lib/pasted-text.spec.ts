import {
    classifyPastedText,
    getEnabledToolsForPastedText,
    getPastedTextNames,
    mergePastedTextIntoDraft
} from "@/lib/pasted-text"
import { describe, expect, it } from "vitest"

describe("pasted text policy", () => {
    it("keeps long text inline without enabling tools when the editor's attachment queue is busy", () => {
        const decision = classifyPastedText("word ".repeat(40_000), {
            canReferenceLongTextAttachments: true,
            attachmentQueueBusy: true
        })
        expect(decision.disposition).toBe("inline")
        expect(getEnabledToolsForPastedText(decision, ["web_search"])).toEqual(["web_search"])
    })
    it("grades pastes as typed text, a file read in full, or a file code execution fetches", () => {
        const grade = (words: number, canReferenceLongTextAttachments = true) =>
            classifyPastedText("word ".repeat(words), { canReferenceLongTextAttachments })
                .disposition

        expect(grade(8_000)).toBe("inline")
        expect(grade(9_000)).toBe("attachment")
        expect(grade(32_000)).toBe("attachment")
        expect(grade(40_000)).toBe("url")
        // Without code execution, long text stays a file the model is told it can't read.
        expect(grade(40_000, false)).toBe("attachment")
        expect(getPastedTextNames(1)).toEqual({
            displayName: "Pasted Text 1",
            fileName: "Pasted Text 1.txt"
        })
    })

    it("turns code execution on only for a URL reference", () => {
        expect(
            getEnabledToolsForPastedText(
                classifyPastedText("word ".repeat(20_000), {
                    canReferenceLongTextAttachments: true
                }),
                ["web_search"]
            )
        ).toEqual(["web_search"])
        const decision = classifyPastedText("word ".repeat(40_000), {
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
