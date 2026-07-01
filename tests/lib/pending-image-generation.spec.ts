import { hasPendingImageGeneration } from "@/lib/pending-image-generation"
import type { UIMessage } from "ai"
import { describe, expect, it } from "vitest"

type ImageCardOutput = {
    status?: string
    error?: string
    variants?: number
    assets?: unknown[]
}

const messageWithImagePart = (output?: ImageCardOutput): Pick<UIMessage, "parts"> => ({
    parts: [
        { type: "text", text: "here you go" },
        {
            type: "tool-prepareImageGeneration",
            output
        }
    ] as UIMessage["parts"]
})

describe("hasPendingImageGeneration", () => {
    it("returns false with no messages or no image parts", () => {
        expect(hasPendingImageGeneration(undefined)).toBe(false)
        expect(hasPendingImageGeneration([])).toBe(false)
        expect(
            hasPendingImageGeneration([
                { parts: [{ type: "text", text: "hi" }] as UIMessage["parts"] }
            ])
        ).toBe(false)
    })

    it.each(["submitting", "submitted", "processing"])(
        "blocks while a generation is in-flight (%s)",
        (status) => {
            expect(hasPendingImageGeneration([messageWithImagePart({ status })])).toBe(true)
        }
    )

    it.each([
        "pending_confirmation",
        "completed",
        "partial",
        "failed",
        "refunded",
        "storing_failed",
        "unknown"
    ])("does not block for a proposal or settled state (%s)", (status) => {
        expect(hasPendingImageGeneration([messageWithImagePart({ status })])).toBe(false)
    })

    it("ignores a tool card that has no output yet", () => {
        expect(hasPendingImageGeneration([messageWithImagePart()])).toBe(false)
    })

    it("blocks while sibling variant jobs are still generating after the first completes", () => {
        // Variant jobs patch the shared card status last-write-wins, so the card can
        // read "completed" while only 1 of 3 assets has landed.
        expect(
            hasPendingImageGeneration([
                messageWithImagePart({ status: "completed", variants: 3, assets: [{}] })
            ])
        ).toBe(true)
    })

    it("unblocks once every variant asset has landed", () => {
        expect(
            hasPendingImageGeneration([
                messageWithImagePart({ status: "completed", variants: 3, assets: [{}, {}, {}] })
            ])
        ).toBe(false)
    })

    it("does not treat missing variants as awaiting when the run errored", () => {
        expect(
            hasPendingImageGeneration([
                messageWithImagePart({
                    status: "completed",
                    variants: 3,
                    assets: [{}],
                    error: "one variant failed"
                })
            ])
        ).toBe(false)
    })

    it("does not block a completed card that produced no assets", () => {
        expect(
            hasPendingImageGeneration([
                messageWithImagePart({ status: "completed", variants: 3, assets: [] })
            ])
        ).toBe(false)
    })

    it("detects an in-flight card among many messages", () => {
        expect(
            hasPendingImageGeneration([
                messageWithImagePart({ status: "completed" }),
                { parts: [{ type: "text", text: "thinking" }] as UIMessage["parts"] },
                messageWithImagePart({ status: "processing" })
            ])
        ).toBe(true)
    })
})
