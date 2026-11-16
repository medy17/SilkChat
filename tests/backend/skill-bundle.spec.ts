import { describe, expect, it } from "vitest"
import {
    MAX_SKILL_FILE_BYTES,
    SkillBundleError,
    findSkillRoots,
    getSkillFileKey,
    normalizeSkillPath,
    parseGithubSkillReference,
    parseSkillBundle,
    parseSkillFrontmatter
} from "../../convex/lib/skill_bundle"

const text = (value: string) => new TextEncoder().encode(value)

const skillMd = (frontmatter: string, body = "# Steps\n\nDo the thing.") =>
    `---\n${frontmatter}\n---\n\n${body}\n`

describe("skill frontmatter", () => {
    it("reads plain, quoted, and block descriptions the way YAML would", () => {
        expect(
            parseSkillFrontmatter(skillMd("name: pdf\ndescription: Fill in PDF forms.")).fields
        ).toEqual({ name: "pdf", description: "Fill in PDF forms." })

        expect(
            parseSkillFrontmatter(
                skillMd(`name: "docx"\ndescription: "Use for \\"Word\\" files: reports, memos."`)
            ).fields.description
        ).toBe('Use for "Word" files: reports, memos.')

        expect(
            parseSkillFrontmatter(skillMd("name: 'it''s'\ndescription: 'Single quoted.'")).fields
                .name
        ).toBe("it's")

        expect(
            parseSkillFrontmatter(
                skillMd(
                    "name: xlsx\ndescription: >-\n  Build spreadsheets\n  with working formulas.\n\n  Second paragraph."
                )
            ).fields.description
        ).toBe("Build spreadsheets with working formulas.\nSecond paragraph.")

        expect(
            parseSkillFrontmatter(skillMd("description: |\n  Line one\n  Line two\nname: notes"))
                .fields
        ).toEqual({ description: "Line one\nLine two", name: "notes" })
    })

    it("continues a plain value across indented lines and skips nested keys", () => {
        const { fields, body } = parseSkillFrontmatter(
            skillMd(
                "name: research\ndescription: Survey published work\n  and summarize it.\nmetadata:\n  version: 1.2.0\n  name: not-this\nlicense: MIT"
            )
        )
        expect(fields.name).toBe("research")
        expect(fields.description).toBe("Survey published work and summarize it.")
        expect(fields.license).toBe("MIT")
        expect(body.trim()).toBe("# Steps\n\nDo the thing.")
    })

    it("treats a file without frontmatter as all body", () => {
        const { fields, body } = parseSkillFrontmatter("# Just instructions\n")
        expect(fields).toEqual({})
        expect(body).toBe("# Just instructions\n")
    })
})

describe("skill paths", () => {
    it("rejects paths that could leave the skill's folder", () => {
        expect(normalizeSkillPath("../secrets.md")).toBeNull()
        expect(normalizeSkillPath("references/../../x.md")).toBeNull()
        expect(normalizeSkillPath("/etc/passwd")).toBeNull()
        expect(normalizeSkillPath("C:\\Users\\x.md")).toBeNull()
        expect(normalizeSkillPath("a//b.md")).toBeNull()
    })

    it("normalizes separators and drops clutter", () => {
        expect(normalizeSkillPath(".\\references\\forms.md")).toBe("references/forms.md")
        expect(normalizeSkillPath("./SKILL.md")).toBe("SKILL.md")
        expect(normalizeSkillPath("__MACOSX/._SKILL.md")).toBeNull()
        expect(normalizeSkillPath(".git/config")).toBeNull()
        expect(normalizeSkillPath("assets/.DS_Store")).toBeNull()
    })

    it("finds the folders that hold a skill, shallowest first", () => {
        expect(
            findSkillRoots([
                "README.md",
                "skills/pdf/SKILL.md",
                "skills/pdf/scripts/fill.py",
                "skills/docx/SKILL.md",
                "SKILL.md"
            ])
        ).toEqual(["", "skills/docx", "skills/pdf"])
    })

    it("keeps each version of a skill under its own prefix", () => {
        const key = getSkillFileKey("user_1", "pdf", "a".repeat(64), "references/forms.md")
        expect(key).toBe(`skills/user_1/pdf/${"a".repeat(16)}/references/forms.md`)
    })
})

describe("skill bundles", () => {
    const bundle = [
        {
            path: "SKILL.md",
            bytes: text(skillMd("name: PDF Forms\ndescription:   Fill in\n  PDF forms."))
        },
        { path: "references/forms.md", bytes: text("# Forms") },
        { path: "scripts/fill.py", bytes: text("print('fill')") },
        { path: "assets/font.ttf", bytes: new Uint8Array([0, 1, 2, 0, 255]) },
        { path: "../outside.md", bytes: text("nope") }
    ]

    it("describes a skill folder and leaves out what doesn't belong", async () => {
        const parsed = await parseSkillBundle(bundle)
        expect(parsed.slug).toBe("pdf-forms")
        expect(parsed.description).toBe("Fill in PDF forms.")
        expect(parsed.instructions).toBe("# Steps\n\nDo the thing.")
        expect(parsed.runsCode).toBe(true)
        expect(parsed.files).toEqual([
            { path: "assets/font.ttf", sizeBytes: 5, text: false },
            { path: "references/forms.md", sizeBytes: 7, text: true },
            { path: "scripts/fill.py", sizeBytes: 13, text: true },
            { path: "SKILL.md", sizeBytes: bundle[0].bytes.byteLength, text: true }
        ])
    })

    it("gives the same hash for the same files in any order, and a new one for any change", async () => {
        const first = await parseSkillBundle(bundle)
        const reordered = await parseSkillBundle([...bundle].reverse())
        const edited = await parseSkillBundle([
            ...bundle.slice(0, 1),
            { path: "references/forms.md", bytes: text("# Forms!") },
            ...bundle.slice(2)
        ])
        expect(reordered.hash).toBe(first.hash)
        expect(edited.hash).not.toBe(first.hash)
    })

    it("names a skill after its folder when the frontmatter doesn't", async () => {
        const parsed = await parseSkillBundle(
            [{ path: "SKILL.md", bytes: text(skillMd("description: Does a thing.")) }],
            { fallbackName: "My_Skill" }
        )
        expect(parsed.slug).toBe("my-skill")
    })

    it.each([
        ["no SKILL.md", [{ path: "README.md", bytes: text("hi") }], "no SKILL.md"],
        [
            "no description",
            [{ path: "SKILL.md", bytes: text(skillMd("name: empty")) }],
            "doesn't describe"
        ],
        [
            "a built-in name",
            [{ path: "SKILL.md", bytes: text(skillMd("name: memory\ndescription: Mine.")) }],
            "built-in skill"
        ],
        [
            "an oversized file",
            [
                { path: "SKILL.md", bytes: text(skillMd("name: big\ndescription: Big.")) },
                { path: "assets/big.bin", bytes: new Uint8Array(MAX_SKILL_FILE_BYTES + 1) }
            ],
            "too large"
        ]
    ])("refuses a folder with %s", async (_label, files, message) => {
        await expect(parseSkillBundle(files)).rejects.toThrow(SkillBundleError)
        await expect(parseSkillBundle(files)).rejects.toThrow(message)
    })
})

describe("GitHub skill links", () => {
    it("reads shorthand, repository links, and links to a folder or its SKILL.md", () => {
        expect(parseGithubSkillReference("anthropics/skills")).toEqual({
            repo: "anthropics/skills",
            ref: undefined,
            path: ""
        })
        expect(parseGithubSkillReference("anthropics/skills/skills/pdf")).toEqual({
            repo: "anthropics/skills",
            ref: undefined,
            path: "skills/pdf"
        })
        expect(
            parseGithubSkillReference("https://github.com/anthropics/skills/tree/main/skills/pdf/")
        ).toEqual({ repo: "anthropics/skills", ref: "main", path: "skills/pdf" })
        expect(
            parseGithubSkillReference(
                "https://github.com/obra/superpowers/blob/main/skills/brainstorming/SKILL.md"
            )
        ).toEqual({ repo: "obra/superpowers", ref: "main", path: "skills/brainstorming" })
        expect(parseGithubSkillReference("https://github.com/owner/repo.git")).toEqual({
            repo: "owner/repo",
            ref: undefined,
            path: ""
        })
    })

    it("reads the store's install command, where --skill picks one skill of several", () => {
        expect(
            parseGithubSkillReference(
                "npx skills add https://github.com/evan715823/cheatsheet-generator-skill --skill cheatsheet-generator"
            )
        ).toEqual({
            repo: "evan715823/cheatsheet-generator-skill",
            ref: undefined,
            path: "",
            name: "cheatsheet-generator"
        })
        expect(
            parseGithubSkillReference("bunx skills add -g -y szeyu/vibe-study-skills -s exam-prep")
        ).toEqual({ repo: "szeyu/vibe-study-skills", ref: undefined, path: "", name: "exam-prep" })
        expect(parseGithubSkillReference("skills add --skill=pdf anthropics/skills")?.name).toBe(
            "pdf"
        )
        expect(parseGithubSkillReference("anthropics/skills@docx")).toEqual({
            repo: "anthropics/skills",
            ref: undefined,
            path: "",
            name: "docx"
        })
        expect(parseGithubSkillReference("npx skills add --skill pdf")).toBeNull()
    })

    it("refuses anything that isn't a repository", () => {
        expect(parseGithubSkillReference("just-a-word")).toBeNull()
        expect(parseGithubSkillReference("owner/repo/../../etc")).toBeNull()
        expect(parseGithubSkillReference("")).toBeNull()
    })
})
