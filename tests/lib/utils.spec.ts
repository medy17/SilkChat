// @vitest-environment jsdom

import { afterEach, describe, expect, it, vi } from "vitest"

import { copyImageUrlToClipboard, downloadUrl } from "@/lib/utils"

describe("downloadUrl", () => {
    afterEach(() => {
        vi.restoreAllMocks()
        vi.unstubAllGlobals()
    })

    it("downloads a fetched file without navigating to it", async () => {
        const clickMock = vi.fn()
        const removeMock = vi.fn()
        const revokeObjectUrlMock = vi.fn()
        const anchor = {
            href: "",
            download: "",
            hidden: false,
            click: clickMock,
            remove: removeMock
        }

        vi.stubGlobal(
            "fetch",
            vi.fn().mockResolvedValue({
                ok: true,
                status: 200,
                blob: async () => new Blob(["image"], { type: "image/webp" })
            })
        )
        vi.stubGlobal("URL", {
            createObjectURL: vi.fn(() => "blob:download"),
            revokeObjectURL: revokeObjectUrlMock
        })
        vi.spyOn(document, "createElement").mockReturnValue(anchor as unknown as HTMLAnchorElement)
        vi.spyOn(document.body, "appendChild").mockImplementation((node) => node)

        await downloadUrl({ url: "https://cdn.example.com/image.webp", fileName: "image.webp" })

        expect(anchor).toMatchObject({
            href: "blob:download",
            download: "image.webp",
            hidden: true
        })
        expect(clickMock).toHaveBeenCalledOnce()
        expect(removeMock).toHaveBeenCalledOnce()
        expect(revokeObjectUrlMock).toHaveBeenCalledWith("blob:download")
    })
})

describe("copyImageUrlToClipboard", () => {
    afterEach(() => {
        vi.restoreAllMocks()
        vi.unstubAllGlobals()
    })

    it("writes png images directly to the clipboard", async () => {
        const writeMock = vi.fn().mockResolvedValue(undefined)
        const clipboardItemMock = vi.fn()
        class ClipboardItemMock {
            items: Record<string, Blob>

            constructor(items: Record<string, Blob>) {
                this.items = items
                clipboardItemMock(items)
            }
        }

        vi.stubGlobal(
            "fetch",
            vi.fn().mockResolvedValue({
                ok: true,
                status: 200,
                blob: async () => new Blob(["png"], { type: "image/png" })
            })
        )
        vi.stubGlobal("navigator", {
            clipboard: {
                write: writeMock
            }
        })
        vi.stubGlobal("ClipboardItem", ClipboardItemMock)

        await copyImageUrlToClipboard("/convex-http/r2?key=image")

        expect(writeMock).toHaveBeenCalledTimes(1)
        expect(clipboardItemMock).toHaveBeenCalledWith({
            "image/png": expect.any(Blob)
        })
    })

    it("falls back to png encoding when the original mime type write fails", async () => {
        const writeMock = vi
            .fn()
            .mockRejectedValueOnce(new Error("unsupported mime"))
            .mockResolvedValueOnce(undefined)
        const clipboardItemMock = vi.fn()
        const drawImageMock = vi.fn()
        const toBlobMock = vi.fn((callback: BlobCallback) =>
            callback(new Blob(["png"], { type: "image/png" }))
        )
        const originalCreateElement = document.createElement.bind(document)
        class ClipboardItemMock {
            items: Record<string, Blob>

            constructor(items: Record<string, Blob>) {
                this.items = items
                clipboardItemMock(items)
            }
        }

        vi.stubGlobal(
            "fetch",
            vi.fn().mockResolvedValue({
                ok: true,
                status: 200,
                blob: async () => new Blob(["jpeg"], { type: "image/jpeg" })
            })
        )
        vi.stubGlobal("navigator", {
            clipboard: {
                write: writeMock
            }
        })
        vi.stubGlobal("ClipboardItem", ClipboardItemMock)
        vi.stubGlobal(
            "createImageBitmap",
            vi.fn().mockResolvedValue({
                width: 10,
                height: 20,
                close: vi.fn()
            })
        )
        vi.spyOn(document, "createElement").mockImplementation((tagName: string) => {
            if (tagName === "canvas") {
                return {
                    width: 0,
                    height: 0,
                    getContext: vi.fn(() => ({
                        drawImage: drawImageMock
                    })),
                    toBlob: toBlobMock
                } as unknown as HTMLCanvasElement
            }

            return originalCreateElement(tagName)
        })

        await copyImageUrlToClipboard("/convex-http/r2?key=image")

        expect(writeMock).toHaveBeenCalledTimes(2)
        expect(drawImageMock).toHaveBeenCalledTimes(1)
        expect(clipboardItemMock).toHaveBeenLastCalledWith({
            "image/png": expect.any(Blob)
        })
    })
})
