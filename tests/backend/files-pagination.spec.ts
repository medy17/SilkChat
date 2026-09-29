import { convexTest } from "convex-test"
import { describe, expect, it, vi } from "vitest"
import { api, components } from "../../convex/_generated/api"
import schema from "../../convex/schema"
// The deployed component uses the patched dist schema, not its upstream src schema.
import r2Schema from "../../node_modules/@convex-dev/r2/dist/component/schema.js"

const modules = import.meta.glob("../../convex/**/*.ts")
const r2Modules = import.meta.glob("../../node_modules/@convex-dev/r2/dist/component/**/*.js")

const setup = () => {
    vi.stubEnv("R2_BUCKET", "files-test")
    vi.stubEnv("R2_FORCE_PATH_STYLE", "true")
    vi.stubEnv("R2_ENDPOINT", "https://files-test.invalid")
    vi.stubEnv("R2_ACCESS_KEY_ID", "test")
    vi.stubEnv("R2_SECRET_ACCESS_KEY", "test")
    const t = convexTest(schema, modules)
    t.registerComponent("r2", r2Schema, r2Modules)
    const user = t.withIdentity({ subject: "user-1" })
    const addFile = (
        key: string,
        date: number,
        overrides: {
            authorId?: string
            bucket?: string
            uploadStatus?: "pending" | "ready"
            contentType?: string
        } = {}
    ) =>
        t.mutation(components.r2.lib.upsertMetadata, {
            authorId: "user-1",
            bucket: "files-test",
            key,
            lastModified: new Date(date).toISOString(),
            link: "unused",
            contentType: "image/png",
            size: 100,
            ...overrides
        })
    const page = (cursor: string | null = null) =>
        user.query(api.attachments.listFiles, {
            paginationOpts: { numItems: 20, cursor }
        })
    return { t, user, addFile, page }
}

describe("All files cursor pagination", () => {
    it.each(["newest", "oldest"] as const)(
        "reads only a page from a thousand-file inventory in %s order, including on continuation",
        async (sort) => {
            const { user, addFile } = setup()
            for (let i = 0; i < 1000; i++) await addFile(`attachments/user-1/${i}.png`, i)
            const measure = (cursor: string | null) =>
                user.query(async (ctx) => {
                    const result = await ctx.runQuery(api.attachments.listFiles, {
                        sort,
                        paginationOpts: { numItems: 20, cursor }
                    })
                    const metrics = await ctx.meta.getTransactionMetrics()
                    return { result, reads: metrics.documentsRead.used }
                })
            const first = await measure(null)
            const second = await measure(first.result.continueCursor)
            expect(first.result.page).toHaveLength(20)
            expect(second.result.page).toHaveLength(20)
            expect([...first.result.page, ...second.result.page].map((file) => file.key)).toEqual(
                Array.from(
                    { length: 40 },
                    (_, i) => `attachments/user-1/${sort === "oldest" ? i : 999 - i}.png`
                )
            )
            expect(first.reads).toBeLessThanOrEqual(25)
            expect(second.reads).toBeLessThanOrEqual(25)
        }
    )

    it("paginates all visible categories by date and isolates users, buckets, and pending uploads", async () => {
        const { addFile, page } = setup()
        const roots = [
            "attachments",
            "generations",
            "references",
            "tts",
            "code-artifacts",
            "persona-avatars",
            "roleplay-portraits",
            "persona-docs"
        ]
        const keys = []
        // Insertion and key order differ from the desired lastModified order.
        for (let i = 44; i >= 0; i--) {
            const key = `${roots[i % roots.length]}/user-1/${i}.png`
            keys.push(key)
            await addFile(key, i)
        }
        await addFile("imports/user-1/hidden.png", 100)
        await addFile("attachments/user-10/wrong-prefix.png", 100)
        await addFile("attachments/user-1/pending.png", 100, { uploadStatus: "pending" })
        await addFile("attachments/user-1/wrong-owner.png", 100, { authorId: "user-2" })
        await addFile("attachments/user-1/wrong-bucket.png", 100, { bucket: "other" })

        const first = await page()
        const second = await page(first.continueCursor)
        const third = await page(second.continueCursor)
        expect([first.page.length, second.page.length, third.page.length]).toEqual([20, 20, 5])
        expect([...first.page, ...second.page, ...third.page].map((file) => file.key)).toEqual(keys)
        expect(first.isDone).toBe(false)
        expect(third.isDone).toBe(true)
        expect(Object.keys(first.page[0]).sort()).toEqual([
            "contentType",
            "key",
            "lastModified",
            "size"
        ])
    })

    it("resumes after the saved boundary when newer files are inserted or the boundary is deleted", async () => {
        const { t, addFile, page } = setup()
        for (let i = 0; i < 45; i++) await addFile(`attachments/user-1/${i}.png`, i)
        const first = await page()
        const boundary = first.page.at(-1)!.key
        await addFile("attachments/user-1/new.png", 100)
        await t.mutation(components.r2.lib.deleteMetadata, { bucket: "files-test", key: boundary })
        const next = await page(first.continueCursor)
        expect(next.page.map((file) => file.key)).toEqual(
            Array.from({ length: 20 }, (_, i) => `attachments/user-1/${24 - i}.png`)
        )
    })

    it("bounds scans through hidden files and preserves an empty page's continuation", async () => {
        const { addFile, page } = setup()
        for (let i = 1; i <= 520; i++) await addFile(`imports/user-1/${i}.png`, i)
        await addFile("attachments/user-1/visible.png", 0)
        const first = await page()
        expect(first.page).toEqual([])
        expect(first.isDone).toBe(false)
        expect(first.continueCursor).toBeTruthy()
        expect(first.pageStatus).toBe("SplitRequired")
        const next = await page(first.continueCursor)
        expect(next.page.map((file) => file.key)).toEqual(["attachments/user-1/visible.png"])
        expect(next.isDone).toBe(true)
    })

    it("requires authentication before listing metadata", async () => {
        const { t, addFile } = setup()
        await addFile("attachments/user-1/private.png", 1)
        expect(
            await t.query(api.attachments.listFiles, {
                paginationOpts: { numItems: 20, cursor: null }
            })
        ).toEqual({ page: [], isDone: true, continueCursor: "" })
    })

    it("keeps explicit type filtering on the offset path in both sort orders", async () => {
        const { user, addFile } = setup()
        await addFile("attachments/user-1/old.png", 1)
        await addFile("references/user-1/document.pdf", 2, { contentType: "application/pdf" })
        await addFile("generations/user-1/new.png", 3)
        const filtered = await user.query(api.attachments.listFiles, {
            type: "image",
            sort: "newest",
            paginationOpts: { numItems: 1, cursor: null }
        })
        expect(filtered.page.map((file) => file.key)).toEqual(["generations/user-1/new.png"])
        expect(filtered.continueCursor).toBe("1")
        const next = await user.query(api.attachments.listFiles, {
            type: "image",
            sort: "newest",
            paginationOpts: { numItems: 1, cursor: filtered.continueCursor }
        })
        expect(next.page.map((file) => file.key)).toEqual(["attachments/user-1/old.png"])
        expect(next.isDone).toBe(true)
        const oldest = await user.query(api.attachments.listFiles, {
            type: "image",
            sort: "oldest",
            paginationOpts: { numItems: 1, cursor: null }
        })
        expect(oldest.page.map((file) => file.key)).toEqual(["attachments/user-1/old.png"])
        expect(oldest.continueCursor).toBe("1")
    })
})
