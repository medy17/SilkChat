import {
    hasMeaningfulIntentDraft,
    resolveAnalysisAttachmentKind,
    resolveIntentGuideStage
} from "@/lib/composer-intents"
import { describe, expect, it } from "vitest"

describe("composer intent guide", () => {
    it("advances image guidance as the user adds a prompt and reference", () => {
        expect(
            resolveIntentGuideStage({
                activeIntent: "image",
                draft: "Create an image of ",
                attachmentCount: 0
            })
        ).toBe("image-explore")
        expect(
            resolveIntentGuideStage({
                activeIntent: "image",
                draft: "Create an image of a moonlit garden",
                attachmentCount: 0
            })
        ).toBe("image-reference")
        expect(
            resolveIntentGuideStage({
                activeIntent: "image",
                draft: "Create an image of a moonlit garden",
                attachmentCount: 1
            })
        ).toBe("image-refine")
    })

    it("does not mistake an intent prefix for authored draft content", () => {
        expect(hasMeaningfulIntentDraft("Search the web for ", "web")).toBe(false)
        expect(hasMeaningfulIntentDraft("Search the web for solar incentives", "web")).toBe(true)
    })

    it("classifies analysis attachments and reports mixed selections", () => {
        const base = { key: "key", fileSize: 1, uploadedAt: 1 }
        expect(
            resolveAnalysisAttachmentKind([
                { ...base, fileName: "sales.csv", fileType: "text/csv" }
            ])
        ).toBe("spreadsheet")
        expect(
            resolveAnalysisAttachmentKind([
                { ...base, fileName: "sales.csv", fileType: "text/csv" },
                { ...base, key: "key-2", fileName: "notes.pdf", fileType: "application/pdf" }
            ])
        ).toBe("mixed")
    })
})
