import { mkdtemp, rm } from "node:fs/promises"
import os from "node:os"
import path from "node:path"
import { createLocalImageOptimizerHandler } from "@/lib/local-image-optimizer-server"
import { afterEach, describe, expect, it, vi } from "vitest"

const OPAQUE_PNG = Uint8Array.from(
    Buffer.from(
        "iVBORw0KGgoAAAANSUhEUgAAABAAAAAMCAIAAADkharWAAAACXBIWXMAAAPoAAAD6AG1e1JrAAAAGElEQVR4nGOQNPImCTGMajAaDSVJbEkDABdbcIFHnSynAAAAAElFTkSuQmCC",
        "base64"
    )
)
const ALPHA_PNG = Uint8Array.from(
    Buffer.from(
        "iVBORw0KGgoAAAANSUhEUgAAAAoAAAAKCAYAAACNMs+9AAAACXBIWXMAAAPoAAAD6AG1e1JrAAAAFklEQVR4nGOQNPJuIAYzjCqUpGvwAAC7IGyZpdoC3QAAAABJRU5ErkJggg==",
        "base64"
    )
)

const createRequest = ({
    pathName,
    accept = "image/webp"
}: {
    pathName: string
    accept?: string
}) =>
    new Request(`http://localhost:3000${pathName}`, {
        headers: {
            Accept: accept
        }
    })

const describeWithBun = typeof Bun === "undefined" ? describe.skip : describe

describeWithBun("local-image-optimizer-server", () => {
    const tempDirs: string[] = []

    afterEach(async () => {
        vi.unstubAllGlobals()
        await Promise.all(
            tempDirs.splice(0).map((tempDir) => rm(tempDir, { recursive: true, force: true }))
        )
    })

    it("optimizes, caches, and reuses transformed images", async () => {
        const cacheDir = await mkdtemp(path.join(os.tmpdir(), "local-image-optimizer-"))
        tempDirs.push(cacheDir)

        const fetchMock = vi.fn().mockResolvedValue(
            new Response(OPAQUE_PNG, {
                status: 200,
                headers: {
                    "content-type": "image/png"
                }
            })
        )
        vi.stubGlobal("fetch", fetchMock)

        const handleRequest = createLocalImageOptimizerHandler({
            cacheDir,
            convexApiUrl: "http://127.0.0.1:3210/http",
            publicAssetBaseUrl: "https://r2.silkchat.dev"
        })

        const request = createRequest({
            pathName:
                "/_silkchat/image/fit=scale-down,width=8,quality=72,format=auto/https://r2.silkchat.dev/generated/key-1"
        })

        const firstResponse = await handleRequest(request)
        expect(firstResponse.status).toBe(200)
        expect(firstResponse.headers.get("content-type")).toBe("image/webp")
        expect(firstResponse.headers.get("x-silkchat-local-image-optimizer")).toBe("MISS")
        expect(fetchMock).toHaveBeenCalledTimes(1)

        const secondResponse = await handleRequest(request)
        expect(secondResponse.status).toBe(200)
        expect(secondResponse.headers.get("content-type")).toBe("image/webp")
        expect(secondResponse.headers.get("x-silkchat-local-image-optimizer")).toBe("HIT")
        expect(fetchMock).toHaveBeenCalledTimes(1)
    })

    it("prefers webp over avif when the client accepts both", async () => {
        const cacheDir = await mkdtemp(path.join(os.tmpdir(), "local-image-optimizer-"))
        tempDirs.push(cacheDir)

        vi.stubGlobal(
            "fetch",
            vi.fn().mockResolvedValue(
                new Response(OPAQUE_PNG, {
                    status: 200,
                    headers: {
                        "content-type": "image/png"
                    }
                })
            )
        )

        const handleRequest = createLocalImageOptimizerHandler({
            cacheDir,
            convexApiUrl: "http://127.0.0.1:3210/http",
            publicAssetBaseUrl: "https://r2.silkchat.dev"
        })

        const response = await handleRequest(
            createRequest({
                pathName:
                    "/_silkchat/image/fit=scale-down,width=8,quality=72,format=auto/https://r2.silkchat.dev/generated/key-webp-preferred",
                accept: "image/avif,image/webp,image/*"
            })
        )

        expect(response.status).toBe(200)
        expect(response.headers.get("content-type")).toBe("image/webp")
    })

    it.runIf(process.platform === "linux")(
        "falls back to webp when Bun cannot encode avif on Linux",
        async () => {
            const cacheDir = await mkdtemp(path.join(os.tmpdir(), "local-image-optimizer-"))
            tempDirs.push(cacheDir)

            const fetchMock = vi.fn().mockResolvedValue(
                new Response(OPAQUE_PNG, {
                    status: 200,
                    headers: { "content-type": "image/png" }
                })
            )
            vi.stubGlobal("fetch", fetchMock)

            const handleRequest = createLocalImageOptimizerHandler({
                cacheDir,
                convexApiUrl: "http://127.0.0.1:3210/http",
                publicAssetBaseUrl: "https://r2.silkchat.dev"
            })
            const request = createRequest({
                pathName:
                    "/_silkchat/image/fit=scale-down,width=8,quality=72,format=auto/https://r2.silkchat.dev/generated/key-avif-fallback",
                accept: "image/avif"
            })

            const firstResponse = await handleRequest(request)
            expect(firstResponse.status).toBe(200)
            expect(firstResponse.headers.get("content-type")).toBe("image/webp")
            expect(firstResponse.headers.get("x-silkchat-local-image-optimizer")).toBe("MISS")

            const secondResponse = await handleRequest(request)
            expect(secondResponse.headers.get("x-silkchat-local-image-optimizer")).toBe("HIT")
            expect(fetchMock).toHaveBeenCalledTimes(1)
        }
    )

    it("falls back to png when the client does not accept avif or webp and the source has alpha", async () => {
        const cacheDir = await mkdtemp(path.join(os.tmpdir(), "local-image-optimizer-"))
        tempDirs.push(cacheDir)

        vi.stubGlobal(
            "fetch",
            vi.fn().mockResolvedValue(
                new Response(ALPHA_PNG, {
                    status: 200,
                    headers: {
                        "content-type": "image/png"
                    }
                })
            )
        )

        const handleRequest = createLocalImageOptimizerHandler({
            cacheDir,
            convexApiUrl: "http://127.0.0.1:3210/http",
            publicAssetBaseUrl: "https://r2.silkchat.dev"
        })

        const response = await handleRequest(
            createRequest({
                pathName:
                    "/_silkchat/image/fit=scale-down,width=8,quality=72,format=auto/https://r2.silkchat.dev/generated/key-2",
                accept: "image/png"
            })
        )

        expect(response.status).toBe(200)
        expect(response.headers.get("content-type")).toBe("image/png")
    })

    it("preserves transparency when a webp source needs a portable fallback", async () => {
        const cacheDir = await mkdtemp(path.join(os.tmpdir(), "local-image-optimizer-"))
        tempDirs.push(cacheDir)
        const transparentWebp = await new Bun.Image(ALPHA_PNG).webp().bytes()

        vi.stubGlobal(
            "fetch",
            vi.fn().mockResolvedValue(
                new Response(Buffer.from(transparentWebp), {
                    status: 200,
                    headers: { "content-type": "image/webp" }
                })
            )
        )

        const handleRequest = createLocalImageOptimizerHandler({
            cacheDir,
            convexApiUrl: "http://127.0.0.1:3210/http",
            publicAssetBaseUrl: "https://r2.silkchat.dev"
        })
        const response = await handleRequest(
            createRequest({
                pathName:
                    "/_silkchat/image/fit=scale-down,width=8,quality=72,format=auto/https://r2.silkchat.dev/generated/key-transparent-webp",
                accept: "image/png"
            })
        )

        expect(response.status).toBe(200)
        expect(response.headers.get("content-type")).toBe("image/png")
    })

    it("rejects disallowed source URLs", async () => {
        const cacheDir = await mkdtemp(path.join(os.tmpdir(), "local-image-optimizer-"))
        tempDirs.push(cacheDir)

        const handleRequest = createLocalImageOptimizerHandler({
            cacheDir,
            convexApiUrl: "http://127.0.0.1:3210/http",
            publicAssetBaseUrl: "https://r2.silkchat.dev"
        })

        const response = await handleRequest(
            createRequest({
                pathName:
                    "/_silkchat/image/fit=scale-down,width=8,quality=72,format=auto/https://cdn.example.com/image.png"
            })
        )

        expect(response.status).toBe(403)
    })

    it("purges the cache on DELETE and rejects other methods on the purge path", async () => {
        const cacheDir = await mkdtemp(path.join(os.tmpdir(), "local-image-optimizer-"))
        tempDirs.push(cacheDir)

        vi.stubGlobal(
            "fetch",
            vi.fn().mockResolvedValue(
                new Response(OPAQUE_PNG, {
                    status: 200,
                    headers: { "content-type": "image/png" }
                })
            )
        )

        const handleRequest = createLocalImageOptimizerHandler({
            cacheDir,
            convexApiUrl: "http://127.0.0.1:3210/http",
            publicAssetBaseUrl: "https://r2.silkchat.dev"
        })

        // Warm the cache so there is something to purge.
        await handleRequest(
            createRequest({
                pathName:
                    "/_silkchat/image/fit=scale-down,width=8,quality=72,format=auto/https://r2.silkchat.dev/generated/purge-me"
            })
        )

        const purgeUrl = "http://localhost:3000/_silkchat/image/__cache"

        const wrongMethod = await handleRequest(new Request(purgeUrl, { method: "POST" }))
        expect(wrongMethod.status).toBe(405)

        const purged = await handleRequest(new Request(purgeUrl, { method: "DELETE" }))
        expect(purged.status).toBe(200)
        expect(await purged.json()).toEqual({ ok: true, removed: 1 })

        // Purging again with an empty cache is a no-op, not an error.
        const purgedAgain = await handleRequest(new Request(purgeUrl, { method: "DELETE" }))
        expect(await purgedAgain.json()).toEqual({ ok: true, removed: 0 })
    })

    it("rejects malformed transform options", async () => {
        const cacheDir = await mkdtemp(path.join(os.tmpdir(), "local-image-optimizer-"))
        tempDirs.push(cacheDir)

        const handleRequest = createLocalImageOptimizerHandler({
            cacheDir,
            convexApiUrl: "http://127.0.0.1:3210/http",
            publicAssetBaseUrl: "https://r2.silkchat.dev"
        })

        const response = await handleRequest(
            createRequest({
                pathName:
                    "/_silkchat/image/fit=cover,width=8,quality=72,format=auto/https://r2.silkchat.dev/generated/key-3"
            })
        )

        expect(response.status).toBe(400)
    })
})
