import { beforeEach, describe, expect, it, vi } from "vitest"

const { getUserIdentityMock } = vi.hoisted(() => ({
    getUserIdentityMock: vi.fn()
}))

vi.mock("convex/values", () => {
    const passthrough = () => ({})
    return {
        v: new Proxy(
            {},
            {
                get: () => passthrough
            }
        )
    }
})

vi.mock("convex/server", () => ({
    paginationOptsValidator: {}
}))

vi.mock("../../convex/_generated/server", () => ({
    internalMutation: (config: unknown) => config,
    internalQuery: (config: unknown) => config,
    mutation: (config: unknown) => config,
    query: (config: unknown) => config
}))

vi.mock("../../convex/lib/identity", () => ({
    getUserIdentity: getUserIdentityMock
}))

import { paginateGeneratedImages } from "../../convex/images"

const paginateGeneratedImagesHandler = paginateGeneratedImages as unknown as {
    handler: (ctx: any, args: any) => Promise<any>
}

const emptyPaginationResult = { page: [], continueCursor: "", isDone: true }

const createCtx = (result: Record<string, unknown> = emptyPaginationResult) => {
    const paginate = vi.fn().mockResolvedValue(result)
    const chain: any = {
        withIndex: vi.fn(() => chain),
        withSearchIndex: vi.fn(() => chain),
        order: vi.fn(() => chain),
        filter: vi.fn(() => chain),
        paginate
    }
    return { auth: {}, db: { query: () => chain }, chain, paginate }
}

const run = (ctx: ReturnType<typeof createCtx>, args: Record<string, unknown> = {}) =>
    paginateGeneratedImagesHandler.handler(ctx, {
        paginationOpts: { numItems: 20, cursor: null },
        view: "active",
        ...args
    })

describe("paginateGeneratedImages", () => {
    beforeEach(() => getUserIdentityMock.mockReset().mockResolvedValue({ id: "user-1" }))

    it("continues from an opaque cursor with a bounded read and preserves split metadata", async () => {
        const page = {
            page: [{ _id: "image" }],
            continueCursor: "opaque-next",
            isDone: false,
            splitCursor: "split",
            pageStatus: "SplitRecommended"
        }
        const ctx = createCtx(page)
        expect(
            await run(ctx, {
                paginationOpts: { numItems: 20, cursor: "opaque-start", endCursor: "opaque-end" }
            })
        ).toEqual(page)
        expect(ctx.paginate).toHaveBeenCalledWith(
            expect.objectContaining({
                cursor: "opaque-start",
                endCursor: "opaque-end",
                numItems: 20,
                maximumRowsRead: 512,
                maximumBytesRead: 2097152
            })
        )
    })

    it("keeps continuation available when a filtered page has no matches", async () => {
        const ctx = createCtx({
            page: [{ modelId: "other" }],
            continueCursor: "next",
            isDone: false
        })
        expect(await run(ctx, { filters: { modelIds: ["flux"] } })).toEqual({
            page: [],
            continueCursor: "next",
            isDone: false
        })
    })

    it("paginates search in relevance order and applies computed filters only to the returned page", async () => {
        const ctx = createCtx({
            page: [
                { _id: "portrait", aspectRatio: "2:3" },
                { _id: "landscape", aspectRatio: "3:2" }
            ],
            continueCursor: "search-next",
            isDone: false
        })
        expect(
            await run(ctx, {
                query: "portrait",
                sortBy: "oldest",
                filters: { orientations: ["portrait"] }
            })
        ).toEqual({
            page: [{ _id: "portrait", aspectRatio: "2:3" }],
            continueCursor: "search-next",
            isDone: false
        })
        expect(ctx.chain.order).not.toHaveBeenCalled()
    })

    it("uses chronological ordering without collecting the full library", async () => {
        const ctx = createCtx()
        await run(ctx, { sortBy: "oldest" })
        expect(ctx.chain.order).toHaveBeenCalledWith("asc")
        expect(ctx.paginate).toHaveBeenCalledTimes(1)
    })

    it.each(["newest", "oldest"])(
        "restricts archived %s pagination to the user's archived index range",
        async (sortBy) => {
            const ctx = createCtx()
            await run(ctx, { view: "archived", sortBy })
            const [index, range] = ctx.chain.withIndex.mock.calls[0]
            const eq = vi.fn().mockReturnThis()
            range({ eq })
            expect(index).toBe("byUserIdAndIsArchivedAndCreatedAt")
            expect(eq.mock.calls).toEqual([
                ["userId", "user-1"],
                ["isArchived", true]
            ])
            expect(ctx.chain.filter).not.toHaveBeenCalled()
            expect(ctx.chain.order).toHaveBeenCalledWith(sortBy === "oldest" ? "asc" : "desc")
        }
    )

    it("keeps missing and false archive flags active in their original chronological order", async () => {
        const ctx = createCtx({
            page: [
                { _id: "missing-new", createdAt: 4 },
                { _id: "false", isArchived: false, createdAt: 3 },
                { _id: "archived", isArchived: true, createdAt: 2 },
                { _id: "missing-old", createdAt: 1 }
            ],
            continueCursor: "",
            isDone: true
        })
        const result = await run(ctx)
        expect(result.page.map((image: { _id: string }) => image._id)).toEqual([
            "missing-new",
            "false",
            "missing-old"
        ])
        expect(ctx.chain.withIndex.mock.calls[0][0]).toBe("byUserIdAndCreatedAt")
    })

    it("returns an exhausted empty page without reading data for an unauthenticated user", async () => {
        getUserIdentityMock.mockResolvedValue({ error: "unauthorized" })
        const ctx = createCtx()
        expect(await run(ctx)).toEqual(emptyPaginationResult)
        expect(ctx.paginate).not.toHaveBeenCalled()
    })
})
