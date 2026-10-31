import { describe, expect, it } from "vitest"
import { getLightboxLongEdge } from "@/lib/lightbox-image-size"

describe("lightbox image size", () => {
    it.each([
        ["1080p monitor at 1x", { width: 1920, height: 969 }, 1, "1:1", 1080],
        ["MacBook Pro 14 at 2x", { width: 1512, height: 823 }, 2, "1:1", 1600],
        ["iPhone at 3x, portrait image", { width: 393, height: 659 }, 3, "9:16", 1600],
        ["iPhone at 3x, square image", { width: 393, height: 659 }, 3, "1:1", 1600],
        ["4K at 2x, landscape image", { width: 1920, height: 1000 }, 2, "16:9", 2400]
    ])("picks the smallest long edge covering the box on a %s", (_, viewport, dpr, ratio, edge) => {
        expect(getLightboxLongEdge({ viewport, aspectRatio: ratio, devicePixelRatio: dpr })).toBe(
            edge
        )
    })
})
