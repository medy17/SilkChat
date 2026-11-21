// @vitest-environment jsdom

import type { LibrarySkill } from "@/components/skills/skill-types"
import { SkillsManage } from "@/components/skills/skills-manage"
import type { SkillUploadResult, ZipUploadItem } from "@/lib/skill-zip"
import { fireEvent, render, screen, waitFor } from "@testing-library/react"
import { createElement } from "react"
import { describe, expect, it, vi } from "vitest"

const zipFile = (name: string) => new File(["zip"], name, { type: "application/zip" })

const manage = ({
    skills = [],
    onImportZip,
    onImportZipsDone
}: {
    skills?: LibrarySkill[]
    onImportZip: (file: File) => Promise<SkillUploadResult>
    onImportZipsDone?: (items: ZipUploadItem[]) => void
}) =>
    createElement(SkillsManage, {
        skills,
        Instructions: () => null,
        onToggle: vi.fn(),
        onUpdate: vi.fn().mockResolvedValue(undefined),
        onRemove: vi.fn().mockResolvedValue(undefined),
        onImportRepository: vi.fn().mockResolvedValue(null),
        onImportZip,
        onImportZipsDone,
        onBrowse: vi.fn()
    })

const renderManage = (props: Parameters<typeof manage>[0]) => render(manage(props))

const librarySkill = (slug: string): LibrarySkill => ({
    id: `skill-${slug}`,
    slug,
    enabled: true,
    description: `What ${slug} does`,
    files: [],
    runsCode: false,
    source: { kind: "upload", fileName: `${slug}.zip` },
    createdAt: 0
})

describe("SkillsManage .zip uploads", () => {
    it("uploads several .zip files from the list, keeping a failed one until it is dismissed", async () => {
        const done = vi.fn()
        const onImportZip = vi.fn(async (file: File): Promise<SkillUploadResult> => {
            if (file.name === "bad.zip") throw { data: "That .zip has no SKILL.md in it." }
            return { slug: file.name.replace(/\.zip$/, ""), status: "added" }
        })

        const { container } = renderManage({ onImportZip, onImportZipsDone: done })
        const input = container.querySelector('input[type="file"]') as HTMLInputElement
        expect(input.multiple).toBe(true)

        fireEvent.change(input, {
            target: { files: [zipFile("astronomy.zip"), zipFile("bad.zip")] }
        })

        await waitFor(() => expect(done).toHaveBeenCalledTimes(1))
        expect(done.mock.calls[0]?.[0].map((item: ZipUploadItem) => item.status)).toEqual([
            "added",
            "failed"
        ])

        // The landed tile checks off and leaves; the failed one waits for the user.
        await waitFor(() => expect(screen.queryByText("astronomy")).toBeNull())
        expect(screen.getByText("bad.zip")).toBeTruthy()
        fireEvent.click(screen.getByRole("button", { name: "Dismiss bad.zip" }))
        expect(screen.queryByText("bad.zip")).toBeNull()
    })

    it("turns the upload's row into the new skill's row in place, never showing it twice", async () => {
        let finish: (result: SkillUploadResult) => void = () => {}
        const onImportZip = vi.fn(
            () =>
                new Promise<SkillUploadResult>((resolve) => {
                    finish = resolve
                })
        )

        const { container, rerender } = renderManage({ onImportZip })
        const input = container.querySelector('input[type="file"]') as HTMLInputElement
        fireEvent.change(input, { target: { files: [zipFile("astronomy.zip")] } })
        await waitFor(() => expect(onImportZip).toHaveBeenCalled())
        expect(screen.queryByText("No skills yet")).toBeNull()

        // The live library delivers the new skill before the upload call returns.
        rerender(manage({ skills: [librarySkill("astronomy")], onImportZip }))
        expect(screen.queryByText("astronomy")).toBeNull()
        expect(screen.getByText("astronomy.zip")).toBeTruthy()

        finish({ slug: "astronomy", status: "added" })
        await waitFor(() => expect(screen.getAllByText("astronomy")).toHaveLength(1))
        expect(screen.queryByText("astronomy.zip")).toBeNull()
    })

    it("shows a skill once after it is removed and uploaded again, and again", async () => {
        const onImportZip = vi.fn(
            async (): Promise<SkillUploadResult> => ({ slug: "astronomy", status: "added" })
        )
        const { container, rerender } = renderManage({ onImportZip })
        const input = container.querySelector('input[type="file"]') as HTMLInputElement

        for (const install of [1, 2, 3]) {
            fireEvent.change(input, { target: { files: [zipFile("astronomy.zip")] } })
            await waitFor(() => expect(onImportZip).toHaveBeenCalledTimes(install))
            // Each install is a new skill; between them it is removed.
            const skill = { ...librarySkill("astronomy"), id: `astronomy-${install}` }
            rerender(manage({ skills: [skill], onImportZip }))
            await waitFor(() => expect(screen.getAllByText("astronomy")).toHaveLength(1))
            rerender(manage({ skills: [], onImportZip }))
            await waitFor(() => expect(screen.queryByText("astronomy")).toBeNull())
        }
    })

    it("uploads from the opened Add a skill row, closing it so the upload is in view", async () => {
        const onImportZip = vi.fn(
            async (): Promise<SkillUploadResult> => ({ slug: "astronomy", status: "added" })
        )

        const { container } = renderManage({ onImportZip })
        const addRow = screen.getByRole("button", { name: /add a skill/i })
        fireEvent.click(addRow)
        expect(addRow.getAttribute("aria-expanded")).toBe("true")
        fireEvent.click(screen.getByRole("button", { name: "Upload a .zip" }))

        const input = container.querySelector('input[type="file"]') as HTMLInputElement
        fireEvent.change(input, { target: { files: [zipFile("astronomy.zip")] } })

        expect(addRow.getAttribute("aria-expanded")).toBe("false")
        await waitFor(() => expect(onImportZip).toHaveBeenCalledTimes(1))
    })

    it("uploads only the .zip files dropped anywhere on the page", async () => {
        const onImportZip = vi.fn(
            async (file: File): Promise<SkillUploadResult> => ({
                slug: file.name.replace(/\.zip$/i, ""),
                status: "added"
            })
        )

        renderManage({ onImportZip })
        fireEvent.drop(window, {
            dataTransfer: {
                types: ["Files"],
                files: [
                    new File(["notes"], "notes.txt", { type: "text/plain" }),
                    zipFile("astronomy.zip"),
                    zipFile("pharmacology.zip")
                ]
            }
        })

        await waitFor(() => expect(onImportZip).toHaveBeenCalledTimes(2))
        expect(onImportZip.mock.calls.map(([file]) => file.name)).toEqual([
            "astronomy.zip",
            "pharmacology.zip"
        ])
    })
})
