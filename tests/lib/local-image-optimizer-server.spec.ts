import { mkdtemp, rm } from "node:fs/promises"
import os from "node:os"
import path from "node:path"
import { createLocalImageOptimizerHandler } from "@/lib/local-image-optimizer-server"
import sharp from "sharp"
import { afterEach, describe, expect, it, vi } from "vitest"

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

describe("local-image-optimizer-server", () => {
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

        const sourceBytes = await sharp({
            create: {
                width: 16,
                height: 12,
                channels: 3,
                background: { r: 25, g: 50, b: 75 }
            }
        })
            .png()
            .toBuffer()

        const fetchMock = vi.fn().mockResolvedValue(
            new Response(new Uint8Array(sourceBytes), {
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
                "/cdn-cgi/image/fit=scale-down,width=8,quality=72,format=auto/https://r2.silkchat.dev/generated/key-1"
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

        const sourceBytes = await sharp({
            create: {
                width: 16,
                height: 12,
                channels: 3,
                background: { r: 25, g: 50, b: 75 }
            }
        })
            .png()
            .toBuffer()

        vi.stubGlobal(
            "fetch",
            vi.fn().mockResolvedValue(
                new Response(new Uint8Array(sourceBytes), {
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
                    "/cdn-cgi/image/fit=scale-down,width=8,quality=72,format=auto/https://r2.silkchat.dev/generated/key-webp-preferred",
                accept: "image/avif,image/webp,image/*"
            })
        )

        expect(response.status).toBe(200)
        expect(response.headers.get("content-type")).toBe("image/webp")
    })

    it("falls back to png when the client does not accept avif or webp and the source has alpha", async () => {
        const cacheDir = await mkdtemp(path.join(os.tmpdir(), "local-image-optimizer-"))
        tempDirs.push(cacheDir)

        const sourceBytes = await sharp({
            create: {
                width: 10,
                height: 10,
                channels: 4,
                background: { r: 25, g: 50, b: 75, alpha: 0.5 }
            }
        })
            .png()
            .toBuffer()

        vi.stubGlobal(
            "fetch",
            vi.fn().mockResolvedValue(
                new Response(new Uint8Array(sourceBytes), {
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
                    "/cdn-cgi/image/fit=scale-down,width=8,quality=72,format=auto/https://r2.silkchat.dev/generated/key-2",
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
                    "/cdn-cgi/image/fit=scale-down,width=8,quality=72,format=auto/https://cdn.example.com/image.png"
            })
        )

        expect(response.status).toBe(403)
    })

    it("purges the cache on DELETE and rejects other methods on the purge path", async () => {
        const cacheDir = await mkdtemp(path.join(os.tmpdir(), "local-image-optimizer-"))
        tempDirs.push(cacheDir)

        const sourceBytes = await sharp({
            create: {
                width: 16,
                height: 12,
                channels: 3,
                background: { r: 25, g: 50, b: 75 }
            }
        })
            .png()
            .toBuffer()

        vi.stubGlobal(
            "fetch",
            vi.fn().mockResolvedValue(
                new Response(new Uint8Array(sourceBytes), {
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
                    "/cdn-cgi/image/fit=scale-down,width=8,quality=72,format=auto/https://r2.silkchat.dev/generated/purge-me"
            })
        )

        const purgeUrl = "http://localhost:3000/cdn-cgi/image/__cache"

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
                    "/cdn-cgi/image/fit=cover,width=8,quality=72,format=auto/https://r2.silkchat.dev/generated/key-3"
            })
        )

        expect(response.status).toBe(400)
    })
})
