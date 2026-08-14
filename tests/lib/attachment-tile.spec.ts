import {
    getAttachmentTileKind,
    getAttachmentTileMediaType,
    isLargePasteMediaType,
    markLargePasteMediaType
} from "@/lib/attachment-tile"
import { describe, expect, it } from "vitest"

describe("attachment tile semantics", () => {
    it("marks large pastes without changing ordinary attachment MIME types", () => {
        expect(markLargePasteMediaType("text/markdown")).toBe("text/markdown;silkchat=large-paste")
        expect(markLargePasteMediaType("text/markdown;silkchat=large-paste")).toBe(
            "text/markdown;silkchat=large-paste"
        )
        expect(isLargePasteMediaType("text/markdown;silkchat=large-paste")).toBe(true)
        expect(isLargePasteMediaType("text/markdown")).toBe(false)
        expect(getAttachmentTileKind("text/markdown;silkchat=large-paste")).toBe("large-paste")
        expect(getAttachmentTileKind("text/markdown")).toBe("attachment")
        expect(getAttachmentTileMediaType("text/plain", "attachment")).toBe("text/plain")
        expect(getAttachmentTileMediaType("text/markdown", "large-paste")).toBe(
            "text/markdown;silkchat=large-paste"
        )
    })
})
