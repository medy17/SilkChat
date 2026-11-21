import { SkillInstructions } from "@/components/skills/skill-facts"
import type {
    LibrarySkill,
    SkillAudit,
    StoreSkill,
    StoreSkillDetail
} from "@/components/skills/skill-types"
import { MIN_SKILL_SEARCH_LENGTH } from "@/components/skills/skills-browse"
import { getSkillErrorMessage } from "@/components/skills/skills-manage"
import { SkillsSettings, type SkillsSettingsTab } from "@/components/skills/skills-settings"
import { api } from "@/convex/_generated/api"
import type { Id } from "@/convex/_generated/dataModel"
import { SKILL_CATALOG } from "@/lib/skill-catalog"
import { readSkillZip, summarizeSkillZipBatch } from "@/lib/skill-zip"
import { createFileRoute, useNavigate } from "@tanstack/react-router"
import { useAction, useMutation, useQuery } from "convex/react"
import { useEffect, useMemo, useRef, useState } from "react"
import { toast } from "sonner"

const SEARCH_DEBOUNCE_MS = 350

export const Route = createFileRoute("/settings/skills")({
    validateSearch: (search: Record<string, unknown>) => ({
        tab: (search.tab === "browse" ? "browse" : "manage") as SkillsSettingsTab
    }),
    component: SkillsSettingsRoute
})

// A search result that is one of ours shows as ours, description and all.
const CATALOG_BY_KEY = new Map(
    SKILL_CATALOG.flatMap((category) => category.skills).map((skill) => [
        `${skill.repo.toLowerCase()}/${skill.name}`,
        skill
    ])
)

const toReference = (skill: StoreSkill) => (skill.path ? `${skill.repo}/${skill.path}` : skill.repo)

function LibraryInstructions({ skillId }: { skillId: string }) {
    const text = useQuery(api.skills.getMySkillInstructions, { skillId: skillId as Id<"skills"> })
    return <SkillInstructions text={text} />
}

// Null when nobody has checked the skill, undefined when the store couldn't say.
const fetchAudits = async (skill: StoreSkill): Promise<SkillAudit[] | null | undefined> => {
    try {
        const params = new URLSearchParams({ repo: skill.repo, name: skill.name })
        const response = await fetch(`/api/skill-store?${params.toString()}`)
        if (!response.ok) return undefined
        return ((await response.json()) as { audits: SkillAudit[] | null }).audits
    } catch {
        return undefined
    }
}

function SkillsSettingsRoute() {
    const navigate = useNavigate({ from: "/settings/skills" })
    const { tab } = Route.useSearch()
    const library = useQuery(api.skills.listMySkills)
    const setEnabled = useMutation(api.skills.setMySkillEnabled)
    const remove = useMutation(api.skills.removeMySkill)
    const installFromGithub = useAction(api.skills_install.installFromGithub)
    const installFromUpload = useAction(api.skills_install.installFromUpload)
    const update = useAction(api.skills_install.updateMySkill)
    const preview = useAction(api.skills_install.previewFromGithub)

    const skills = useMemo<LibrarySkill[] | undefined>(
        () => library?.map(({ _id, ...skill }) => ({ id: _id, ...skill })),
        [library]
    )

    const [searchResults, setSearchResults] = useState<StoreSkill[] | null | undefined>(undefined)
    const searchTimer = useRef<number | undefined>(undefined)
    const searchRequest = useRef(0)
    useEffect(() => () => window.clearTimeout(searchTimer.current), [])
    const search = (query: string) => {
        window.clearTimeout(searchTimer.current)
        const request = ++searchRequest.current
        if (query.length < MIN_SKILL_SEARCH_LENGTH) return
        setSearchResults(undefined)
        searchTimer.current = window.setTimeout(async () => {
            let results: StoreSkill[] | null = null
            try {
                const response = await fetch(`/api/skill-store?q=${encodeURIComponent(query)}`)
                if (response.ok)
                    results = ((await response.json()) as { skills: StoreSkill[] }).skills
            } catch {
                // Reported as unavailable below.
            }
            // A slower, older search must not replace a newer one.
            if (request !== searchRequest.current) return
            setSearchResults(
                results?.map(
                    (skill) =>
                        CATALOG_BY_KEY.get(`${skill.repo.toLowerCase()}/${skill.name}`) ?? skill
                ) ?? null
            )
        }, SEARCH_DEBOUNCE_MS)
    }

    const reportAdded = (result: { slug: string; status: string }) => {
        if (result.status === "unchanged") toast(`You already have ${result.slug}`)
        else toast.success(`${result.slug} ${result.status === "updated" ? "updated" : "added"}`)
    }

    return (
        <SkillsSettings
            tab={tab}
            onTabChange={(nextTab) =>
                void navigate({ search: (prev) => ({ ...prev, tab: nextTab }), replace: true })
            }
            manage={{
                skills,
                Instructions: LibraryInstructions,
                onToggle: (skill, enabled) =>
                    void setEnabled({ skillId: skill.id as Id<"skills">, enabled }).catch(() =>
                        toast.error("Couldn't update that skill")
                    ),
                onUpdate: async (skill) => {
                    try {
                        const result = await update({ skillId: skill.id as Id<"skills"> })
                        if (result.status === "unchanged") toast(`${result.slug} is up to date`)
                        else toast.success(`${result.slug} updated`)
                    } catch (error) {
                        toast.error(getSkillErrorMessage(error, "Couldn't check for updates"))
                    }
                },
                onRemove: async (skill) => {
                    try {
                        await remove({ skillId: skill.id as Id<"skills"> })
                        toast.success(`${skill.slug} removed`)
                    } catch (error) {
                        toast.error(getSkillErrorMessage(error, "Couldn't remove that skill"))
                    }
                },
                // The form shows these failures itself, next to the field.
                onImportRepository: async (reference, exactPath) => {
                    const result = await installFromGithub({ reference, exactPath })
                    // A repository with several skills: the form asks which ones.
                    if (result.status === "choose") {
                        return {
                            repo: result.repo,
                            reference: result.reference,
                            skills: result.skills
                        }
                    }
                    reportAdded(result)
                    return null
                },
                onImportZip: async (file) =>
                    await installFromUpload({
                        files: await readSkillZip(file),
                        fileName: file.name
                    }),
                // Failures are toasted per file as they happen; this reports what landed.
                onImportZipsDone: (items) => {
                    const summary = summarizeSkillZipBatch(items)
                    if (summary.failed === summary.total) return
                    // Only a landed .zip has a slug.
                    const [item] = items
                    if (items.length === 1 && item.slug) {
                        reportAdded({ slug: item.slug, status: item.status })
                    } else if (summary.unchanged === summary.total || summary.failed > 0) {
                        toast(summary.label)
                    } else {
                        toast.success(summary.label)
                    }
                }
            }}
            browse={{
                categories: SKILL_CATALOG,
                isAdded: (skill) =>
                    (skills ?? []).some(
                        (owned) =>
                            owned.source.kind === "github" &&
                            owned.source.repo.toLowerCase() === skill.repo.toLowerCase() &&
                            (skill.path !== undefined
                                ? owned.source.path === skill.path
                                : owned.slug === skill.name)
                    ),
                onAdd: async (skill) => {
                    try {
                        const result = await installFromGithub({
                            reference: toReference(skill),
                            name: skill.name,
                            fromStore: true
                        })
                        if (result.status === "choose") {
                            throw new Error("Several skills matched")
                        }
                        reportAdded(result)
                    } catch (error) {
                        toast.error(getSkillErrorMessage(error, "That skill couldn't be added"))
                        throw error
                    }
                },
                onSearch: search,
                searchResults,
                loadDetail: async (skill): Promise<StoreSkillDetail> => {
                    const [detail, audits] = await Promise.all([
                        preview({ reference: toReference(skill), name: skill.name }),
                        fetchAudits(skill)
                    ])
                    return {
                        description: detail.description,
                        instructions: detail.instructions,
                        files: detail.files,
                        runsCode: detail.runsCode,
                        audits
                    }
                }
            }}
        />
    )
}
