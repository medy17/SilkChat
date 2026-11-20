import { ComputerDetailItem } from "@/components/computer-ui"
import { SettingsFormActions } from "@/components/settings/settings-section"
import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
    AlertDialogTrigger
} from "@/components/ui/alert-dialog"
import { AnimatedCollapsible } from "@/components/ui/animated-collapsible"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Skeleton } from "@/components/ui/skeleton"
import { Switch } from "@/components/ui/switch"
import { cn } from "@/lib/utils"
import { Check, ChevronDown, Loader2, Plus, Trash2, Upload } from "lucide-react"
import { type ComponentType, useRef, useState } from "react"
import { SkillFacts, SkillNotes, SkillSource, formatSkillDate } from "./skill-facts"
import type { LibrarySkill } from "./skill-types"

const errorMessage = (error: unknown, fallback: string) => {
    // Convex wraps what the server said in `data`.
    const data = (error as { data?: unknown } | null)?.data
    return typeof data === "string" ? data : fallback
}

/** The skills a repository holds, when a link to it doesn't say which one is meant. */
export type SkillChoices = {
    repo: string
    // What to send back with a pick. It carries the branch the link named, if it named one.
    reference: string
    skills: { name: string; path: string }[]
}

/** Resolves with the choices when there are several skills to pick from, else null. */
type ImportRepository = (reference: string, exactPath?: string) => Promise<SkillChoices | null>

// A repository with several skills: each is added on its own, and the list stays open so
// more than one can be picked.
function SkillChoiceList({
    choices,
    isAdded,
    onImportRepository
}: {
    choices: SkillChoices
    isAdded: (repo: string, path: string) => boolean
    onImportRepository: ImportRepository
}) {
    const [adding, setAdding] = useState<ReadonlySet<string>>(new Set())
    const [error, setError] = useState<string | null>(null)
    const add = async (path: string) => {
        setAdding((current) => new Set(current).add(path))
        setError(null)
        try {
            await onImportRepository(choices.reference, path)
        } catch (failure) {
            setError(errorMessage(failure, "That skill couldn't be added. Try again."))
        } finally {
            setAdding((current) => {
                const next = new Set(current)
                next.delete(path)
                return next
            })
        }
    }

    return (
        <div className="space-y-2">
            <p className="text-muted-foreground text-sm">
                That repository holds several skills. Add the ones you want.
            </p>
            <ul className="max-h-64 overflow-y-auto rounded-[var(--radius-lg)] border">
                {choices.skills.map((skill) => (
                    <li
                        key={skill.path}
                        className="flex items-center gap-3 border-t px-3 py-2 first:border-t-0"
                    >
                        <span className="min-w-0 flex-1 truncate font-medium text-sm">
                            {skill.name}
                        </span>
                        {isAdded(choices.repo, skill.path) ? (
                            <span className="flex h-7 items-center gap-1 text-muted-foreground text-xs">
                                <Check className="size-3.5" aria-hidden="true" />
                                Added
                            </span>
                        ) : (
                            <Button
                                type="button"
                                variant="outline"
                                size="sm"
                                disabled={adding.has(skill.path)}
                                aria-label={`Add ${skill.name}`}
                                className="h-7 rounded-[var(--radius-md)] px-2.5 text-xs"
                                onClick={() => void add(skill.path)}
                            >
                                {adding.has(skill.path) ? (
                                    <Loader2
                                        className="size-3.5 animate-spin"
                                        aria-label="Adding"
                                    />
                                ) : (
                                    "Add"
                                )}
                            </Button>
                        )}
                    </li>
                ))}
            </ul>
            {error && <p className="text-destructive text-sm">{error}</p>}
        </div>
    )
}

/** A repository or a .zip, inline like adding a key. */
function ImportForm({
    isAdded,
    onImportRepository,
    onImportZip,
    onDone
}: {
    isAdded: (repo: string, path: string) => boolean
    onImportRepository: ImportRepository
    onImportZip: (file: File) => Promise<void>
    onDone: () => void
}) {
    const [reference, setReference] = useState("")
    const [pending, setPending] = useState(false)
    const [error, setError] = useState<string | null>(null)
    const [choices, setChoices] = useState<SkillChoices | null>(null)
    const fileInputRef = useRef<HTMLInputElement>(null)
    const canSave = Boolean(reference.trim()) && !pending

    const run = async (work: () => Promise<SkillChoices | null>) => {
        setPending(true)
        setError(null)
        try {
            const several = await work()
            if (several) setChoices(several)
            else onDone()
        } catch (failure) {
            setError(errorMessage(failure, "That skill couldn't be added. Try again."))
        } finally {
            setPending(false)
        }
    }

    return (
        <Card className="gap-4 p-4 shadow-xs">
            <div className="space-y-2">
                <Label htmlFor="skill-import-repository">GitHub repository</Label>
                <Input
                    id="skill-import-repository"
                    autoFocus
                    autoComplete="off"
                    spellCheck={false}
                    placeholder="owner/repo, a link to the skill, or its install command"
                    value={reference}
                    disabled={pending}
                    aria-invalid={Boolean(error)}
                    aria-describedby={error ? "skill-import-error" : undefined}
                    onChange={(event) => {
                        setReference(event.target.value)
                        setError(null)
                        setChoices(null)
                    }}
                    onKeyDown={(event) => {
                        if (event.key === "Enter" && canSave && !choices) {
                            void run(() => onImportRepository(reference.trim()))
                        }
                        if (event.key === "Escape" && !pending) onDone()
                    }}
                />
                {error && (
                    <p id="skill-import-error" className="text-destructive text-sm">
                        {error}
                    </p>
                )}
            </div>
            {choices ? (
                <>
                    <SkillChoiceList
                        choices={choices}
                        isAdded={isAdded}
                        onImportRepository={onImportRepository}
                    />
                    <div>
                        <Button type="button" variant="outline" size="sm" onClick={onDone}>
                            Done
                        </Button>
                    </div>
                </>
            ) : (
                <div className="flex flex-wrap items-center justify-between gap-3">
                    <SettingsFormActions
                        isSaving={pending}
                        canSave={canSave}
                        saveLabel="Add skill"
                        savingLabel="Adding..."
                        onSave={() => void run(() => onImportRepository(reference.trim()))}
                        onCancel={onDone}
                    />
                    <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        disabled={pending}
                        onClick={() => fileInputRef.current?.click()}
                    >
                        <Upload className="h-4 w-4" />
                        Upload a .zip
                    </Button>
                    <input
                        ref={fileInputRef}
                        type="file"
                        accept=".zip,application/zip"
                        className="hidden"
                        onChange={(event) => {
                            const file = event.target.files?.[0]
                            event.target.value = ""
                            if (file) void run(() => onImportZip(file).then(() => null))
                        }}
                    />
                </div>
            )}
        </Card>
    )
}

// One collapsed line per skill, as in the moderation queue: what it is and whether it is
// on. The rest opens underneath.
function ManageRow({
    skill,
    Instructions,
    onToggle,
    onUpdate,
    onRemove
}: {
    skill: LibrarySkill
    Instructions: ComponentType<{ skillId: string }>
    onToggle: (skill: LibrarySkill, enabled: boolean) => void
    onUpdate: (skill: LibrarySkill) => Promise<void>
    onRemove: (skill: LibrarySkill) => Promise<void>
}) {
    const [open, setOpen] = useState(false)
    // Mounted on first open, so a long library doesn't fetch every skill's instructions.
    const [opened, setOpened] = useState(false)
    const [pending, setPending] = useState<"update" | "remove" | null>(null)
    const act = async (kind: "update" | "remove", work: () => Promise<void>) => {
        setPending(kind)
        try {
            await work()
        } finally {
            setPending(null)
        }
    }

    return (
        <li className="border-t first:border-t-0">
            <div className="relative flex items-center gap-3 px-4 py-3 transition-colors hover:bg-muted/40 has-[[data-row-toggle]:focus-visible]:bg-muted/40">
                {/* The button covers the row; the switch sits above it. */}
                <button
                    type="button"
                    data-row-toggle=""
                    aria-expanded={open}
                    onClick={() => {
                        setOpened(true)
                        setOpen((current) => !current)
                    }}
                    className="min-w-0 flex-1 text-left outline-none after:absolute after:inset-0"
                >
                    <span className="block truncate font-medium text-sm leading-5">
                        {skill.slug}
                    </span>
                    <span className="block truncate text-muted-foreground text-xs">
                        {skill.description}
                    </span>
                </button>
                <Switch
                    aria-label={`Use ${skill.slug} in new chats`}
                    className="relative"
                    checked={skill.enabled}
                    onCheckedChange={(enabled) => onToggle(skill, enabled)}
                />
                <ChevronDown
                    aria-hidden="true"
                    className={cn(
                        "size-4 shrink-0 text-muted-foreground transition-transform",
                        open && "rotate-180"
                    )}
                />
            </div>
            <AnimatedCollapsible open={open}>
                <div inert={!open} className="space-y-4 px-4 pt-1 pb-4">
                    {opened ? (
                        <>
                            <p className="max-w-2xl text-muted-foreground text-sm">
                                {skill.description}
                            </p>
                            <SkillNotes runsCode={skill.runsCode} />
                            <SkillFacts
                                instructions={<Instructions skillId={skill.id} />}
                                files={skill.files.map((file) => file.path)}
                            >
                                <ComputerDetailItem
                                    label="Source"
                                    value={<SkillSource source={skill.source} />}
                                />
                                <ComputerDetailItem
                                    label="Added"
                                    value={formatSkillDate(skill.createdAt)}
                                />
                            </SkillFacts>
                            <div className="flex flex-wrap gap-2">
                                {skill.source.kind === "github" && (
                                    <Button
                                        type="button"
                                        size="sm"
                                        variant="outline"
                                        disabled={pending !== null}
                                        onClick={() => void act("update", () => onUpdate(skill))}
                                    >
                                        {pending === "update" && (
                                            <Loader2 className="h-4 w-4 animate-spin" />
                                        )}
                                        Check for updates
                                    </Button>
                                )}
                                <AlertDialog>
                                    <AlertDialogTrigger asChild>
                                        <Button
                                            type="button"
                                            size="sm"
                                            variant="ghost"
                                            disabled={pending !== null}
                                            className="text-destructive hover:text-destructive"
                                        >
                                            <Trash2 className="h-4 w-4" />
                                            Remove
                                        </Button>
                                    </AlertDialogTrigger>
                                    <AlertDialogContent>
                                        <AlertDialogHeader>
                                            <AlertDialogTitle>
                                                Remove {skill.slug}?
                                            </AlertDialogTitle>
                                            <AlertDialogDescription>
                                                Chats that use it will lose it. To keep it in those
                                                chats and only leave it out of new ones, turn it off
                                                instead.
                                            </AlertDialogDescription>
                                        </AlertDialogHeader>
                                        <AlertDialogFooter>
                                            <AlertDialogCancel>Cancel</AlertDialogCancel>
                                            <AlertDialogAction
                                                onClick={() =>
                                                    void act("remove", () => onRemove(skill))
                                                }
                                                variant="destructive"
                                            >
                                                Remove
                                            </AlertDialogAction>
                                        </AlertDialogFooter>
                                    </AlertDialogContent>
                                </AlertDialog>
                            </div>
                        </>
                    ) : null}
                </div>
            </AnimatedCollapsible>
        </li>
    )
}

function ManageSkeleton() {
    return (
        <div role="status" aria-busy="true">
            <span className="sr-only">Loading</span>
            <Card aria-hidden="true" className="gap-0 overflow-hidden py-0 shadow-none">
                {[0, 1, 2].map((row) => (
                    <div
                        key={row}
                        className="flex items-center gap-3 border-t px-4 py-3 first:border-t-0"
                    >
                        <div className="min-w-0 flex-1 space-y-1.5 py-0.5">
                            <Skeleton className="h-4 w-32 max-w-full" />
                            <Skeleton className="h-3 w-72 max-w-full" />
                        </div>
                        <Skeleton className="h-[1.15rem] w-8 rounded-full" />
                    </div>
                ))}
            </Card>
        </div>
    )
}

export function SkillsManage({
    skills,
    Instructions,
    onToggle,
    onUpdate,
    onRemove,
    onImportRepository,
    onImportZip,
    onBrowse
}: {
    /** Undefined while the library loads. */
    skills: LibrarySkill[] | undefined
    Instructions: ComponentType<{ skillId: string }>
    onToggle: (skill: LibrarySkill, enabled: boolean) => void
    onUpdate: (skill: LibrarySkill) => Promise<void>
    onRemove: (skill: LibrarySkill) => Promise<void>
    /** Resolves with the choices when the link is to a repository holding several skills. */
    onImportRepository: ImportRepository
    onImportZip: (file: File) => Promise<void>
    onBrowse: () => void
}) {
    const [isAdding, setIsAdding] = useState(false)
    const isAdded = (repo: string, path: string) =>
        (skills ?? []).some(
            (skill) =>
                skill.source.kind === "github" &&
                skill.source.repo.toLowerCase() === repo.toLowerCase() &&
                skill.source.path === path
        )

    return (
        <div className="space-y-4">
            <div className="flex min-h-8 flex-wrap items-center justify-between gap-3">
                <p className="text-muted-foreground text-sm">
                    Skills that are on are ready in every new chat.
                </p>
                {!isAdding && (
                    <Button variant="outline" size="sm" onClick={() => setIsAdding(true)}>
                        <Plus className="h-4 w-4" />
                        Add your own
                    </Button>
                )}
            </div>
            {isAdding && (
                <ImportForm
                    isAdded={isAdded}
                    onImportRepository={onImportRepository}
                    onImportZip={onImportZip}
                    onDone={() => setIsAdding(false)}
                />
            )}
            {skills === undefined ? (
                <ManageSkeleton />
            ) : skills.length === 0 ? (
                <Card className="items-start gap-4 p-5 shadow-none">
                    <div>
                        <h4 className="font-medium">No skills yet</h4>
                        <p className="mt-1 text-muted-foreground text-sm">
                            Pick some from the store, or add your own from GitHub or a .zip.
                        </p>
                    </div>
                    <Button variant="outline" size="sm" onClick={onBrowse}>
                        Browse skills
                    </Button>
                </Card>
            ) : (
                <Card className="gap-0 overflow-hidden py-0 shadow-none">
                    <ul>
                        {skills.map((skill) => (
                            <ManageRow
                                key={skill.id}
                                skill={skill}
                                Instructions={Instructions}
                                onToggle={onToggle}
                                onUpdate={onUpdate}
                                onRemove={onRemove}
                            />
                        ))}
                    </ul>
                </Card>
            )}
        </div>
    )
}

export { errorMessage as getSkillErrorMessage }
