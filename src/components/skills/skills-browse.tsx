import { ComputerDetailItem } from "@/components/computer-ui"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Skeleton } from "@/components/ui/skeleton"
import { cn } from "@/lib/utils"
import { ArrowLeft, Check, ChevronRight, Loader2, Plus, Search } from "lucide-react"
import { useEffect, useState } from "react"
import {
    SkillAuditItem,
    SkillFacts,
    SkillInstructions,
    SkillNotes,
    SkillRepositoryLink
} from "./skill-facts"
import {
    type SkillCategory,
    type StoreSkill,
    type StoreSkillDetail,
    getStoreSkillKey
} from "./skill-types"
import { getSkillErrorMessage } from "./skills-manage"

/** A shelf shows this many; the rest are behind See all. */
const SHELF_SIZE = 4
export const MIN_SKILL_SEARCH_LENGTH = 2

type BrowseView =
    | { kind: "home" }
    | { kind: "category"; categoryId: string }
    | { kind: "skill"; skill: StoreSkill; back: BrowseView }

function BackButton({ label, onClick }: { label: string; onClick: () => void }) {
    return (
        <Button
            type="button"
            variant="ghost"
            size="sm"
            className="gap-2 text-muted-foreground hover:text-foreground"
            onClick={onClick}
        >
            <ArrowLeft className="h-4 w-4" />
            {label}
        </Button>
    )
}

// One of ours is one press to add. Anything else opens first, so its instructions are read
// before it is on.
function AddControl({
    skill,
    added,
    adding,
    onAdd,
    onOpen
}: {
    skill: StoreSkill
    added: boolean
    adding: boolean
    onAdd: () => void
    onOpen: () => void
}) {
    if (added) {
        return (
            <span className="flex h-7 items-center gap-1 text-muted-foreground text-xs">
                <Check className="size-3.5" aria-hidden="true" />
                Added
            </span>
        )
    }
    return (
        <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={adding}
            aria-label={`${skill.curated ? "Add" : "Review"} ${skill.name}`}
            className="h-7 rounded-[var(--radius-md)] px-2.5 text-xs"
            onClick={skill.curated ? onAdd : onOpen}
        >
            {adding ? (
                <Loader2 className="size-3.5 animate-spin" aria-label="Adding" />
            ) : skill.curated ? (
                "Add"
            ) : (
                "Review"
            )}
        </Button>
    )
}

function StoreRow({
    skill,
    added,
    adding,
    detailed = false,
    onOpen,
    onAdd
}: {
    skill: StoreSkill
    added: boolean
    adding: boolean
    /** Full lists have room for where the skill comes from. */
    detailed?: boolean
    onOpen: () => void
    onAdd: () => void
}) {
    return (
        <li className="relative flex items-center gap-3 border-t px-4 py-3 transition-colors first:border-t-0 hover:bg-muted/40 has-[[data-row-open]:focus-visible]:bg-muted/40">
            {/* The button covers the row; the Add control sits above it. */}
            <button
                type="button"
                data-row-open=""
                onClick={onOpen}
                className="min-w-0 flex-1 text-left outline-none after:absolute after:inset-0"
            >
                <span className="block truncate font-medium text-sm leading-5">{skill.name}</span>
                <span
                    className={cn(
                        "block truncate text-muted-foreground text-xs",
                        !skill.description && "font-mono"
                    )}
                >
                    {skill.description ?? skill.repo}
                </span>
            </button>
            {detailed && skill.description && (
                <span className="hidden shrink-0 font-mono text-muted-foreground text-xs md:block">
                    {skill.repo}
                </span>
            )}
            {/* One width for both states, so the sources beside it share an edge. */}
            <div className="relative flex min-w-14 shrink-0 justify-end">
                <AddControl
                    skill={skill}
                    added={added}
                    adding={adding}
                    onAdd={onAdd}
                    onOpen={onOpen}
                />
            </div>
        </li>
    )
}

function ListSkeleton({ rows }: { rows: number }) {
    return (
        <div role="status" aria-busy="true">
            <span className="sr-only">Searching</span>
            <Card aria-hidden="true" className="gap-0 overflow-hidden py-0 shadow-none">
                {Array.from({ length: rows }, (_, row) => (
                    <div key={row} className="space-y-1.5 border-t px-4 py-3.5 first:border-t-0">
                        <Skeleton className="h-4 w-40 max-w-full" />
                        <Skeleton className="h-3 w-56 max-w-full" />
                    </div>
                ))}
            </Card>
        </div>
    )
}

// An open skill takes the tab, as an open account takes the moderation page.
function SkillPage({
    skill,
    added,
    adding,
    loadDetail,
    onBack,
    onAdd
}: {
    skill: StoreSkill
    added: boolean
    adding: boolean
    loadDetail: (skill: StoreSkill) => Promise<StoreSkillDetail>
    onBack: () => void
    onAdd: () => void
}) {
    const [detail, setDetail] = useState<StoreSkillDetail | null>(null)
    const [problem, setProblem] = useState<string | null>(null)
    // biome-ignore lint/correctness/useExhaustiveDependencies: one fetch per opened skill; the loader's identity changes with every render of its owner.
    useEffect(() => {
        let cancelled = false
        loadDetail(skill)
            .then((loaded) => {
                if (!cancelled) setDetail(loaded)
            })
            .catch((error) => {
                if (cancelled) return
                setProblem(getSkillErrorMessage(error, "This skill couldn't be read. Try again."))
            })
        return () => {
            cancelled = true
        }
    }, [getStoreSkillKey(skill)])

    const description = detail?.description ?? skill.description

    return (
        <div className="space-y-6">
            <BackButton label="Back" onClick={onBack} />
            <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                <div className="min-w-0 space-y-1">
                    <h3 className="font-semibold text-xl tracking-tight [overflow-wrap:anywhere]">
                        {skill.name}
                    </h3>
                    <SkillRepositoryLink repo={skill.repo} path={skill.path} />
                </div>
                {added ? (
                    <span className="flex h-9 shrink-0 items-center gap-1.5 text-muted-foreground text-sm">
                        <Check className="size-4" aria-hidden="true" />
                        Added
                    </span>
                ) : (
                    <Button
                        type="button"
                        className="shrink-0"
                        disabled={adding || Boolean(problem)}
                        onClick={onAdd}
                    >
                        {adding ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                            <Plus className="h-4 w-4" />
                        )}
                        Add skill
                    </Button>
                )}
            </div>
            {description && <p className="max-w-2xl text-sm">{description}</p>}
            {problem ? (
                <p className="text-destructive text-sm">{problem}</p>
            ) : (
                <>
                    {detail && <SkillNotes runsCode={detail.runsCode} audits={detail.audits} />}
                    <SkillFacts
                        instructions={<SkillInstructions text={detail?.instructions} />}
                        instructionsOpen
                        files={detail?.files ?? []}
                    >
                        <ComputerDetailItem
                            label="Source"
                            value={<SkillRepositoryLink repo={skill.repo} path={skill.path} />}
                        />
                        <SkillAuditItem audits={detail?.audits} />
                    </SkillFacts>
                </>
            )}
        </div>
    )
}

/**
 * The store. Shelves are our own categories, picked and ordered ahead of time, because the
 * store's own ranking leans toward coding agents. Search reaches everything else.
 */
export function SkillsBrowse({
    categories,
    isAdded,
    onAdd,
    onSearch,
    searchResults,
    loadDetail
}: {
    categories: SkillCategory[]
    isAdded: (skill: StoreSkill) => boolean
    /** Rejects when the skill couldn't be added; the owner reports why. */
    onAdd: (skill: StoreSkill) => Promise<void>
    onSearch: (query: string) => void
    /** Undefined while searching, null when search can't be reached. */
    searchResults: StoreSkill[] | null | undefined
    loadDetail: (skill: StoreSkill) => Promise<StoreSkillDetail>
}) {
    const [view, setView] = useState<BrowseView>({ kind: "home" })
    const [query, setQuery] = useState("")
    const [addingKeys, setAddingKeys] = useState<ReadonlySet<string>>(new Set())

    const add = (skill: StoreSkill) => {
        const key = getStoreSkillKey(skill)
        setAddingKeys((current) => new Set(current).add(key))
        void onAdd(skill)
            .catch(() => undefined)
            .finally(() =>
                setAddingKeys((current) => {
                    const next = new Set(current)
                    next.delete(key)
                    return next
                })
            )
    }
    const open = (skill: StoreSkill) =>
        setView((current) => ({ kind: "skill", skill, back: current }))
    const renderList = (skills: StoreSkill[], detailed = false) => (
        <Card className="gap-0 overflow-hidden py-0 shadow-none">
            <ul>
                {skills.map((skill) => (
                    <StoreRow
                        key={getStoreSkillKey(skill)}
                        skill={skill}
                        added={isAdded(skill)}
                        adding={addingKeys.has(getStoreSkillKey(skill))}
                        detailed={detailed}
                        onOpen={() => open(skill)}
                        onAdd={() => add(skill)}
                    />
                ))}
            </ul>
        </Card>
    )

    if (view.kind === "skill") {
        return (
            <SkillPage
                skill={view.skill}
                added={isAdded(view.skill)}
                adding={addingKeys.has(getStoreSkillKey(view.skill))}
                loadDetail={loadDetail}
                onBack={() => setView(view.back)}
                onAdd={() => add(view.skill)}
            />
        )
    }

    const category =
        view.kind === "category"
            ? categories.find((candidate) => candidate.id === view.categoryId)
            : undefined
    if (category) {
        return (
            <div className="space-y-4">
                <BackButton label="Browse" onClick={() => setView({ kind: "home" })} />
                <h3 className="font-semibold text-foreground">{category.title}</h3>
                {renderList(category.skills, true)}
            </div>
        )
    }

    const isSearching = query.trim().length >= MIN_SKILL_SEARCH_LENGTH

    return (
        <div className="space-y-8">
            <div className="relative">
                <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                    type="search"
                    aria-label="Search skills"
                    placeholder="Search skills"
                    autoComplete="off"
                    spellCheck={false}
                    className="pl-9"
                    value={query}
                    onChange={(event) => {
                        setQuery(event.target.value)
                        onSearch(event.target.value.trim())
                    }}
                />
            </div>
            {isSearching ? (
                searchResults === undefined ? (
                    <ListSkeleton rows={4} />
                ) : searchResults === null ? (
                    <p className="text-muted-foreground text-sm">
                        Search isn't available right now. Add a skill by its GitHub link under Your
                        skills.
                    </p>
                ) : searchResults.length > 0 ? (
                    renderList(searchResults, true)
                ) : (
                    <p className="text-muted-foreground text-sm">No skills match that.</p>
                )
            ) : (
                <div className="grid gap-x-6 gap-y-8 md:grid-cols-2">
                    {categories.map((shelf) => (
                        <section key={shelf.id} className="min-w-0 space-y-3">
                            <div className="flex items-center justify-between gap-3">
                                <h3 className="font-semibold text-foreground">{shelf.title}</h3>
                                {shelf.skills.length > SHELF_SIZE && (
                                    <button
                                        type="button"
                                        aria-label={`See all ${shelf.title} skills`}
                                        onClick={() =>
                                            setView({ kind: "category", categoryId: shelf.id })
                                        }
                                        className="flex items-center gap-0.5 text-muted-foreground text-xs outline-none transition-colors hover:text-foreground focus-visible:text-foreground"
                                    >
                                        See all
                                        <ChevronRight className="size-3.5" aria-hidden="true" />
                                    </button>
                                )}
                            </div>
                            {renderList(shelf.skills.slice(0, SHELF_SIZE))}
                        </section>
                    ))}
                </div>
            )}
        </div>
    )
}
