import type { ModelMessage } from "ai"
import { describe, expect, it, vi } from "vitest"
import {
    buildSkillIndexContext,
    getLoadSkillTool,
    getPublicSkillLoadResult
} from "../../convex/chat_http/skills"
import {
    type CustomSkill,
    buildCustomSkillLoadOutput,
    getPreviouslyLoadedCustomSkillSlugs,
    restoreCustomSkillResults
} from "../../convex/chat_http/skills/custom"
import { MAX_SKILL_FILE_READ_TOKENS, MAX_SKILL_LOAD_TOKENS } from "../../convex/lib/skill_bundle"

const pdf: CustomSkill = {
    slug: "pdf",
    description: "Fill in and merge PDF files.",
    instructions: "# PDF\n\nFor forms, read references/forms.md first.",
    files: [
        { path: "SKILL.md", sizeBytes: 60, text: true },
        { path: "references/forms.md", sizeBytes: 20, text: true },
        { path: "references/huge.md", sizeBytes: 900_000, text: true },
        { path: "assets/font.ttf", sizeBytes: 4_000, text: false },
        { path: "scripts/fill.py", sizeBytes: 30, text: true }
    ],
    runsCode: true
}
const notes: CustomSkill = {
    slug: "meeting-notes",
    description: "Turn a transcript into decisions.",
    instructions: "# Notes\n\nList decisions, owners, dates.",
    files: [{ path: "SKILL.md", sizeBytes: 40, text: true }],
    runsCode: false
}

const contents: Record<string, string> = {
    "references/forms.md": "# Forms\n\nUse the field names.",
    "references/huge.md": "word ".repeat(MAX_SKILL_FILE_READ_TOKENS * 2),
    "scripts/fill.py": "print('fill')"
}
const readFile = vi.fn(async (_skill: CustomSkill, path: string) => contents[path])

const skillContext = { mathKitEnabled: false, availableImageSelectionSummary: "- None" }

const loadCall = (toolCallId: string, input: unknown): ModelMessage => ({
    role: "assistant",
    content: [{ type: "tool-call", toolCallId, toolName: "load_skill", input }]
})
const storedResult = (toolCallId: string, value: unknown): ModelMessage => ({
    role: "tool",
    content: [
        {
            type: "tool-result",
            toolCallId,
            toolName: "load_skill",
            output: { type: "json", value: value as never }
        }
    ]
})

describe("loading an installed skill", () => {
    it("returns the instructions with the skill's readable files listed", async () => {
        const output = await buildCustomSkillLoadOutput({
            skill: pdf,
            files: [],
            includeInstructions: true,
            readFile
        })
        expect(output.success).toBe(true)
        expect(output.instructions).toContain("For forms, read references/forms.md first.")
        expect(output.instructions).toContain("- references/forms.md")
        expect(output.instructions).toContain("- scripts/fill.py")
        // SKILL.md is what was just returned, and binaries can't be read.
        expect(output.instructions).not.toContain("- SKILL.md")
        expect(output.instructions).toContain("can't be read here: assets/font.ttf")
        expect(output.files).toBeUndefined()
    })

    it("returns only the requested files once the skill is loaded", async () => {
        const output = await buildCustomSkillLoadOutput({
            skill: pdf,
            files: ["references/forms.md"],
            includeInstructions: false,
            readFile
        })
        expect(output).toEqual({
            success: true,
            skill: "pdf",
            label: "pdf",
            message: "Read references/forms.md from the pdf skill.",
            files: [{ path: "references/forms.md", content: contents["references/forms.md"] }]
        })
    })

    it("explains each file it can't return and lists what the skill does hold", async () => {
        const output = await buildCustomSkillLoadOutput({
            skill: pdf,
            files: ["references/missing.md", "assets/font.ttf", "references/huge.md", "../x"],
            includeInstructions: false,
            readFile
        })
        expect(output.success).toBe(false)
        expect(output.files).toBeUndefined()
        expect(output.problems).toEqual([
            'There is no "references/missing.md" in this skill.',
            '"assets/font.ttf" is not a text file and can\'t be read here.',
            '"references/huge.md" is too large to read here.',
            'There is no "../x" in this skill.',
            "Files in this skill: references/forms.md, references/huge.md, scripts/fill.py."
        ])
    })

    it("stops adding files once a read is long enough and says which to read next", async () => {
        const big = "word ".repeat(MAX_SKILL_LOAD_TOKENS / 3)
        const guide: CustomSkill = {
            ...notes,
            files: ["a.md", "b.md", "c.md", "d.md"].map((path) => ({
                path,
                sizeBytes: big.length,
                text: true
            }))
        }
        const output = await buildCustomSkillLoadOutput({
            skill: guide,
            files: ["a.md", "b.md", "c.md", "d.md"],
            includeInstructions: false,
            readFile: async () => big
        })
        const loaded = (output.files ?? []).map((file) => file.path)
        expect(loaded.length).toBeGreaterThan(0)
        expect(loaded.length).toBeLessThan(4)
        expect(loaded).toEqual(["a.md", "b.md", "c.md", "d.md"].slice(0, loaded.length))
        expect(output.problems).toContain(
            `"${["a.md", "b.md", "c.md", "d.md"][loaded.length]}" was left out to keep this read short. Read it next.`
        )
    })

    it("returns the files it could read when another one fails", async () => {
        const output = await buildCustomSkillLoadOutput({
            skill: pdf,
            files: ["scripts/fill.py", "references/forms.md"],
            includeInstructions: false,
            readFile: async (_skill, path) => {
                if (path === "scripts/fill.py") throw new Error("storage is down")
                return contents[path]
            }
        })
        expect(output.success).toBe(true)
        expect(output.files).toEqual([
            { path: "references/forms.md", content: contents["references/forms.md"] }
        ])
        expect(output.problems).toEqual(['"scripts/fill.py" could not be read. Try again.'])
    })

    it("exposes installed skills through load_skill and tracks what was loaded", async () => {
        const loadedSlugs = new Set<string>()
        const { load_skill } = getLoadSkillTool({
            availableSkillIds: ["diagrams"],
            context: skillContext,
            onLoad: vi.fn(),
            custom: { skills: [pdf, notes], loadedSlugs, readFile }
        })
        const run = (input: { skill: string; files?: string[] }) =>
            load_skill.execute?.(input as never, {} as never) as Promise<Record<string, unknown>>

        // Asking for a file first still brings the instructions along.
        const first = await run({ skill: "pdf", files: ["references/forms.md"] })
        expect(first.instructions).toContain("# PDF")
        expect(first.files).toHaveLength(1)
        expect(loadedSlugs).toEqual(new Set(["pdf"]))

        const second = await run({ skill: "pdf", files: ["scripts/fill.py"] })
        expect(second.instructions).toBeUndefined()

        const builtIn = await run({ skill: "diagrams" })
        expect(builtIn.label).toBe("Diagrams")
    })

    it("stores which files were read without their contents", async () => {
        const output = await buildCustomSkillLoadOutput({
            skill: pdf,
            files: ["references/forms.md"],
            includeInstructions: true,
            readFile
        })
        expect(getPublicSkillLoadResult(output)).toEqual({
            success: true,
            skill: "pdf",
            label: "pdf",
            message: "Read references/forms.md from the pdf skill.",
            files: ["references/forms.md"]
        })
    })
})

describe("installed skills across turns", () => {
    const history: ModelMessage[] = [
        { role: "user", content: "Fill in this form" },
        loadCall("call-1", { skill: "pdf" }),
        storedResult("call-1", { success: true, skill: "pdf", label: "pdf", message: "Loaded." }),
        loadCall("call-2", { skill: "pdf", files: ["references/forms.md"] }),
        storedResult("call-2", {
            success: true,
            skill: "pdf",
            label: "pdf",
            message: "Read.",
            files: ["references/forms.md"]
        }),
        loadCall("call-3", { skill: "diagrams" }),
        storedResult("call-3", { success: true, skill: "diagrams", label: "Diagrams" }),
        loadCall("call-4", { skill: "pdf", files: ["references/missing.md"] }),
        storedResult("call-4", { success: false, skill: "pdf", label: "pdf", message: "No." })
    ]
    const resultValue = (messages: ModelMessage[], index: number) => {
        const message = messages[index]
        if (message.role !== "tool") throw new Error("Expected a tool message")
        const part = message.content[0]
        if (part.type !== "tool-result" || part.output.type !== "json") {
            throw new Error("Expected a JSON tool result")
        }
        return part.output.value as Record<string, unknown>
    }

    it("recognizes which installed skills the conversation has loaded", () => {
        expect(getPreviouslyLoadedCustomSkillSlugs(history, [pdf, notes])).toEqual(new Set(["pdf"]))
    })

    it("puts back what each past load returned, and nothing else", async () => {
        const restored = await restoreCustomSkillResults(history, [pdf, notes], readFile)

        expect(resultValue(restored, 2).instructions).toContain("# PDF")
        // The second load only read a file: the instructions were already in the conversation.
        expect(resultValue(restored, 4)).toEqual({
            success: true,
            skill: "pdf",
            label: "pdf",
            message: "Read references/forms.md from the pdf skill.",
            files: [{ path: "references/forms.md", content: contents["references/forms.md"] }]
        })
        // Built-in skills and failed loads are left exactly as stored.
        expect(restored[6]).toBe(history[6])
        expect(restored[8]).toBe(history[8])
        expect(restored[0]).toBe(history[0])
    })

    it("treats a load that was stopped or failed as never having happened", async () => {
        const interrupted: ModelMessage[] = [
            { role: "user", content: "Tidy these notes" },
            // Stopped mid-stream: the call was stored, a result never was.
            loadCall("stopped", { skill: "meeting-notes" }),
            storedResult("stopped", undefined),
            loadCall("failed", { skill: "pdf", files: ["references/missing.md"] }),
            storedResult("failed", { success: false, skill: "pdf", label: "pdf", message: "No." }),
            { role: "user", content: "Try again" },
            loadCall("worked", { skill: "pdf", files: ["references/forms.md"] }),
            storedResult("worked", { success: true, skill: "pdf", label: "pdf", message: "Read." })
        ]
        // The index must offer meeting-notes again, since its instructions are nowhere.
        expect(getPreviouslyLoadedCustomSkillSlugs(interrupted, [pdf, notes])).toEqual(
            new Set(["pdf"])
        )

        const restored = await restoreCustomSkillResults(interrupted, [pdf, notes], readFile)
        expect(restored[2]).toBe(interrupted[2])
        expect(restored[4]).toBe(interrupted[4])
        // The first load that did work is the one that carries the instructions.
        expect(resultValue(restored, 7).instructions).toContain("# PDF")
        expect(resultValue(restored, 7).files).toHaveLength(1)
    })

    it("restores the same text every turn, so the cached prompt still matches", async () => {
        const first = await restoreCustomSkillResults(history, [pdf, notes], readFile)
        const second = await restoreCustomSkillResults(history, [pdf, notes], readFile)
        expect(second).toEqual(first)
    })

    it("leaves a skill that was removed since as the stored label", async () => {
        const restored = await restoreCustomSkillResults(history, [notes], readFile)
        expect(restored[2]).toBe(history[2])
    })

    it("indexes unloaded skills by description and names the loaded ones once", () => {
        const index = buildSkillIndexContext(["diagrams"], new Set(), skillContext, {
            skills: [pdf, notes],
            loadedSlugs: new Set(["pdf"])
        })
        expect(index).toContain("`meeting-notes` — Turn a transcript into decisions.")
        expect(index).not.toContain("`pdf` — ")
        expect(index).toContain("loaded earlier in this conversation")
        expect(index).toContain("`pdf`")
        expect(index).not.toContain("# PDF")
    })

    it("builds the same index as before for a chat with no installed skills", () => {
        expect(
            buildSkillIndexContext(["diagrams"], new Set(), skillContext, {
                skills: [],
                loadedSlugs: new Set()
            })
        ).toBe(buildSkillIndexContext(["diagrams"], new Set(), skillContext))
    })
})
