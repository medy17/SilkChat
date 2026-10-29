import { beforeEach, describe, expect, it, vi } from "vitest"

const { getUserIdentityMock, r2Mock } = vi.hoisted(() => ({
    getUserIdentityMock: vi.fn(),
    r2Mock: { deleteObject: vi.fn() }
}))

vi.mock("../../convex/_generated/server", () => ({
    mutation: (definition: { handler: unknown }) => definition.handler,
    internalMutation: (definition: { handler: unknown }) => definition.handler
}))
vi.mock("../../convex/attachments", () => ({ r2: r2Mock }))
vi.mock("../../convex/lib/identity", () => ({ getUserIdentity: getUserIdentityMock }))

import { markReferenceUploadsUsed } from "../../convex/lib/reference_uploads"
import {
    MAX_UNUSED_REFERENCE_UPLOADS,
    recordReferenceUpload,
    releaseReferenceUpload
} from "../../convex/reference_uploads"

type Row = { _id: string; userId: string; key: string; usedAt?: number }

// Rows come back in insertion order, matching index order for equal index fields.
const createCtx = (rows: Row[] = []) => {
    let nextId = rows.length
    const matching = (build: (q: unknown) => unknown) => {
        const filter: Record<string, unknown> = {}
        const q = {
            eq: (field: string, value: unknown) => {
                filter[field] = value
                return q
            }
        }
        build(q)
        return rows.filter((row) =>
            Object.entries(filter).every(
                ([field, value]) => (row as Record<string, unknown>)[field] === value
            )
        )
    }
    return {
        rows,
        auth: {},
        db: {
            query: () => ({
                withIndex: (_name: string, build: (q: unknown) => unknown) => ({
                    first: async () => matching(build)[0] ?? null,
                    collect: async () => matching(build)
                })
            }),
            insert: async (_table: string, value: Omit<Row, "_id">) => {
                rows.push({ _id: `row-${nextId++}`, ...value })
            },
            patch: async (id: string, value: Partial<Row>) => {
                Object.assign(rows.find((row) => row._id === id) ?? {}, value)
            },
            delete: async (id: string) => {
                rows.splice(
                    rows.findIndex((row) => row._id === id),
                    1
                )
            }
        }
    }
}

const record = recordReferenceUpload as unknown as (
    ctx: ReturnType<typeof createCtx>,
    args: { userId: string; key: string }
) => Promise<void>
const release = releaseReferenceUpload as unknown as (
    ctx: ReturnType<typeof createCtx>,
    args: { key: string }
) => Promise<void>
const markUsed = markReferenceUploadsUsed as unknown as (
    ctx: ReturnType<typeof createCtx>,
    userId: string,
    keys: string[]
) => Promise<void>

describe("reference uploads", () => {
    beforeEach(() => {
        r2Mock.deleteObject.mockReset()
        getUserIdentityMock.mockResolvedValue({ id: "user-1" })
    })

    it("evicts the oldest unused uploads past the cap but never used ones", async () => {
        const ctx = createCtx([
            { _id: "used", userId: "user-1", key: "references/user-1/used", usedAt: 1 }
        ])
        for (let index = 0; index <= MAX_UNUSED_REFERENCE_UPLOADS; index++) {
            await record(ctx, { userId: "user-1", key: `references/user-1/${index}` })
        }
        // Retried completions are idempotent.
        await record(ctx, {
            userId: "user-1",
            key: `references/user-1/${MAX_UNUSED_REFERENCE_UPLOADS}`
        })

        expect(r2Mock.deleteObject).toHaveBeenCalledTimes(1)
        expect(r2Mock.deleteObject).toHaveBeenCalledWith(ctx, "references/user-1/0")
        expect(ctx.rows.map((row) => row.key)).toContain("references/user-1/used")
        expect(ctx.rows.filter((row) => row.usedAt === undefined)).toHaveLength(
            MAX_UNUSED_REFERENCE_UPLOADS
        )
    })

    it("releases only the caller's unused uploads", async () => {
        const ctx = createCtx([
            { _id: "a", userId: "user-1", key: "references/user-1/a" },
            { _id: "b", userId: "user-2", key: "references/user-2/b" },
            { _id: "c", userId: "user-1", key: "references/user-1/c" }
        ])
        await markUsed(ctx, "user-1", ["references/user-1/c", "references/user-2/b"])

        for (const key of ["references/user-1/a", "references/user-2/b", "references/user-1/c"]) {
            await release(ctx, { key })
        }

        expect(r2Mock.deleteObject).toHaveBeenCalledTimes(1)
        expect(r2Mock.deleteObject).toHaveBeenCalledWith(ctx, "references/user-1/a")
        expect(ctx.rows.map((row) => row._id)).toEqual(["b", "c"])
    })
})
