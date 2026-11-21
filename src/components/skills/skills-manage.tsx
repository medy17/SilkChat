import { AttachmentStatusOverlay, type AttachmentTileStatus } from "@/components/attachment-tile"
import { ComputerDetailItem } from "@/components/computer-ui"
import { FullPageDropOverlay } from "@/components/full-page-drop-overlay"
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
import {
    type SkillUploadResult,
    type ZipUploadItem,
    importSkillZipBatch,
    selectSkillZipFiles
} from "@/lib/skill-zip"
import { cn } from "@/lib/utils"
import {
    Check,
    ChevronDown,
    CircleAlert,
    FileArchive,
    Loader2,
    Plus,
    Trash2,
    Upload,
    X
} from "lucide-react"
import { type ComponentType, type ReactNode, useEffect, useRef, useState } from "react"
import { toast } from "sonner"
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

/** Inside the Add a skill row: a repository, or a .zip through the list's own picker. */
function ImportForm({
    isAdded,
    onImportRepository,
    onUploadZip,
    onDone
}: {
    isAdded: (repo: string, path: string) => boolean
    onImportRepository: ImportRepository
    /** Opens the list's own picker, for people who come here looking for a .zip. */
    onUploadZip: () => void
    onDone: () => void
}) {
    const [reference, setReference] = useState("")
    const [pending, setPending] = useState(false)
    const [error, setError] = useState<string | null>(null)
    const [choices, setChoices] = useState<SkillChoices | null>(null)
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
        <div className="space-y-4">
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
                        onClick={onUploadZip}
                    >
                        <Upload className="h-4 w-4" />
                        Upload a .zip
                    </Button>
                </div>
            )}
        </div>
    )
}

// How long a landed .zip shows its check before the veil lifts off the skill's row.
const UPLOAD_SETTLE_MS = 600

const tileStatus = (status: ZipUploadItem["status"]): AttachmentTileStatus =>
    status === "failed"
        ? "error"
        : status === "queued" || status === "uploading"
          ? "uploading"
          : "success"

// A .zip on its way into the library: a whole row, under an attachment's upload veil. Once
// it lands as a new skill, the row becomes that skill's row where it stands, so the veil
// lifts off the real thing instead of a second copy appearing.
function ZipUploadRow({
    item,
    skill,
    landing,
    rowProps,
    onDismiss
}: {
    item: ZipUploadItem
    skill?: LibrarySkill
    landing: boolean
    rowProps: Omit<ManageRowProps, "skill">
    onDismiss: () => void
}) {
    const status = tileStatus(item.status)
    return (
        <li className="relative overflow-hidden border-t first:border-t-0">
            {skill ? (
                <ManageRowBody skill={skill} {...rowProps} />
            ) : (
                <div
                    className={cn(
                        "flex items-center gap-3 px-4 py-3",
                        status === "error" && "pr-12"
                    )}
                >
                    {status === "error" ? (
                        <CircleAlert
                            className="size-4 shrink-0 text-destructive"
                            aria-hidden="true"
                        />
                    ) : (
                        <FileArchive
                            className="size-4 shrink-0 text-muted-foreground"
                            aria-hidden="true"
                        />
                    )}
                    <div className="min-w-0 flex-1">
                        <span className="block truncate font-medium text-sm leading-5">
                            {item.slug ?? item.fileName}
                        </span>
                        <span
                            className={cn(
                                "block truncate text-muted-foreground text-xs",
                                status === "error" && "text-destructive"
                            )}
                        >
                            {status === "error" ? item.error : "Adding"}
                        </span>
                    </div>
                </div>
            )}
            {/* A failure stays until dismissed, so it lifts the veil: the row has room to say
                which file failed and why, which a tile's "Upload failed" badge doesn't. */}
            <AttachmentStatusOverlay
                status={(skill && !landing) || status === "error" ? "ready" : status}
                flush
            />
            {status === "error" && (
                <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    aria-label={`Dismiss ${item.fileName}`}
                    onClick={onDismiss}
                    className="absolute top-1/2 right-3 z-10 size-7 -translate-y-1/2"
                >
                    <X className="size-4" />
                </Button>
            )}
        </li>
    )
}

// The way in for your own skills, as the list's first row. It opens like a skill's row
// to offer GitHub or a .zip; dropping files anywhere skips it and uploads straight away.
function AddSkillRow({
    open,
    onToggle,
    children
}: {
    open: boolean
    onToggle: () => void
    children: ReactNode
}) {
    return (
        <li className="border-t first:border-t-0">
            <button
                type="button"
                aria-expanded={open}
                onClick={onToggle}
                className={cn(
                    "flex w-full items-center gap-3 px-4 py-3 text-left outline-none transition-colors hover:bg-muted/40 hover:text-foreground focus-visible:bg-muted/40 focus-visible:text-foreground",
                    open ? "text-foreground" : "text-muted-foreground"
                )}
            >
                <Plus className="size-4 shrink-0" aria-hidden="true" />
                <span className="min-w-0 flex-1">
                    <span className="block truncate font-medium text-sm leading-5">
                        Add a skill
                    </span>
                    <span className="block truncate text-muted-foreground text-xs">
                        From GitHub or .zip files, or drop them anywhere on this page
                    </span>
                </span>
                <ChevronDown
                    aria-hidden="true"
                    className={cn(
                        "size-4 shrink-0 text-muted-foreground transition-transform",
                        open && "rotate-180"
                    )}
                />
            </button>
            <AnimatedCollapsible open={open}>
                <div inert={!open} className="px-4 pt-1 pb-4">
                    {children}
                </div>
            </AnimatedCollapsible>
        </li>
    )
}

type ManageRowProps = {
    skill: LibrarySkill
    Instructions: ComponentType<{ skillId: string }>
    onToggle: (skill: LibrarySkill, enabled: boolean) => void
    onUpdate: (skill: LibrarySkill) => Promise<void>
    onRemove: (skill: LibrarySkill) => Promise<void>
}

// A skill's row. While a .zip that just landed on it settles, the upload's check sits over it.
function ManageRow({ landing = false, ...props }: ManageRowProps & { landing?: boolean }) {
    return (
        <li className="relative border-t first:border-t-0">
            <ManageRowBody {...props} />
            <AttachmentStatusOverlay status={landing ? "success" : "ready"} flush />
        </li>
    )
}

// One collapsed line per skill, as in the moderation queue: what it is and whether it is
// on. The rest opens underneath.
function ManageRowBody({ skill, Instructions, onToggle, onUpdate, onRemove }: ManageRowProps) {
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
        <>
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
        </>
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
    onImportZipsDone,
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
    onImportZip: (file: File) => Promise<SkillUploadResult>
    /** Called once every .zip in an upload has landed or failed. */
    onImportZipsDone?: (items: ZipUploadItem[]) => void
    onBrowse: () => void
}) {
    const [isAdding, setIsAdding] = useState(false)
    // Bumped on each open, so the form starts clean and its field takes focus.
    const [addFormKey, setAddFormKey] = useState(0)
    const toggleAdding = () => {
        if (!isAdding) setAddFormKey((key) => key + 1)
        setIsAdding(!isAdding)
    }
    const [uploads, setUploads] = useState<ZipUploadItem[]>([])
    const [dismissedUploads, setDismissedUploads] = useState<ReadonlySet<string>>(new Set())
    // Uploads that landed in the last moment, still showing their check.
    const [landingUploads, setLandingUploads] = useState<ReadonlySet<string>>(new Set())
    // The library as it stood when uploading began. A skill that turns up mid-upload stays
    // out of the list until its upload claims it, so it never shows twice.
    const [libraryBeforeUpload, setLibraryBeforeUpload] = useState<ReadonlySet<string>>(new Set())
    const uploadCountRef = useRef(0)
    const batchesInFlightRef = useRef(0)
    const fileInputRef = useRef<HTMLInputElement>(null)

    const setIn = (
        update: (fn: (current: ReadonlySet<string>) => ReadonlySet<string>) => void,
        id: string,
        present: boolean
    ) =>
        update((current) => {
            const next = new Set(current)
            if (present) next.add(id)
            else next.delete(id)
            return next
        })

    // Each file gets a row at once. A new skill takes over its row; a failed one stays
    // until dismissed.
    const uploadZips = async (rawFiles: File[]) => {
        const files = selectSkillZipFiles(rawFiles)
        if (files.length < rawFiles.length) toast.warning("Only .zip files can be added.")
        if (files.length === 0) return

        if (batchesInFlightRef.current === 0) {
            setLibraryBeforeUpload(new Set((skills ?? []).map((skill) => skill.id)))
        }
        batchesInFlightRef.current += 1
        const firstIndex = uploadCountRef.current
        uploadCountRef.current += files.length
        const settled = new Set<string>()
        const items = await importSkillZipBatch(
            files,
            onImportZip,
            (failure) => errorMessage(failure, "That skill couldn't be added. Try again."),
            (snapshot) => {
                setUploads((current) => {
                    const next = new Map(current.map((item) => [item.id, item]))
                    for (const item of snapshot) next.set(item.id, item)
                    return [...next.values()]
                })
                for (const item of snapshot) {
                    if (settled.has(item.id) || tileStatus(item.status) === "uploading") continue
                    settled.add(item.id)
                    if (item.status === "failed") {
                        toast.error(`Couldn't add ${item.fileName}`, { description: item.error })
                    } else {
                        setIn(setLandingUploads, item.id, true)
                        window.setTimeout(
                            () => setIn(setLandingUploads, item.id, false),
                            UPLOAD_SETTLE_MS
                        )
                    }
                }
            },
            firstIndex
        )
        batchesInFlightRef.current -= 1
        onImportZipsDone?.(items)
    }

    const rowProps = { Instructions, onToggle, onUpdate, onRemove }
    const visibleUploads = uploads.filter((item) => !dismissedUploads.has(item.id))
    const isUploading = visibleUploads.some((item) => tileStatus(item.status) === "uploading")
    // A new skill rides in its upload's row; one that already existed keeps its own. A skill
    // fills one row only, the newest upload's, however many times it has been uploaded.
    const claims = new Map<string, LibrarySkill>()
    const claimedSkillIds = new Set<string>()
    for (const item of [...visibleUploads].reverse()) {
        if (item.status !== "added") continue
        const skill = skills?.find((owned) => owned.slug === item.slug)
        if (!skill || claimedSkillIds.has(skill.id)) continue
        claims.set(item.id, skill)
        claimedSkillIds.add(skill.id)
    }
    const landingSlugs = new Set(
        visibleUploads.flatMap((item) =>
            landingUploads.has(item.id) && item.slug ? [item.slug] : []
        )
    )
    const listedSkills = (skills ?? []).filter(
        (skill) =>
            !claimedSkillIds.has(skill.id) && !(isUploading && !libraryBeforeUpload.has(skill.id))
    )

    const uploadRows = visibleUploads.flatMap((item) => {
        const landing = Boolean(item.slug && landingSlugs.has(item.slug))
        const skill = claims.get(item.id)
        // An existing skill's own row takes the check instead.
        if (item.status === "updated" || item.status === "unchanged") return []
        // Landed, but its skill shows in a newer upload's row, or its row hasn't arrived and
        // the check is done.
        if (
            item.status === "added" &&
            !skill &&
            (!landing || (skills ?? []).some((owned) => owned.slug === item.slug))
        ) {
            return []
        }
        return [{ item, skill, landing }]
    })

    // Once its skill has shown and then gone, an upload's row is finished for good, so adding
    // that skill again later can't bring the old row back.
    const seenUploadSkillsRef = useRef(new Set<string>())
    useEffect(() => {
        if (!skills) return
        const finished: string[] = []
        for (const item of uploads) {
            if (item.status !== "added" || dismissedUploads.has(item.id)) continue
            if (skills.some((skill) => skill.slug === item.slug)) {
                seenUploadSkillsRef.current.add(item.id)
            } else if (seenUploadSkillsRef.current.has(item.id)) {
                finished.push(item.id)
            }
        }
        if (finished.length > 0) {
            setDismissedUploads((current) => new Set([...current, ...finished]))
        }
    }, [skills, uploads, dismissedUploads])

    const isAdded = (repo: string, path: string) =>
        (skills ?? []).some(
            (skill) =>
                skill.source.kind === "github" &&
                skill.source.repo.toLowerCase() === repo.toLowerCase() &&
                skill.source.path === path
        )

    return (
        <div className="space-y-4">
            {/* The chat's drop overlay, so dropping files reads the same everywhere. */}
            <FullPageDropOverlay
                title="Add Skills"
                description="Drop skill .zip files here to add them"
                hint="Accepted file types: .zip"
                onDrop={(files) => void uploadZips(files)}
            />
            <input
                ref={fileInputRef}
                type="file"
                accept=".zip,application/zip"
                multiple
                className="hidden"
                onChange={(event) => {
                    const files = Array.from(event.target.files ?? [])
                    event.target.value = ""
                    if (files.length === 0) return
                    // Close the Add a skill row, so the upload rows under it are in view.
                    setIsAdding(false)
                    void uploadZips(files)
                }}
            />
            <p className="flex min-h-8 items-center text-muted-foreground text-sm">
                Skills that are on are ready in every new chat.
            </p>
            {skills === undefined ? (
                <ManageSkeleton />
            ) : (
                <Card className="gap-0 overflow-hidden py-0 shadow-none">
                    <ul>
                        {/* Gone as soon as an upload row shows, not when the skill lands. */}
                        {skills.length === 0 && uploadRows.length === 0 && (
                            <li className="space-y-4 p-5">
                                <div>
                                    <h4 className="font-medium">No skills yet</h4>
                                    <p className="mt-1 text-muted-foreground text-sm">
                                        Pick some from the store, or add your own from GitHub or
                                        .zip files.
                                    </p>
                                </div>
                                <Button variant="outline" size="sm" onClick={onBrowse}>
                                    Browse skills
                                </Button>
                            </li>
                        )}
                        {/* Up top so it's in view however long the library is; uploads land
                            right under it. */}
                        <AddSkillRow open={isAdding} onToggle={toggleAdding}>
                            {addFormKey > 0 && (
                                <ImportForm
                                    key={addFormKey}
                                    isAdded={isAdded}
                                    onImportRepository={onImportRepository}
                                    onUploadZip={() => fileInputRef.current?.click()}
                                    onDone={() => setIsAdding(false)}
                                />
                            )}
                        </AddSkillRow>
                        {uploadRows.map(({ item, skill, landing }) => (
                            <ZipUploadRow
                                key={item.id}
                                item={item}
                                skill={skill}
                                landing={landing}
                                rowProps={rowProps}
                                onDismiss={() => setIn(setDismissedUploads, item.id, true)}
                            />
                        ))}
                        {listedSkills.map((skill) => (
                            <ManageRow
                                key={skill.id}
                                skill={skill}
                                landing={landingSlugs.has(skill.slug)}
                                {...rowProps}
                            />
                        ))}
                    </ul>
                </Card>
            )}
        </div>
    )
}

export { errorMessage as getSkillErrorMessage }
