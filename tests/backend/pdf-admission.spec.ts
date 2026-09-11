import { convexTest } from "convex-test"
import { describe, expect, it, vi } from "vitest"
import schema from "../../convex/schema"
import { internal } from "../../convex/_generated/api"

const { metadata } = vi.hoisted(() => ({ metadata: new Map<string, Record<string, unknown>>() }))
vi.mock("../../convex/attachments", () => ({
    r2: { getMetadata: async (_ctx: unknown, key: string) => metadata.get(key) }
}))
const modules = import.meta.glob("../../convex/**/*.ts")

describe("batched PDF admission", () => {
    it("accepts version-matched counts, rejects cached failures, and reparses replacements", async () => {
        const t = convexTest(schema, modules)
        const files = ["ok", "too-long", "broken", "changed", "unknown"].map((name) => ({
            storageKey: `attachments/user/${name}.pdf`,
            fileName: `${name}.pdf`
        }))
        const object = { bucket: "bucket", lastModified: "one", size: 100, uploadStatus: "ready" }
        for (const file of files) metadata.set(file.storageKey, object)
        for (const [i, file] of files.slice(0, 4).entries()) {
            await t.mutation(internal.pdf_validations.save, {
                storageKey: file.storageKey,
                objectVersion: JSON.stringify(["bucket", i === 3 ? "old" : "one", 100, null]),
                ...(i === 2 ? { error: "Unreadable PDF" } : { pageCount: i === 1 ? 31 : 30 })
            })
        }
        const result = await t.query(internal.pdf_validations.checkMany, { files })
        expect(result[0]).toMatchObject({ pageCount: 30 })
        expect(result[1].error).toContain("has 31 pages")
        expect(result[2].error).toBe("Unreadable PDF")
        expect(result[3]).toEqual({ storageKey: files[3].storageKey })
        expect(result[4]).toEqual({ storageKey: files[4].storageKey })
    })

    it("refuses external and missing PDFs before they can become model input", async () => {
        const t = convexTest(schema, modules)
        const result = await t.query(internal.pdf_validations.checkMany, {
            files: [
                { storageKey: "https://foreign.test/file.pdf", fileName: "file.pdf" },
                { storageKey: "attachments/user/missing.pdf", fileName: "missing.pdf" }
            ]
        })
        expect(result[0].error).toContain("External PDFs")
        expect(result[1].error).toContain("PDF is unavailable")
    })
})
