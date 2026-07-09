import { describe, expect, it } from "vitest"

import { buildVercelOptimizedImageUrl, snapToVercelImageSize } from "@/lib/static-image-urls"

describe("static-image-urls", () => {
    describe("snapToVercelImageSize", () => {
        it("rounds up to the nearest configured Vercel size", () => {
            expect(snapToVercelImageSize(96)).toBe(320)
            expect(snapToVercelImageSize(320)).toBe(320)
            expect(snapToVercelImageSize(700)).toBe(768)
        })

        it("clamps oversized requests to the largest configured size", () => {
            expect(snapToVercelImageSize(5000)).toBe(1600)
        })
    })

    describe("buildVercelOptimizedImageUrl", () => {
        it("builds a `/_vercel/image` url with an encoded source, snapped width, and quality", () => {
            expect(
                buildVercelOptimizedImageUrl({
                    src: "/persona_showcase/vampire_man.png",
                    width: 768,
                    quality: 70
                })
            ).toBe("/_vercel/image?url=%2Fpersona_showcase%2Fvampire_man.png&w=768&q=70")
        })

        it("defaults quality to 75 and snaps sub-minimum widths up to 320", () => {
            expect(buildVercelOptimizedImageUrl({ src: "/avatars/aria.webp", width: 96 })).toBe(
                "/_vercel/image?url=%2Favatars%2Faria.webp&w=320&q=75"
            )
        })
    })
})
