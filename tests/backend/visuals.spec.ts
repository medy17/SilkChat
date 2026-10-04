import { convexTest } from "convex-test"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import schema from "../../convex/schema"
import { api, internal } from "../../convex/_generated/api"
import { getImageSearchTool } from "../../convex/lib/tools/image_search"
import { visualRequestKey } from "../../src/lib/visual-selections"

const modules = import.meta.glob("../../convex/**/*.ts")
const setup = async () => {
    const t = convexTest(schema, modules)
    const ids = await t.run(async (ctx) => {
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
        return { threadId, messageDocId }
    })
    return { t, ...ids }
}
const image = {
    searchQuery: "leopard",
    id: "img_search_2",
    title: "Snow leopard",
    source: "example.org",
    sourceUrl: "https://example.org/leopard",
    originalUrl: "https://example.org/leopard.jpg",
    storageKey: "image-search/owner/run/2.webp",
    thumbnailUrl: "https://assets.test/image-search/owner/run/2.webp"
}

describe("durable visual resolution", () => {
    it.each(["deleted", "replaced", "newer-stream"])(
        "finalizes a stream when its message was %s without scheduling visuals",
        async (scenario) => {
            const { t, threadId, messageDocId } = await setup()
            const { streamId, activeStreamId } = await t.run(async (ctx) => {
                const streamId = await ctx.db.insert("streams", { threadId, createdAt: 1 })
                const replacement = await ctx.db.insert("streams", { threadId, createdAt: 2 })
                const activeStreamId = scenario === "newer-stream" ? replacement : streamId
                await ctx.db.patch(threadId, {
                    isLive: true,
                    currentStreamId: activeStreamId,
                    lastStreamId: activeStreamId
                })
                if (scenario === "deleted") await ctx.db.delete(messageDocId)
                else await ctx.db.patch(messageDocId, { generationStreamId: replacement })
                return { streamId, activeStreamId }
            })
            await t.mutation(internal.messages.finalizeStream, {
                threadId,
                expectedStreamId: streamId,
                expectedMessageId: messageDocId,
                messageId: "answer",
                parts: [{ type: "text", text: "<visual>leopard</visual>" }],
                resolveVisuals: true
            })
            const state = await t.run(async (ctx) => ({
                stream: await ctx.db.get(streamId),
                thread: await ctx.db.get(threadId),
                message: await ctx.db.get(messageDocId),
                jobs: await ctx.db.system.query("_scheduled_functions").collect()
            }))
            expect(state.stream?.finalizedAt).toEqual(expect.any(Number))
            expect(state.thread?.isLive).toBe(scenario === "newer-stream")
            expect(state.thread?.currentStreamId).toBe(
                scenario === "newer-stream" ? activeStreamId : undefined
            )
            expect(state.message?.metadata.visualStatus).toBeUndefined()
            expect(state.jobs).toEqual([])
        }
    )

    it.each(["history", "tool result"])(
        "handles another owner's durable image from %s",
        async (origin) => {
            const { t, messageDocId } = await setup()
            const foreign = { ...image, storageKey: "image-search/other-user/run/2.webp" }
            const key = visualRequestKey({
                cue: "",
                variant: "gallery",
                limit: 3,
                refs: [image.id]
            })
            await t.run((ctx) =>
                ctx.db.patch(messageDocId, {
                    parts: [
                        { type: "text", text: `<visual reference="${image.id}"></visual>` },
                        ...(origin === "tool result"
                            ? [
                                  {
                                      type: "tool-invocation" as const,
                                      toolInvocation: {
                                          toolName: "image_search",
                                          toolCallId: "call",
                                          state: "result" as const,
                                          args: {},
                                          result: { success: true, results: [foreign] }
                                      }
                                  }
                              ]
                            : [])
                    ],
                    metadata: {
                        visualStatus: "pending",
                        ...(origin === "history"
                            ? { visualSelections: [{ key, cue: "", visuals: [foreign] }] }
                            : {})
                    }
                })
            )
            await t.action(internal.visuals_node.resolveMessage, { messageDocId })
            const saved = await t.query(internal.visuals.getMessage, { messageDocId })
            // A forked image is reused read-only; a tool result must be the user's own upload.
            expect(saved?.message.metadata.visualSelections?.[0].visuals).toEqual(
                origin === "history"
                    ? [
                          {
                              ...foreign,
                              thumbnailUrl: "https://assets.test/image-search/other-user/run/2.webp"
                          }
                      ]
                    : []
            )
        }
    )

    beforeEach(() => {
        vi.useFakeTimers()
        vi.stubEnv("R2_PUBLIC_BASE_URL", "https://assets.test")
    })
    afterEach(() => {
        vi.clearAllTimers()
        vi.useRealTimers()
        vi.unstubAllEnvs()
    })

    it("replays a search without another quota charge and isolates retry documents", async () => {
        const { t, messageDocId, threadId } = await setup()
        const args = {
            userId: "owner",
            messageDocId,
            requestKey: "tool:call-1",
            query: "snow leopard"
        }
        const first = await t.mutation(internal.visuals.claimSearch, args)
        expect(first.claimed).toBe(true)
        await t.mutation(internal.visuals.finishSearch, { runId: first.run._id, assets: [image] })
        const replay = await t.mutation(internal.visuals.claimSearch, args)
        expect(replay).toMatchObject({ claimed: false, run: { status: "ready", assets: [image] } })
        expect(await t.run((ctx) => ctx.db.query("rateLimit").first())).toMatchObject({ count: 1 })
        const replacement = await t.run(async (ctx) => {
            await ctx.db.delete(messageDocId)
            return ctx.db.insert("messages", {
                threadId,
                messageId: "answer",
                role: "assistant",
                parts: [],
                metadata: {},
                createdAt: 2,
                updatedAt: 2
            })
        })
        expect(
            (await t.mutation(internal.visuals.claimSearch, { ...args, messageDocId: replacement }))
                .claimed
        ).toBe(true)
        expect(await t.run((ctx) => ctx.db.query("rateLimit").first())).toMatchObject({ count: 2 })
    })

    it("rejects another owner and exhausted quota before creating search work", async () => {
        const { t, messageDocId } = await setup()
        await expect(
            t.mutation(internal.visuals.claimSearch, {
                userId: "other",
                messageDocId,
                requestKey: "call",
                query: "cat"
            })
        ).rejects.toThrow("unavailable")
        expect(await t.run((ctx) => ctx.db.query("rateLimit").collect())).toEqual([])
        await t.run((ctx) =>
            ctx.db.insert("rateLimit", {
                key: "visual-search:owner",
                count: 30,
                lastRequest: Date.now()
            })
        )
        await expect(
            t.mutation(internal.visuals.claimSearch, {
                userId: "owner",
                messageDocId,
                requestKey: "call",
                query: "cat"
            })
        ).rejects.toThrow("allowance")
        expect(await t.run((ctx) => ctx.db.query("visualSearchRuns").collect())).toEqual([])
    })

    it("rejects late visual writes from a superseded generation", async () => {
        const { t, threadId, messageDocId } = await setup()
        const register = () =>
            t.mutation(internal.streams.appendStreamId, {
                threadId,
                userId: "owner",
                assistantMessageConvexId: messageDocId
            })
        const old = await register()
        await register()
        expect(
            await t.mutation(internal.visuals.finishSelection, {
                messageDocId,
                expectedStreamId: old,
                selections: [{ key: "old", cue: "", visuals: [image] }]
            })
        ).toBe(false)
        expect(
            (await t.query(internal.visuals.getMessage, { messageDocId }))?.message.metadata
                .visualSelections
        ).toBeUndefined()
    })

    it("does not let a late partial result undo the stall watchdog", async () => {
        const { t, messageDocId } = await setup()
        await t.run((ctx) => ctx.db.patch(messageDocId, { metadata: { visualStatus: "pending" } }))
        await t.mutation(internal.visuals.failStalledSelection, { messageDocId })
        expect(
            await t.mutation(internal.visuals.finishSelection, {
                messageDocId,
                partial: true,
                selections: []
            })
        ).toBe(false)
        expect(
            (await t.query(internal.visuals.getMessage, { messageDocId }))?.message.metadata
                .visualStatus
        ).toBe("failed")
    })

    it("reports why legacy loading cannot start while a reply is live", async () => {
        const { t, threadId, messageDocId } = await setup()
        await t.run(async (ctx) => {
            await ctx.db.patch(threadId, { isLive: true })
            await ctx.db.patch(messageDocId, {
                parts: [{ type: "text", text: "<visual>leopard</visual>" }]
            })
        })
        const signedIn = t.withIdentity({ subject: "owner" })
        expect(
            await signedIn.mutation(api.visuals.resolveLegacy, { threadId, messageId: "answer" })
        ).toBe("busy")
        expect(
            (await t.query(internal.visuals.getMessage, { messageDocId }))?.message.metadata
                .visualStatus
        ).toBeUndefined()
    })

    it("starts legacy resolution once and reports repeat calls as already started", async () => {
        const { t, threadId, messageDocId } = await setup()
        await t.run((ctx) =>
            ctx.db.patch(messageDocId, {
                parts: [{ type: "text", text: "<visual>leopard</visual>" }]
            })
        )
        const signedIn = t.withIdentity({ subject: "owner" })
        const args = { threadId, messageId: "answer" }
        expect(await signedIn.mutation(api.visuals.resolveLegacy, args)).toBe("started")
        expect(
            (await t.query(internal.visuals.getMessage, { messageDocId }))?.message.metadata
                .visualStatus
        ).toBe("pending")
        const scheduled = await t.run((ctx) =>
            ctx.db.system.query("_scheduled_functions").collect()
        )
        expect(scheduled).toHaveLength(2)
        expect(await signedIn.mutation(api.visuals.resolveLegacy, args)).toBe("already-started")
        expect(await t.run((ctx) => ctx.db.system.query("_scheduled_functions").collect())).toEqual(
            scheduled
        )
    })

    it("does not resolve quick-look images as references on later turns", async () => {
        const { t, threadId, messageDocId } = await setup()
        await t.run(async (ctx) => {
            await ctx.db.insert("messages", {
                threadId,
                messageId: "earlier",
                role: "assistant",
                createdAt: 0,
                updatedAt: 0,
                parts: [{ type: "text", text: "<visual>leopard</visual>" }],
                metadata: {
                    visualSelections: [
                        { key: '["gallery","leopard",3]', cue: "leopard", visuals: [image] }
                    ]
                }
            })
            await ctx.db.patch(messageDocId, {
                parts: [{ type: "text", text: `<visual reference="${image.id}"></visual>` }],
                metadata: { visualStatus: "pending" }
            })
        })
        await t.action(internal.visuals_node.resolveMessage, { messageDocId })
        const saved = await t.query(internal.visuals.getMessage, { messageDocId })
        expect(saved?.message.metadata.visualSelections?.[0].visuals).toEqual([])
        expect(await t.run((ctx) => ctx.db.query("visualSearchRuns").collect())).toEqual([])
    })

    it("publishes finished cards independently while retaining markup order", async () => {
        const { t, messageDocId } = await setup()
        const requests = ["first", "second"].map((cue) => ({
            cue,
            variant: "gallery" as const,
            limit: 3
        }))
        const selections = requests.map((request) => ({
            key: visualRequestKey(request),
            cue: request.cue,
            visuals: [image]
        }))
        await t.run((ctx) =>
            ctx.db.patch(messageDocId, {
                parts: [{ type: "text", text: "<visual>first</visual>\n<visual>second</visual>" }],
                metadata: { visualStatus: "pending" }
            })
        )
        await t.mutation(internal.visuals.finishSelection, {
            messageDocId,
            selections: [selections[1]],
            partial: true
        })
        expect(
            (await t.query(internal.visuals.getMessage, { messageDocId }))?.message.metadata
        ).toMatchObject({ visualStatus: "pending", visualSelections: [selections[1]] })
        await t.mutation(internal.visuals.finishSelection, {
            messageDocId,
            selections: [selections[0]],
            partial: true
        })
        expect(
            (await t.query(internal.visuals.getMessage, { messageDocId }))?.message.metadata
                .visualSelections
        ).toEqual(selections)
        await t.mutation(internal.visuals.finishSelection, { messageDocId, selections })
        expect(
            await t.mutation(internal.visuals.finishSelection, {
                messageDocId,
                selections: [],
                partial: true
            })
        ).toBe(false)
    })

    it("groups retained images across turns without a new search", async () => {
        const { t, threadId, messageDocId } = await setup()
        const second = {
            ...image,
            id: "img_other_search_1",
            storageKey: "image-search/owner/other/1.webp",
            thumbnailUrl: "https://untrusted.test/override.webp",
            searchQuery: "leopard details"
        }
        await t.run(async (ctx) => {
            await ctx.db.insert("messages", {
                threadId,
                messageId: "earlier",
                role: "assistant",
                parts: [{ type: "text", text: "Earlier illustration" }],
                metadata: {
                    visualSelections: [
                        {
                            key: visualRequestKey({
                                cue: "",
                                variant: "gallery",
                                limit: 3,
                                refs: [image.id]
                            }),
                            cue: "",
                            visuals: [image]
                        }
                    ]
                },
                createdAt: 0,
                updatedAt: 0
            })
            await ctx.db.patch(messageDocId, {
                parts: [
                    {
                        type: "text",
                        text: `<carousel mode="referential"><visual reference="${second.id}" title="New result"></visual><visual reference="${image.id}"></visual></carousel>\n<visual reference="${image.id}"></visual>`
                    },
                    {
                        type: "tool-invocation",
                        toolInvocation: {
                            toolName: "image_search",
                            toolCallId: "second-search",
                            state: "result",
                            args: { query: "leopard details" },
                            result: {
                                success: true,
                                query: "leopard details",
                                results: [second]
                            }
                        }
                    }
                ],
                metadata: { visualStatus: "pending" }
            })
        })
        await t.action(internal.visuals_node.resolveMessage, { messageDocId })
        const result = await t.query(internal.visuals.getMessage, { messageDocId })
        expect(
            result?.message.metadata.visualSelections?.map((block) =>
                block.visuals.map((image) => image.id)
            )
        ).toEqual([[second.id, image.id], [image.id]])
        expect(
            result?.message.metadata.visualSelections?.[0].visuals.map((image) => image.searchQuery)
        ).toEqual(["leopard details", "leopard"])
        expect(await t.run((ctx) => ctx.db.query("rateLimit").collect())).toEqual([])
        expect(await t.run((ctx) => ctx.db.query("visualSearchRuns").collect())).toEqual([])
        expect(result?.message.metadata.visualSelections?.[0].visuals[0].thumbnailUrl).toBe(
            "https://assets.test/image-search/owner/other/1.webp"
        )
    })
    it("returns a textual tool failure without requiring candidate results", async () => {
        const tool = getImageSearchTool({} as never, "owner", "message" as never).image_search
        const exhausted = await tool.toModelOutput!({
            toolCallId: "blocked",
            input: { query: "snow leopard" },
            output: { success: false, error: "Tool budget exhausted" } as never
        })
        expect(exhausted).toMatchObject({
            type: "content",
            value: [{ type: "text", text: expect.stringContaining("Tool budget exhausted") }]
        })
    })
})
