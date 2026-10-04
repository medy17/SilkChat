import { EventEmitter } from "node:events"
import { PassThrough } from "node:stream"
import type { IncomingMessage } from "node:http"
import type { RequestOptions } from "node:https"
import { beforeEach, expect, it, vi } from "vitest"
import { fetchVisualImage, isPublicImageIPv4 } from "../../convex/lib/visual_image_fetch_node"

const { lookup, request } = vi.hoisted(() => ({ lookup: vi.fn(), request: vi.fn() }))
vi.mock("node:dns/promises", () => ({ lookup }))
vi.mock("node:https", () => ({ request }))

const publicAddress = { address: "93.184.216.34", family: 4 }
const limit = 12 * 1024 * 1024
const respond =
    ({
        statusCode = 200,
        headers = { "content-type": "image/webp" },
        bytes = Buffer.from([1, 2, 3])
    }: {
        statusCode?: number
        headers?: Record<string, string>
        bytes?: Buffer
    } = {}) =>
    (_url: URL, _options: RequestOptions, onResponse: (res: IncomingMessage) => void) => {
        const req = Object.assign(new EventEmitter(), {
            end: () =>
                queueMicrotask(() => {
                    const res = Object.assign(new PassThrough(), { statusCode, headers })
                    onResponse(res as unknown as IncomingMessage)
                    if (!res.destroyed) res.end(bytes)
                }),
            destroy: (error: Error) => req.emit("error", error)
        })
        return req
    }

beforeEach(() => {
    lookup.mockReset().mockResolvedValue([publicAddress])
    request.mockReset().mockImplementation(respond())
})

it("allows public IPv4 but rejects local, metadata, reserved and malformed addresses", () => {
    for (const ip of [
        "127.0.0.1",
        "169.254.169.254",
        "10.0.0.1",
        "172.20.0.1",
        "192.168.1.1",
        "100.64.0.1",
        "198.18.0.1",
        "224.0.0.1",
        "203.0.113.1",
        "::1",
        "999.1.1.1"
    ])
        expect(isPublicImageIPv4(ip)).toBe(false)
    expect(isPublicImageIPv4(publicAddress.address)).toBe(true)
})

it("rejects the whole DNS result when any address is private", async () => {
    lookup.mockResolvedValue([publicAddress, { address: "127.0.0.1", family: 4 }])
    await expect(fetchVisualImage("https://image.test/image")).rejects.toThrow(
        "Unsupported image host"
    )
    expect(request).not.toHaveBeenCalled()
})

it("pins each public redirect hop to its validated DNS answer", async () => {
    lookup
        .mockResolvedValueOnce([publicAddress])
        .mockResolvedValueOnce([{ address: "8.8.8.8", family: 4 }])
    request.mockImplementationOnce(
        respond({ statusCode: 302, headers: { location: "https://redirect.test/image" } })
    )
    expect(await fetchVisualImage("https://image.test/redirect")).toEqual(new Uint8Array([1, 2, 3]))
    const pinned = request.mock.calls.map(([_url, options]) => {
        const callback = vi.fn()
        options.lookup("ignored.test", { all: true }, callback)
        return callback.mock.calls[0][1]
    })
    expect(pinned).toEqual([[publicAddress], [{ address: "8.8.8.8", family: 4 }]])
})

it("rejects a redirect to a private address before making its request", async () => {
    request.mockImplementationOnce(
        respond({ statusCode: 302, headers: { location: "https://private.test/image" } })
    )
    lookup
        .mockResolvedValueOnce([publicAddress])
        .mockResolvedValueOnce([{ address: "169.254.169.254", family: 4 }])
    await expect(fetchVisualImage("https://image.test/redirect")).rejects.toThrow(
        "Unsupported image host"
    )
    expect(request.mock.calls.map(([url]) => url.hostname)).toEqual(["image.test"])
    expect(lookup.mock.calls.map(([hostname]) => hostname)).toEqual(["image.test", "private.test"])
})

it("stops after three redirects", async () => {
    request.mockImplementation(respond({ statusCode: 302, headers: { location: "/again" } }))
    await expect(fetchVisualImage("https://image.test/loop")).rejects.toThrow(
        "Unsupported image URL"
    )
    expect(request).toHaveBeenCalledTimes(4)
})

it.each<{ name: string; headers: Record<string, string>; bytes: Buffer; error: string }>([
    {
        name: "declared size",
        headers: { "content-type": "image/webp", "content-length": String(limit + 1) },
        bytes: Buffer.alloc(0),
        error: "Invalid image response"
    },
    {
        name: "streamed bytes",
        headers: { "content-type": "image/webp" },
        bytes: Buffer.alloc(limit + 1),
        error: "Image exceeds download limit"
    }
])("enforces the byte limit for $name", async ({ headers, bytes, error }) => {
    request.mockImplementationOnce(respond({ headers, bytes }))
    await expect(fetchVisualImage("https://image.test/image")).rejects.toThrow(error)
})
