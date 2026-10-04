import { convexTest } from "convex-test"
import sharp from "sharp"
import { afterEach, beforeAll, beforeEach, expect, it, vi } from "vitest"
import schema from "../../convex/schema"
import { internal } from "../../convex/_generated/api"

const { download, search, store, getUrl, getMetadata, deleteObject, deletionBlocker } = vi.hoisted(
    () => ({
        download: vi.fn(),
        search: vi.fn(),
        store: vi.fn(),
        getUrl: vi.fn(),
        getMetadata: vi.fn(),
        deleteObject: vi.fn(),
        deletionBlocker: vi.fn()
    })
)
vi.mock("../../convex/lib/visual_image_fetch_node", () => ({ fetchVisualImage: download }))
vi.mock("../../src/lib/brave-image-search", () => ({ searchBraveImageCandidates: search }))
vi.mock("../../convex/attachments", () => ({ r2: { store, getUrl, getMetadata, deleteObject } }))
vi.mock("../../convex/lib/account_deletion_gate", () => ({
    getAccountDeletionBlockerForAction: deletionBlocker
}))
const modules = import.meta.glob("../../convex/**/*.ts")
let bytes: Buffer
beforeAll(async () => {
    bytes = await sharp({ create: { width: 300, height: 240, channels: 3, background: "white" } })
        .webp()
        .toBuffer()
})
beforeEach(() => {
    vi.useFakeTimers()
    vi.stubEnv("BRAVE_API_KEY", "test-key")
    vi.stubEnv("R2_PUBLIC_BASE_URL", "https://assets.test")
    vi.resetAllMocks()
    deletionBlocker.mockResolvedValue(null)
})
afterEach(() => {
    vi.clearAllTimers()
    vi.useRealTimers()
    vi.unstubAllEnvs()
})

it.each(["quick-look", "inspect"])(
    "captures %s images concurrently with the appropriate storage lifetime",
    async (mode) => {
        const t = convexTest(schema, modules)
        const messageDocId = await t.run(async (ctx) => {
            const threadId = await ctx.db.insert("threads", {
                authorId: "owner",
                title: "Images",
                createdAt: 1,
                updatedAt: 1
            })
            return ctx.db.insert("messages", {
                threadId,
                messageId: "answer",
                role: "assistant",
                parts: [
                    {
                        type: "text",
                        text: '<carousel mode="quick-look" query="snow leopard"></carousel>'
                    }
                ],
                metadata: { visualStatus: "pending" },
                createdAt: 1,
                updatedAt: 1
            })
        })
        const candidates = [1, 2, 3].map((index) => ({
            title: `Image ${index}`,
            source: "publisher.test",
            sourceUrl: `https://publisher.test/page-${index}`,
            thumbnailUrl: `https://publisher.test/${index}.jpg`,
            fallbackUrl: `https://imgs.search.brave.com/${index}`,
            confidence: "high"
        }))
        search.mockResolvedValue({ candidates, strictWarning: false })
        let active = 0
        let maxActive = 0
        download.mockImplementation(async () => {
            active++
            maxActive = Math.max(maxActive, active)
            await Promise.resolve()
            active--
            return bytes
        })
        if (mode === "inspect")
            await t.action(internal.visuals_node.search, {
                messageDocId,
                userId: "owner",
                toolCallId: "call",
                query: "snow leopard"
            })
        else await t.action(internal.visuals_node.resolveMessage, { messageDocId })
        expect(maxActive).toBe(3)
        expect(download.mock.calls.map(([url]) => url)).toEqual(
            candidates.map((candidate) =>
                mode === "inspect" ? candidate.thumbnailUrl : candidate.fallbackUrl
            )
        )
        const keys = store.mock.calls.map(([, , options]) => options.key as string)
        expect(keys).toHaveLength(3)
        expect(
            keys.every((key) =>
                key.startsWith(
                    mode === "inspect" ? "tool-outputs/owner/image-search/" : "image-search/owner/"
                )
            )
        ).toBe(true)
        expect(getUrl).not.toHaveBeenCalled()
        expect(deletionBlocker).toHaveBeenCalledTimes(1)
        if (mode === "quick-look") {
            const message = await t.query(internal.visuals.getMessage, { messageDocId })
            expect(message?.message.metadata.visualStatus).toBe("ready")
            expect(
                message?.message.metadata.visualSelections?.[0].visuals.map((image) => image.title)
            ).toEqual(["Image 1", "Image 2", "Image 3"])
        }
    }
)

it.each(["quick", "tool", "unexpired"])(
    "cleans %s runs without deleting missing slots",
    async (mode) => {
        const t = convexTest(schema, modules)
        const runId = await t.run(async (ctx) => {
            const threadId = await ctx.db.insert("threads", {
                authorId: "owner",
                title: "Images",
                createdAt: 1,
                updatedAt: 1
            })
            const messageDocId = await ctx.db.insert("messages", {
                threadId,
                messageId: "answer",
                role: "assistant",
                parts: [],
                metadata: {},
                createdAt: 1,
                updatedAt: 1
            })
            return ctx.db.insert("visualSearchRuns", {
                userId: "owner",
                messageDocId,
                requestKey: mode === "tool" ? "tool:call" : "quick:card",
                query: "frog",
                status: "pending",
                assets: [],
                expiresAt: mode === "unexpired" ? Date.now() + 1000 : Date.now() - 1
            })
        })
        // Includes a noncontiguous upload absent from run.assets after interruption.
        const keys = [2, 7].map((slot) => `tool-outputs/owner/image-search/${runId}/${slot}.webp`)
        getMetadata.mockImplementation(async (_ctx, key) =>
            keys.includes(key) ? { key, authorId: "owner" } : null
        )
        await t.action(internal.visuals_node.cleanupRun, { runId })
        const skipped = mode === "quick" || mode === "unexpired"
        expect(getMetadata).toHaveBeenCalledTimes(skipped ? 0 : 8)
        expect(deleteObject.mock.calls.map(([, key]) => key)).toEqual(skipped ? [] : keys)
        expect(await t.query(internal.visuals.getRun, { runId })).toEqual(
            mode === "unexpired" ? expect.objectContaining({ _id: runId }) : null
        )
    }
)

it.each([false, true])(
    "checks account deletion once across selected promotions (blocked=%s)",
    async (blocked) => {
        const t = convexTest(schema, modules)
        const images = [1, 2, 3].map((slot) => ({
            id: `img_${slot}`,
            title: `Image ${slot}`,
            source: "example.com",
            sourceUrl: "https://example.com/frog",
            originalUrl: "https://example.com/frog.webp",
            thumbnailUrl: `https://assets.test/tool-outputs/owner/image-search/run/${slot}.webp`,
            storageKey: `tool-outputs/owner/image-search/run/${slot}.webp`
        }))
        const messageDocId = await t.run(async (ctx) => {
            const threadId = await ctx.db.insert("threads", {
                authorId: "owner",
                title: "Images",
                createdAt: 1,
                updatedAt: 1
            })
            return ctx.db.insert("messages", {
                threadId,
                messageId: "answer",
                role: "assistant",
                createdAt: 1,
                updatedAt: 1,
                metadata: { visualStatus: "pending" },
                parts: [
                    {
                        type: "tool-invocation",
                        toolInvocation: {
                            toolName: "image_search",
                            toolCallId: "call",
                            state: "result",
                            args: { query: "frog" },
                            result: { success: true, results: images }
                        }
                    },
                    {
                        type: "text",
                        text: '<carousel mode="referential"><visual reference="img_1"></visual><visual reference="img_2"></visual></carousel>\n<visual reference="img_3"></visual>'
                    }
                ]
            })
        })
        getMetadata.mockResolvedValue({ authorId: "owner" })
        getUrl.mockResolvedValue("https://assets.test/staged.webp")
        deletionBlocker.mockResolvedValue(blocked ? { status: "pending" } : null)
        const originalFetch = globalThis.fetch
        globalThis.fetch = vi.fn(async () => new Response(new Uint8Array(bytes)))
        try {
            await t.action(internal.visuals_node.resolveMessage, { messageDocId })
            expect(deletionBlocker).toHaveBeenCalledTimes(1)
            expect(store).toHaveBeenCalledTimes(blocked ? 0 : 3)
            const saved = await t.query(internal.visuals.getMessage, { messageDocId })
            expect(saved?.message.metadata.visualStatus).toBe(blocked ? "failed" : "ready")
        } finally {
            globalThis.fetch = originalFetch
        }
    }
)
