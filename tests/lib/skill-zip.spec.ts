import {
    type ZipUploadItem,
    importSkillZipBatch,
    selectSkillZipFiles,
    summarizeSkillZipBatch
} from "@/lib/skill-zip"
import { describe, expect, it } from "vitest"

const makeFile = (name: string, type = "") => new File(["zip"], name, { type })

describe("skill zip batch helpers", () => {
    it("filters dropped files to .zip archives while preserving order", () => {
        const files = [
            makeFile("README.md", "text/markdown"),
            makeFile("astronomy.zip", "application/zip"),
            makeFile("pharmacology.ZIP"),
            makeFile("archive-without-ext", "application/x-zip-compressed"),
            makeFile("notes.txt", "text/plain")
        ]

        expect(selectSkillZipFiles(files).map((file) => file.name)).toEqual([
            "astronomy.zip",
            "pharmacology.ZIP",
            "archive-without-ext"
        ])
    })

    it("imports every zip sequentially and isolates per-file errors", async () => {
        const files = [
            makeFile("astronomy.zip"),
            makeFile("broken.zip"),
            makeFile("pharmacology.zip")
        ]
        const snapshots: ZipUploadItem[][] = []

        const finalItems = await importSkillZipBatch(
            files,
            async (file) => {
                if (file.name === "broken.zip") {
                    throw { data: "That .zip has no SKILL.md in it." }
                }
                if (file.name === "astronomy.zip") {
                    return { slug: "astronomy", status: "added" }
                }
                return { slug: "pharmacology", status: "unchanged" }
            },
            (error) =>
                typeof (error as { data?: unknown })?.data === "string"
                    ? (error as { data: string }).data
                    : "Failed",
            (items) => snapshots.push(items)
        )

        expect(snapshots[0]?.map((item) => item.status)).toEqual(["queued", "queued", "queued"])
        expect(snapshots[1]?.map((item) => item.status)).toEqual(["uploading", "queued", "queued"])
        expect(finalItems).toEqual([
            {
                id: "0:astronomy.zip",
                fileName: "astronomy.zip",
                status: "added",
                slug: "astronomy"
            },
            {
                id: "1:broken.zip",
                fileName: "broken.zip",
                status: "failed",
                error: "That .zip has no SKILL.md in it."
            },
            {
                id: "2:pharmacology.zip",
                fileName: "pharmacology.zip",
                status: "unchanged",
                slug: "pharmacology"
            }
        ])
    })

    it("summarizes in-flight, uniform, and mixed batch outcomes", () => {
        expect(
            summarizeSkillZipBatch([
                { id: "0", fileName: "a.zip", status: "added", slug: "a" },
                { id: "1", fileName: "b.zip", status: "uploading" },
                { id: "2", fileName: "c.zip", status: "queued" }
            ])
        ).toMatchObject({ inFlight: true, label: "Adding 2 of 3 skills..." })

        expect(
            summarizeSkillZipBatch([
                { id: "0", fileName: "a.zip", status: "added", slug: "a" },
                { id: "1", fileName: "b.zip", status: "added", slug: "b" }
            ]).label
        ).toBe("2 skills added")

        expect(
            summarizeSkillZipBatch([
                { id: "0", fileName: "a.zip", status: "added", slug: "a" },
                { id: "1", fileName: "b.zip", status: "updated", slug: "b" },
                { id: "2", fileName: "c.zip", status: "unchanged", slug: "c" },
                { id: "3", fileName: "d.zip", status: "failed", error: "Bad zip" }
            ]).label
        ).toBe("1 added, 1 updated, 1 up to date, 1 failed")

        expect(
            summarizeSkillZipBatch([
                { id: "0", fileName: "a.zip", status: "failed", error: "Bad zip" },
                { id: "1", fileName: "b.zip", status: "failed", error: "Bad zip" }
            ]).label
        ).toBe("2 skills couldn't be added")
    })
})
