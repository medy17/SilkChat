import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

const { browserEnvMock, optionalBrowserEnvMock } = vi.hoisted(() => ({
    browserEnvMock: vi.fn((key: string): string => {
        switch (key) {
            case "VITE_CLOUDFLARE_IMAGE_HOST":
                return "https://img.silkchat.dev"
            case "VITE_R2_PUBLIC_BASE_URL":
                return "https://r2.silkchat.dev"
            default:
                return "https://api.example.com/"
        }
    }),
    optionalBrowserEnvMock: vi.fn((key: string): string | undefined => {
        switch (key) {
            case "VITE_CLOUDFLARE_IMAGE_HOST":
                return "https://img.silkchat.dev"
            case "VITE_R2_PUBLIC_BASE_URL":
                return "https://r2.silkchat.dev"
            default:
                return undefined
        }
    })
}))

vi.mock("@/lib/browser-env", () => ({
    browserEnv: browserEnvMock,
    optionalBrowserEnv: optionalBrowserEnvMock
}))

import {
    getChatImageCardSources,
    getCloudflareTransformedImageUrl,
    getExpandedImageUrl,
    getFileThumbnailSources,
    getGeneratedImageCopyUrl,
    getGeneratedImageDirectUrl,
    getGeneratedImageProxyUrl,
    getLibraryImageSources,
    getOptimizedGeneratedImageUrl,
    resetPrivateBlurFormatCacheForTests
} from "@/lib/generated-image-urls"

describe("generated-image-urls", () => {
    beforeEach(() => {
        browserEnvMock.mockImplementation((key: string): string => {
            switch (key) {
                case "VITE_CLOUDFLARE_IMAGE_HOST":
                    return "https://img.silkchat.dev"
                case "VITE_R2_PUBLIC_BASE_URL":
                    return "https://r2.silkchat.dev"
                default:
                    return "https://api.example.com/"
            }
        })
        optionalBrowserEnvMock.mockImplementation((key: string) => {
            switch (key) {
                case "VITE_CLOUDFLARE_IMAGE_HOST":
                    return "https://img.silkchat.dev"
                case "VITE_R2_PUBLIC_BASE_URL":
                    return "https://r2.silkchat.dev"
                default:
                    return undefined
            }
        })
    })

    afterEach(() => {
        vi.unstubAllGlobals()
        resetPrivateBlurFormatCacheForTests()
    })

    it("builds the base Convex proxy URL with an encoded storage key", () => {
        expect(getGeneratedImageProxyUrl("folder/image key.png")).toBe(
            "https://api.example.com/r2?key=folder%2Fimage%20key.png"
        )
    })

    it("builds a same-origin dev proxy URL for clipboard copies", () => {
        expect(getGeneratedImageCopyUrl("folder/image key.png")).toBe(
            "/convex-http/r2?key=folder%2Fimage%20key.png"
        )
    })

    it("builds a public R2 URL for direct image attachment downloads", () => {
        expect(getGeneratedImageDirectUrl("generations/user/image key.png")).toBe(
            "https://r2.silkchat.dev/generations/user/image%20key.png"
        )
    })

    it("builds a Cloudflare transformation URL from a remote source URL", () => {
        expect(
            getCloudflareTransformedImageUrl({
                imageHost: "https://img.silkchat.dev",
                sourceUrl: "https://r2.silkchat.dev/generated/key-1",
                width: 540,
                quality: 76
            })
        ).toBe(
            "https://img.silkchat.dev/cdn-cgi/image/fit=scale-down,width=540,quality=76,format=auto/https://r2.silkchat.dev/generated/key-1"
        )
    })

    it("builds optimized 1x and 2x sources for file thumbnails", () => {
        expect(getFileThumbnailSources("attachments/user/image.png")).toEqual({
            src: "https://img.silkchat.dev/cdn-cgi/image/fit=scale-down,width=96,quality=76,format=auto/https://r2.silkchat.dev/attachments/user/image.png",
            srcSet: [
                "https://img.silkchat.dev/cdn-cgi/image/fit=scale-down,width=48,quality=80,format=auto/https://r2.silkchat.dev/attachments/user/image.png 48w",
                "https://img.silkchat.dev/cdn-cgi/image/fit=scale-down,width=96,quality=76,format=auto/https://r2.silkchat.dev/attachments/user/image.png 96w"
            ].join(", "),
            sizes: "48px"
        })
    })

    it("bypasses Cloudflare image optimization on localhost", () => {
        vi.stubGlobal("window", {
            location: {
                hostname: "localhost"
            }
        })

        expect(
            getOptimizedGeneratedImageUrl({
                storageKey: "generated/key-1",
                aspectRatio: "9:16",
                longEdge: 720,
                quality: 80
            })
        ).toBe("https://r2.silkchat.dev/generated/key-1")
    })

    it("routes localhost image optimization through the local optimizer helper when enabled", () => {
        vi.stubGlobal("window", {
            location: {
                hostname: "localhost"
            }
        })
        optionalBrowserEnvMock.mockImplementation((key: string) =>
            key === "VITE_LOCAL_IMAGE_OPTIMIZER_ENABLED" ? "1" : undefined
        )

        expect(
            getOptimizedGeneratedImageUrl({
                storageKey: "generated/key-1",
                aspectRatio: "9:16",
                longEdge: 720,
                quality: 80
            })
        ).toBe(
            "/cdn-cgi/image/fit=scale-down,width=405,quality=80,format=auto/https://r2.silkchat.dev/generated/key-1"
        )
    })

    it("builds a transformed image URL when a Cloudflare image host is configured", () => {
        expect(
            getOptimizedGeneratedImageUrl({
                storageKey: "generated/key-2",
                aspectRatio: "9:16",
                longEdge: 720,
                quality: 76
            })
        ).toBe(
            "https://img.silkchat.dev/cdn-cgi/image/fit=scale-down,width=405,quality=76,format=auto/https://r2.silkchat.dev/generated/key-2"
        )
    })

    it("builds responsive library metadata with Cloudflare transformation URLs", () => {
        vi.stubGlobal("window", {
            location: {
                hostname: "www.silkchat.dev"
            }
        })

        expect(
            getLibraryImageSources({
                storageKey: "generated/key-3",
                aspectRatio: "3:4"
            })
        ).toEqual({
            src: "https://img.silkchat.dev/cdn-cgi/image/fit=scale-down,width=540,quality=76,format=auto/https://r2.silkchat.dev/generated/key-3",
            srcSet: [
                "https://img.silkchat.dev/cdn-cgi/image/fit=scale-down,width=432,quality=80,format=auto/https://r2.silkchat.dev/generated/key-3 432w",
                "https://img.silkchat.dev/cdn-cgi/image/fit=scale-down,width=540,quality=76,format=auto/https://r2.silkchat.dev/generated/key-3 540w"
            ].join(", "),
            sizes: "(min-width: 1280px) 20vw, (min-width: 1024px) 25vw, (min-width: 768px) 33vw, (min-width: 640px) 50vw, 100vw",
            useCssBlurFallback: false
        })

        expect(
            getExpandedImageUrl({
                storageKey: "generated/key-3",
                aspectRatio: "3:4"
            })
        ).toBe(
            "https://img.silkchat.dev/cdn-cgi/image/fit=scale-down,width=810,quality=84,format=auto/https://r2.silkchat.dev/generated/key-3"
        )
    })

    it("builds larger chat card sources with 1x/2x candidates and honest sizes", () => {
        vi.stubGlobal("window", {
            location: {
                hostname: "www.silkchat.dev"
            }
        })

        expect(
            getChatImageCardSources({
                storageKey: "generated/key-card",
                aspectRatio: "3:4"
            })
        ).toEqual({
            src: "https://img.silkchat.dev/cdn-cgi/image/fit=scale-down,width=672,quality=82,format=auto/https://r2.silkchat.dev/generated/key-card",
            srcSet: [
                "https://img.silkchat.dev/cdn-cgi/image/fit=scale-down,width=336,quality=84,format=auto/https://r2.silkchat.dev/generated/key-card 336w",
                "https://img.silkchat.dev/cdn-cgi/image/fit=scale-down,width=672,quality=82,format=auto/https://r2.silkchat.dev/generated/key-card 672w"
            ].join(", "),
            sizes: "(min-width: 480px) 448px, 100vw"
        })
    })

    it("builds responsive library metadata with local optimizer URLs when enabled", () => {
        vi.stubGlobal("window", {
            location: {
                hostname: "localhost"
            }
        })
        optionalBrowserEnvMock.mockImplementation((key: string) =>
            key === "VITE_LOCAL_IMAGE_OPTIMIZER_ENABLED" ? "1" : undefined
        )

        expect(
            getLibraryImageSources({
                storageKey: "generated/key-3",
                aspectRatio: "3:4"
            })
        ).toEqual({
            src: "/cdn-cgi/image/fit=scale-down,width=540,quality=76,format=auto/https://r2.silkchat.dev/generated/key-3",
            srcSet: [
                "/cdn-cgi/image/fit=scale-down,width=432,quality=80,format=auto/https://r2.silkchat.dev/generated/key-3 432w",
                "/cdn-cgi/image/fit=scale-down,width=540,quality=76,format=auto/https://r2.silkchat.dev/generated/key-3 540w"
            ].join(", "),
            sizes: "(min-width: 1280px) 20vw, (min-width: 1024px) 25vw, (min-width: 768px) 33vw, (min-width: 640px) 50vw, 100vw",
            useCssBlurFallback: false
        })
    })

    it("falls back to css blur for hidden tiles when avif and webp are unsupported", () => {
        vi.stubGlobal("window", {
            location: {
                hostname: "www.silkchat.dev"
            }
        })
        vi.stubGlobal("document", {
            createElement: vi.fn(() => ({
                toDataURL: vi.fn(() => "data:image/png;base64,fallback")
            }))
        })

        expect(
            getLibraryImageSources({
                storageKey: "generated/key-4",
                aspectRatio: "1:1",
                hidden: true
            })
        ).toEqual({
            src: "https://img.silkchat.dev/cdn-cgi/image/fit=scale-down,width=720,quality=76,format=auto/https://r2.silkchat.dev/generated/key-4",
            srcSet: [
                "https://img.silkchat.dev/cdn-cgi/image/fit=scale-down,width=576,quality=80,format=auto/https://r2.silkchat.dev/generated/key-4 576w",
                "https://img.silkchat.dev/cdn-cgi/image/fit=scale-down,width=720,quality=76,format=auto/https://r2.silkchat.dev/generated/key-4 720w"
            ].join(", "),
            sizes: "(min-width: 1280px) 20vw, (min-width: 1024px) 25vw, (min-width: 768px) 33vw, (min-width: 640px) 50vw, 100vw",
            useCssBlurFallback: true
        })
    })

    it("still falls back to css blur for hidden tiles on localhost", () => {
        vi.stubGlobal("window", {
            location: {
                hostname: "localhost"
            }
        })
        vi.stubGlobal("document", {
            createElement: vi.fn(() => ({
                toDataURL: vi.fn((mimeType: string) =>
                    mimeType === "image/avif"
                        ? "data:image/avif;base64,test"
                        : "data:image/png;base64,fallback"
                )
            }))
        })

        expect(
            getLibraryImageSources({
                storageKey: "generated/key-5",
                aspectRatio: "3:4",
                hidden: true
            })
        ).toEqual({
            src: "https://r2.silkchat.dev/generated/key-5",
            srcSet: [
                "https://r2.silkchat.dev/generated/key-5 432w",
                "https://r2.silkchat.dev/generated/key-5 540w"
            ].join(", "),
            sizes: "(min-width: 1280px) 20vw, (min-width: 1024px) 25vw, (min-width: 768px) 33vw, (min-width: 640px) 50vw, 100vw",
            useCssBlurFallback: true
        })
    })

    it("throws when optimized image URLs are requested without a public R2 base", () => {
        browserEnvMock.mockImplementation((key: string): string => {
            if (key === "VITE_CLOUDFLARE_IMAGE_HOST") {
                return "https://img.silkchat.dev"
            }

            if (key === "VITE_CONVEX_API_URL") {
                return "https://api.example.com/"
            }

            throw new Error(`Missing environment variable(browser): ${key}`)
        })
        optionalBrowserEnvMock.mockImplementation((key: string) =>
            key === "VITE_CLOUDFLARE_IMAGE_HOST" ? "https://img.silkchat.dev" : undefined
        )

        expect(() =>
            getOptimizedGeneratedImageUrl({
                storageKey: "generated/key-6",
                aspectRatio: "1:1",
                longEdge: 720,
                quality: 76
            })
        ).toThrow("Missing environment variable(browser): VITE_R2_PUBLIC_BASE_URL")
    })
})
