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

const createCtx = ({
    indexPaginateResults = [],
    indexCollectResult = [],
    searchCollectResult = []
}: {
    indexPaginateResults?: Array<{
        page: Array<Record<string, any>>
        continueCursor: string
        isDone: boolean
    }>
    indexCollectResult?: Array<Record<string, any>>
    searchCollectResult?: Array<Record<string, any>>
}) => {
    const paginateMock = vi
        .fn()
        .mockImplementation(async () => indexPaginateResults.shift() ?? emptyPaginationResult)
    const indexCollectMock = vi.fn().mockResolvedValue(indexCollectResult)
    const searchCollectMock = vi.fn().mockResolvedValue(searchCollectResult)
    const filterMock = vi.fn().mockReturnValue({
        order: vi.fn().mockReturnValue({
            paginate: paginateMock
        })
    })

    return {
        auth: {},
        db: {
            query: vi.fn().mockReturnValue({
                withIndex: vi.fn().mockReturnValue({
                    filter: filterMock,
                    order: vi.fn().mockReturnValue({
                        paginate: paginateMock
                    }),
                    collect: indexCollectMock
                }),
                withSearchIndex: vi.fn().mockReturnValue({
                    collect: searchCollectMock
                })
            })
        },
        filterMock,
        paginateMock,
        indexCollectMock,
        searchCollectMock
    }
}

const emptyPaginationResult = {
    page: [],
    continueCursor: "",
    isDone: true
}

describe("paginateGeneratedImages", () => {
    beforeEach(() => {
        getUserIdentityMock.mockReset().mockResolvedValue({ id: "user-1" })
    })

    it("uses incremental pagination for the default newest library path", async () => {
        const ctx = createCtx({
            indexPaginateResults: [
                {
                    page: [
                        { _id: "active-1", createdAt: 30 },
                        { _id: "active-2", createdAt: 10 }
                    ],
                    continueCursor: "cursor-1",
                    isDone: false
                }
            ]
        })

        const result = await paginateGeneratedImagesHandler.handler(ctx, {
            paginationOpts: { numItems: 2, cursor: null },
            query: "",
            sortBy: "newest",
            filters: undefined,
            view: "active"
        })

        expect(ctx.paginateMock).toHaveBeenCalledTimes(1)
        expect(ctx.filterMock).toHaveBeenCalledTimes(1)
        expect(ctx.paginateMock).toHaveBeenCalledWith({
            numItems: 2,
            cursor: null
        })
        expect(ctx.indexCollectMock).not.toHaveBeenCalled()
        expect(result).toEqual({
            page: [
                { _id: "active-1", createdAt: 30 },
                { _id: "active-2", createdAt: 10 }
            ],
            isDone: false,
            continueCursor: "2"
        })
    })

    it("requests enough rows to reach later default pages", async () => {
        const ctx = createCtx({
            indexPaginateResults: [
                {
                    page: [
                        { _id: "image-1", createdAt: 50 },
                        { _id: "image-2", createdAt: 40 },
                        { _id: "image-3", createdAt: 30 },
                        { _id: "image-4", createdAt: 20 }
                    ],
                    continueCursor: "",
                    isDone: true
                }
            ]
        })

        const result = await paginateGeneratedImagesHandler.handler(ctx, {
            paginationOpts: { numItems: 2, cursor: "2" },
            query: "",
            sortBy: "newest",
            filters: undefined,
            view: "active"
        })

        expect(ctx.paginateMock).toHaveBeenCalledWith({
            numItems: 4,
            cursor: null
        })
        expect(result).toEqual({
            page: [
                { _id: "image-3", createdAt: 30 },
                { _id: "image-4", createdAt: 20 }
            ],
            isDone: true,
            continueCursor: ""
        })
    })

    it("keeps the full-collection path for non-default sorts", async () => {
        const ctx = createCtx({
            indexCollectResult: [
                { _id: "newest", createdAt: 30 },
                { _id: "oldest", createdAt: 10 },
                { _id: "middle", createdAt: 20 }
            ]
        })

        const result = await paginateGeneratedImagesHandler.handler(ctx, {
            paginationOpts: { numItems: 2, cursor: null },
            query: "",
            sortBy: "oldest",
            filters: undefined,
            view: "active"
        })

        expect(ctx.indexCollectMock).toHaveBeenCalledTimes(1)
        expect(ctx.paginateMock).not.toHaveBeenCalled()
        expect(result).toEqual({
            page: [
                { _id: "oldest", createdAt: 10 },
                { _id: "middle", createdAt: 20 }
            ],
            isDone: false,
            continueCursor: "2"
        })
    })
})
