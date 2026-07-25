import {
    buildLocalImageOptimizerUrl,
    extractLocalImageOptimizerRequestParts,
    formatLocalImageOptimizerRequestLog,
    getLocalImageOptimizerCacheKeyInput,
    isAllowedLocalImageOptimizerSource,
    parseLocalImageTransformOptions
} from "@/lib/local-image-optimizer"
import { describe, expect, it } from "vitest"

describe("local-image-optimizer", () => {
    it("builds a local optimizer URL on an app-owned development path", () => {
        expect(
            buildLocalImageOptimizerUrl({
                sourceUrl: "https://r2.silkchat.dev/generated/key-1",
                width: 540,
                quality: 76
            })
        ).toBe(
            "/_silkchat/image/fit=scale-down,width=540,quality=76,format=auto/https://r2.silkchat.dev/generated/key-1"
        )
    })

    it("parses the supported local optimizer transform options", () => {
        expect(
            parseLocalImageTransformOptions("fit=scale-down,width=540,quality=76,format=auto")
        ).toEqual({
            fit: "scale-down",
            width: 540,
            quality: 76,
            format: "auto"
        })
    })

    it("rejects unsupported transform options", () => {
        expect(parseLocalImageTransformOptions("fit=cover,width=540,quality=76,format=auto")).toBe(
            null
        )
        expect(
            parseLocalImageTransformOptions("fit=scale-down,width=0,quality=76,format=auto")
        ).toBe(null)
        expect(
            parseLocalImageTransformOptions("fit=scale-down,width=540,quality=120,format=auto")
        ).toBe(null)
    })

    it("reconstructs embedded source URLs that carry their query in the outer request", () => {
        const requestUrl = new URL(
            "http://localhost:3000/_silkchat/image/fit=scale-down,width=540,quality=76,format=auto/http://127.0.0.1:3210/http/r2?key=generated%2Fkey-1"
        )

        expect(extractLocalImageOptimizerRequestParts(requestUrl)).toEqual({
            optionsSegment: "fit=scale-down,width=540,quality=76,format=auto",
            sourceUrl: "http://127.0.0.1:3210/http/r2?key=generated%2Fkey-1"
        })
    })

    it("resolves percent-encoded embedded source URLs like the Cloudflare edge", () => {
        const encoded = new URL(
            "http://localhost:3000/_silkchat/image/fit=scale-down,width=324,quality=80,format=auto/https%3A%2F%2Fr2.silkchat.dev%2Fgenerated%2Fkey-1"
        )

        expect(extractLocalImageOptimizerRequestParts(encoded)).toEqual({
            optionsSegment: "fit=scale-down,width=324,quality=80,format=auto",
            sourceUrl: "https://r2.silkchat.dev/generated/key-1"
        })

        // The browser-collapsed single-slash form still resolves to the same source.
        const collapsed = new URL(
            "http://localhost:3000/_silkchat/image/fit=scale-down,width=324,quality=80,format=auto/https:/r2.silkchat.dev/generated/key-1"
        )

        expect(extractLocalImageOptimizerRequestParts(collapsed)?.sourceUrl).toBe(
            "https:/r2.silkchat.dev/generated/key-1"
        )
    })

    it("allows Convex /r2 source URLs with a key", () => {
        expect(
            isAllowedLocalImageOptimizerSource({
                sourceUrl: "http://127.0.0.1:3210/http/r2?key=generated%2Fkey-1",
                convexApiUrl: "http://127.0.0.1:3210/http"
            })
        ).toBe(true)

        expect(
            isAllowedLocalImageOptimizerSource({
                sourceUrl: "http://127.0.0.1:3210/http/private-blur?key=generated%2Fkey-1",
                convexApiUrl: "http://127.0.0.1:3210/http"
            })
        ).toBe(false)

        expect(
            isAllowedLocalImageOptimizerSource({
                sourceUrl: "https://cdn.example.com/r2?key=generated%2Fkey-1",
                convexApiUrl: "http://127.0.0.1:3210/http"
            })
        ).toBe(false)
    })

    it("allows configured public R2 asset URLs", () => {
        expect(
            isAllowedLocalImageOptimizerSource({
                sourceUrl: "https://r2.silkchat.dev/generated/key-1",
                convexApiUrl: "http://127.0.0.1:3210/http",
                publicAssetBaseUrl: "https://r2.silkchat.dev"
            })
        ).toBe(true)

        expect(
            isAllowedLocalImageOptimizerSource({
                sourceUrl: "https://r2.silkchat.dev-private/generated/key-1",
                convexApiUrl: "http://127.0.0.1:3210/http",
                publicAssetBaseUrl: "https://r2.silkchat.dev"
            })
        ).toBe(false)
    })

    it("builds a stable cache key input string", () => {
        expect(
            getLocalImageOptimizerCacheKeyInput({
                sourceUrl: "http://127.0.0.1:3210/http/r2?key=generated%2Fkey-1",
                width: 540,
                quality: 76,
                format: "webp"
            })
        ).toBe(
            "v1|width=540|quality=76|format=webp|http://127.0.0.1:3210/http/r2?key=generated%2Fkey-1"
        )
    })

    it("formats concise transform logs without exposing the source URL", () => {
        const log = formatLocalImageOptimizerRequestLog({
            method: "GET",
            pathname:
                "/_silkchat/image/fit=scale-down,width=540,quality=76,format=auto/https://r2.silkchat.dev/generated/private-key",
            status: 200,
            cacheStatus: "MISS",
            contentType: "image/webp",
            bytes: 1536,
            durationMs: 11.6
        })

        expect(log).toBe("[local-image-optimizer] GET transform 200 MISS image/webp 1.5 KiB 12ms")
        expect(log).not.toContain("private-key")
    })

    it("reports the number of entries removed by cache purges", () => {
        expect(
            formatLocalImageOptimizerRequestLog({
                method: "DELETE",
                pathname: "/_silkchat/image/__cache",
                status: 200,
                contentType: "application/json",
                bytes: 23,
                durationMs: 4.2,
                removed: 3
            })
        ).toBe("[local-image-optimizer] DELETE purge 200 removed=3 4ms")
    })
})
