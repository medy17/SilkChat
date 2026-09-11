import { beforeEach, describe, expect, it, vi } from "vitest"
import { validateStoredPdf } from "../../convex/lib/stored_pdf_validation_node"
import { createPdf } from "../fixtures/pdf"
import type { ActionCtx } from "../../convex/_generated/server"
import { MAX_FILE_SIZE } from "@/lib/file_constants"

const { metadata, getMetadata, getUrl } = vi.hoisted(() => {
    const metadata = {
        bucket: "bucket",
        lastModified: "2026-09-11",
        size: 0,
        uploadStatus: "ready"
    }
    return { metadata, getMetadata: vi.fn(), getUrl: vi.fn() }
})
vi.mock("../../convex/attachments", () => ({ r2: { getMetadata, getUrl } }))
vi.mock("../../convex/_generated/api", () => ({
    internal: { pdf_validations: { get: "get", save: "save" } }
}))

const makeContext = () => {
    let record: Record<string, unknown> | null = null
    return {
        runQuery: vi.fn(async () => record),
        runMutation: vi.fn(async (_ref, args) => {
            record = args
        })
    } as unknown as ActionCtx
}

describe("persisted PDF validation", () => {
    beforeEach(() => {
        metadata.lastModified = "2026-09-11"
        getMetadata.mockImplementation(async () => ({ ...metadata }))
        getUrl.mockResolvedValue("https://example.com/report.pdf")
    })

    it.each([30, 31])(
        "reuses a %i-page count without downloading or parsing again",
        async (pages) => {
            const file = createPdf(pages)
            metadata.size = file.size
            const fetchMock = vi.fn(async () => new Response(file))
            vi.stubGlobal("fetch", fetchMock)
            const ctx = makeContext()
            for (let turn = 0; turn < 3; turn++) {
                const result = validateStoredPdf(ctx, "attachments/user/report.pdf", "report.pdf")
                if (pages === 30) await expect(result).resolves.toBe(30)
                else await expect(result).rejects.toThrow("has 31 pages")
            }
            expect(fetchMock).toHaveBeenCalledTimes(1)
            expect(ctx.runMutation).toHaveBeenCalledTimes(1)
        }
    )

    it("revalidates when the stored object's metadata changes", async () => {
        const file = createPdf(1)
        metadata.size = file.size
        const fetchMock = vi.fn(async () => new Response(file))
        vi.stubGlobal("fetch", fetchMock)
        const ctx = makeContext()
        await validateStoredPdf(ctx, "attachments/user/report.pdf", "report.pdf")
        metadata.lastModified = "2026-09-12"
        await validateStoredPdf(ctx, "attachments/user/report.pdf", "report.pdf")
        expect(fetchMock).toHaveBeenCalledTimes(2)
    })

    it("caches unreadable-file rejection but retries transient download failures", async () => {
        const file = new Blob(["broken"])
        metadata.size = file.size
        const fetchMock = vi
            .fn()
            .mockResolvedValueOnce(new Response(null, { status: 503 }))
            .mockImplementation(async () => new Response(file))
        vi.stubGlobal("fetch", fetchMock)
        const ctx = makeContext()
        await expect(
            validateStoredPdf(ctx, "attachments/user/report.pdf", "report.pdf")
        ).rejects.toThrow("Failed to download")
        for (let turn = 0; turn < 2; turn++) {
            await expect(
                validateStoredPdf(ctx, "attachments/user/report.pdf", "report.pdf")
            ).rejects.toThrow("Could not verify")
        }
        expect(fetchMock).toHaveBeenCalledTimes(2)
    })

    it("rejects foreign PDFs without fetching them", async () => {
        const fetchMock = vi.fn()
        vi.stubGlobal("fetch", fetchMock)
        await expect(
            validateStoredPdf(makeContext(), "https://example.com/report.pdf", "report.pdf")
        ).rejects.toThrow("External PDFs")
        expect(fetchMock).not.toHaveBeenCalled()
    })

    it("caches metadata size rejection without downloading", async () => {
        metadata.size = MAX_FILE_SIZE + 1
        const fetchMock = vi.fn()
        vi.stubGlobal("fetch", fetchMock)
        const ctx = makeContext()
        for (let turn = 0; turn < 3; turn++) {
            await expect(
                validateStoredPdf(ctx, "attachments/user/report.pdf", "report.pdf")
            ).rejects.toThrow("exceeds the file size limit")
        }
        expect(fetchMock).not.toHaveBeenCalled()
        expect(ctx.runMutation).toHaveBeenCalledTimes(1)
    })

    it.each(["declared", "streamed"])(
        "caches a %s download size rejection until the object changes",
        async (source) => {
            metadata.size = 100
            // Cancellation errors must not hide the size violation and make it retryable.
            const cancel = vi.fn(async () => {
                throw new Error("connection closed")
            })
            const fetchMock = vi.fn(
                async () =>
                    new Response(
                        new ReadableStream({
                            start(controller) {
                                if (source === "streamed") {
                                    controller.enqueue(new Uint8Array(MAX_FILE_SIZE))
                                    controller.enqueue(new Uint8Array(1))
                                }
                            },
                            cancel
                        }),
                        {
                            headers: {
                                "content-length": String(
                                    source === "declared" ? MAX_FILE_SIZE + 1 : 100
                                )
                            }
                        }
                    )
            )
            vi.stubGlobal("fetch", fetchMock)
            const ctx = makeContext()
            for (let turn = 0; turn < 3; turn++) {
                await expect(
                    validateStoredPdf(ctx, "attachments/user/report.pdf", "report.pdf")
                ).rejects.toThrow("File size exceeds")
            }
            expect(fetchMock).toHaveBeenCalledTimes(1)
            expect(cancel).toHaveBeenCalledOnce()
            expect(ctx.runMutation).toHaveBeenCalledTimes(1)

            const replacement = createPdf(1)
            metadata.size = replacement.size
            metadata.lastModified = "2026-09-12"
            fetchMock.mockImplementation(async () => new Response(replacement))
            await expect(
                validateStoredPdf(ctx, "attachments/user/report.pdf", "report.pdf")
            ).resolves.toBe(1)
            expect(fetchMock).toHaveBeenCalledTimes(2)
        }
    )

    it("does not cache interrupted downloads", async () => {
        const file = createPdf(1)
        metadata.size = file.size
        const fetchMock = vi
            .fn()
            .mockResolvedValueOnce(
                new Response(
                    new ReadableStream({
                        start(controller) {
                            controller.error(new Error("connection reset"))
                        }
                    })
                )
            )
            .mockImplementation(async () => new Response(file))
        vi.stubGlobal("fetch", fetchMock)
        const ctx = makeContext()
        await expect(
            validateStoredPdf(ctx, "attachments/user/report.pdf", "report.pdf")
        ).rejects.toThrow("connection reset")
        expect(ctx.runMutation).not.toHaveBeenCalled()
        await expect(
            validateStoredPdf(ctx, "attachments/user/report.pdf", "report.pdf")
        ).resolves.toBe(1)
        expect(fetchMock).toHaveBeenCalledTimes(2)
    })
})
