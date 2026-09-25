import {
    PersonaAvatarCropper as AvatarCropper,
    type PersonaAvatarCropState as AvatarCropState,
    readPersonaAvatarAsDataUrl as readFileAsDataUrl,
    cropPersonaAvatarToSquare as cropAvatarToSquare,
    compressPersonaAvatar as compressAvatar
} from "@/components/persona-avatar-cropper"
import { AttachmentTile, type AttachmentTileStatus } from "@/components/attachment-tile"
import { ModelSelector } from "@/components/model-selector"
import { MemoizedMarkdown } from "@/components/memoized-markdown"
import { USER_MESSAGE_BUBBLE_CLASS } from "@/components/message-presentation"
import { PersonaAvatar } from "@/components/persona-avatar"
import { RoleplayPersonaProvider } from "@/components/roleplay-persona-context"
import { SettingsLayout } from "@/components/settings/settings-layout"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle
} from "@/components/ui/dialog"
import {
    Drawer,
    DrawerClose,
    DrawerContent,
    DrawerDescription,
    DrawerFooter,
    DrawerHeader,
    DrawerTitle
} from "@/components/ui/drawer"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
import { Textarea } from "@/components/ui/textarea"
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip"
import { api } from "@/convex/_generated/api"
import type { Id } from "@/convex/_generated/dataModel"
import { useSession, useToken } from "@/hooks/auth-hooks"
import { useIsMobile } from "@/hooks/use-mobile"
import {
    notifyModelReplacement,
    resolveAvailableModelReplacement
} from "@/hooks/use-model-lifecycle-migration"
import { resolveJwtToken } from "@/lib/auth-token"
import { browserEnv } from "@/lib/browser-env"
import { uploadFileDirect } from "@/lib/direct-upload"
import { estimateTokenCount } from "@/lib/file_constants"
import { useAvailableModels } from "@/lib/models-providers-shared"
import {
    MAX_PERSONA_KNOWLEDGE_DOCS,
    MAX_PERSONA_OPENINGS,
    MAX_PERSONA_OPENING_LENGTH,
    MAX_PERSONA_PROMPT_TOKENS,
    MAX_PERSONA_STARTERS,
    MIN_PERSONA_STARTERS
} from "@/lib/personas/builtins"
import { useSharedModels } from "@/lib/shared-models"
import { cn } from "@/lib/utils"
import { useConvexAuth, useConvexMutation, useConvexQuery } from "@convex-dev/react-query"
import { createFileRoute } from "@tanstack/react-router"
import {
    CircleAlert,
    CircleX,
    Copy,
    Loader2,
    Pencil,
    Plus,
    Save,
    Trash2,
    Undo2,
    Upload,
    X
} from "lucide-react"
import { AnimatePresence, motion } from "motion/react"
import {
    type Dispatch,
    type ReactElement,
    type RefObject,
    type SetStateAction,
    useEffect,
    useMemo,
    useRef,
    useState
} from "react"
import type { Area } from "react-easy-crop"
import { toast } from "sonner"

export const Route = createFileRoute("/settings/personas")({
    component: PersonasSettings
})

type PersonaAvatarUpload = {
    key: string
    fileName: string
    fileType: "image/avif" | "image/webp" | "image/jpeg" | "image/png"
    fileSize: number
}

type PersonaDocUpload = {
    key: string
    fileName: string
    fileType: "text/markdown"
    fileSize: number
    tokenCount: number
}

// A document still uploading, shown with the composer's progress, check, and failure states.
type PendingPersonaDoc = {
    id: string
    fileName: string
    startedAt: number
    progress: number
    status: AttachmentTileStatus
    error?: string
    abortController: AbortController
}

const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))

type PersonaFormState = {
    personaId?: Id<"userPersonas">
    name: string
    shortName: string
    description: string
    instructions: string
    conversationStarters: string[]
    openings: string[]
    defaultModelId: string
    roleplayFormat: boolean
    avatar: PersonaAvatarUpload | null
    knowledgeDocs: PersonaDocUpload[]
}

type UserPersonaRecord = {
    _id: Id<"userPersonas">
    name: string
    shortName?: string
    description: string
    instructions: string
    conversationStarters: string[]
    openings?: string[]
    defaultModelId: string
    roleplayFormat?: boolean
    avatarKey?: string
    avatarMimeType?: PersonaAvatarUpload["fileType"]
    avatarSizeBytes?: number
    knowledgeDocs: Array<{
        key: string
        fileName: string
        sizeBytes: number
        tokenCount: number
    }>
}

const EMPTY_FORM: PersonaFormState = {
    name: "",
    shortName: "",
    description: "",
    instructions: "",
    conversationStarters: Array.from({ length: MIN_PERSONA_STARTERS }, () => ""),
    openings: [""],
    defaultModelId: "",
    roleplayFormat: true,
    avatar: null,
    knowledgeDocs: []
}

const MAX_AVATAR_BYTES = 100 * 1024
const PERSONA_DESCRIPTION_TEXTAREA_CLASS =
    "h-24 max-h-40 resize-y overflow-y-auto [field-sizing:fixed]"
const PERSONA_INSTRUCTIONS_TEXTAREA_CLASS =
    "h-56 max-h-[50dvh] resize-y overflow-y-auto [field-sizing:fixed]"

const estimatePromptUsage = (form: PersonaFormState) =>
    Math.ceil(
        (form.name.length +
            form.description.length +
            form.instructions.length +
            form.conversationStarters.join("").length +
            form.openings.join("").length) /
            4
    ) + form.knowledgeDocs.reduce((sum, doc) => sum + doc.tokenCount, 0)

const normalizeStarterList = (starters: string[]) =>
    starters.map((starter) => starter.trim()).filter(Boolean)
const ensureStarterSlots = (starters: string[]) =>
    starters.length >= MIN_PERSONA_STARTERS
        ? starters
        : [...starters, ...Array.from({ length: MIN_PERSONA_STARTERS - starters.length }, () => "")]

const buildFormFromPersona = (persona: UserPersonaRecord, duplicate = false): PersonaFormState => ({
    personaId: duplicate ? undefined : persona._id,
    name: duplicate ? `${persona.name} Copy` : persona.name,
    shortName: persona.shortName || persona.name.slice(0, 10),
    description: persona.description,
    instructions: persona.instructions,
    conversationStarters: ensureStarterSlots(persona.conversationStarters),
    openings: persona.openings?.length ? persona.openings : [""],
    defaultModelId: persona.defaultModelId,
    roleplayFormat: persona.roleplayFormat === true,
    avatar: persona.avatarKey
        ? {
              key: persona.avatarKey,
              fileName: persona.avatarKey.split("/").pop() || "avatar",
              fileType: persona.avatarMimeType || "image/webp",
              fileSize: persona.avatarSizeBytes || 0
          }
        : null,
    knowledgeDocs: persona.knowledgeDocs.map((doc) => ({
        key: doc.key,
        fileName: doc.fileName,
        fileType: "text/markdown",
        fileSize: doc.sizeBytes,
        tokenCount: doc.tokenCount
    }))
})

type PersonaSaveTone = "ready" | "warning" | "danger"
// Only a problem is worth a message; a savable persona is the quiet default. The
// message names the next thing to fix and counts the rest, so it stays one line.
type PersonaSaveIssue = {
    tone: Exclude<PersonaSaveTone, "ready">
    message: string
    remaining?: number
    // The element to bring into view when the message is activated.
    targetId?: string
}

// One state vocabulary for the footer: primary reads as fine (as success toasts do),
// warning as something left to fill in, destructive as a limit that blocks saving.
const SAVE_TONE_TEXT: Record<PersonaSaveTone, string> = {
    ready: "text-primary",
    warning: "text-warning",
    danger: "text-destructive"
}
const SAVE_ISSUE_ICON: Record<PersonaSaveIssue["tone"], typeof CircleAlert> = {
    warning: CircleAlert,
    danger: CircleX
}
const compactNumber = new Intl.NumberFormat("en", { notation: "compact" })

const getPersonaSaveIssue = (
    form: PersonaFormState,
    {
        starterCount,
        promptUsage,
        hasValidModel,
        uploadingDocs
    }: {
        starterCount: number
        promptUsage: number
        hasValidModel: boolean
        uploadingDocs: number
    }
): PersonaSaveIssue | undefined => {
    if (promptUsage > MAX_PERSONA_PROMPT_TOKENS) {
        return {
            tone: "danger",
            message: `${compactNumber.format(promptUsage - MAX_PERSONA_PROMPT_TOKENS)} tokens over the limit`,
            targetId: "persona-instructions"
        }
    }
    const missingStarters = MIN_PERSONA_STARTERS - starterCount
    const missing = [
        !form.name.trim() && { message: "Add a name", targetId: "persona-name" },
        !form.shortName.trim() && { message: "Add a short name", targetId: "persona-short-name" },
        !form.description.trim() && {
            message: "Add a description",
            targetId: "persona-description"
        },
        !form.instructions.trim() && {
            message: "Add instructions",
            targetId: "persona-instructions"
        },
        (!form.defaultModelId || !hasValidModel) && {
            message: "Choose a default model",
            targetId: "persona-default-model"
        },
        missingStarters > 0 && {
            message:
                missingStarters === 1
                    ? "Add one more conversation starter"
                    : `Add ${missingStarters} conversation starters`,
            targetId: "persona-conversation-starters"
        }
    ].filter((item): item is { message: string; targetId: string } => Boolean(item))
    if (missing.length > 0) {
        return { tone: "warning", ...missing[0], remaining: missing.length - 1 }
    }
    if (form.shortName.trim().length > 10) {
        return { tone: "warning", message: "Keep the short name to 10 characters." }
    }
    if (starterCount > MAX_PERSONA_STARTERS) {
        return {
            tone: "warning",
            message: `Keep conversation starters to ${MAX_PERSONA_STARTERS}.`
        }
    }
    // Documents join the form only once their upload settles, so saving earlier would drop them.
    if (uploadingDocs > 0) {
        return {
            tone: "warning",
            message:
                uploadingDocs === 1
                    ? "Waiting for a document to upload"
                    : `Waiting for ${uploadingDocs} documents to upload`
        }
    }
    return undefined
}

// Brings the field behind a save issue into view and focuses where the user types;
// for the starters, that is the first empty one.
function revealSaveIssue({ targetId }: PersonaSaveIssue) {
    const target = targetId ? document.getElementById(targetId) : null
    if (!target) return
    target.scrollIntoView({ behavior: "smooth", block: "center" })
    const focusable = target.matches("input, textarea")
        ? target
        : target.querySelector<HTMLElement>("input:placeholder-shown, input, textarea, button")
    focusable?.focus({ preventScroll: true })
}

// SilkChat tooltips, raised above the editor's z-[70] layer like its model picker.
function EditorTooltip({
    label,
    side = "top",
    children
}: {
    label: string
    side?: "top" | "right" | "bottom"
    children: ReactElement
}) {
    return (
        <Tooltip delayDuration={150}>
            <TooltipTrigger asChild>{children}</TooltipTrigger>
            <TooltipContent side={side} className="z-[80]">
                <p>{label}</p>
            </TooltipContent>
        </Tooltip>
    )
}

function PersonaTokenRing({ used, max }: { used: number; max: number }) {
    const radius = 8
    const circumference = 2 * Math.PI * radius
    const ratio = Math.min(1, used / max)
    const tone: PersonaSaveTone = used > max ? "danger" : used >= max * 0.8 ? "warning" : "ready"
    return (
        <EditorTooltip label={`${used.toLocaleString()} of ${max.toLocaleString()} prompt tokens`}>
            <div className="flex shrink-0 items-center gap-2 text-muted-foreground text-xs tabular-nums">
                <svg
                    viewBox="0 0 20 20"
                    className="size-5 -rotate-90"
                    role="meter"
                    aria-label="Persona prompt size"
                    aria-valuemin={0}
                    aria-valuemax={max}
                    aria-valuenow={used}
                    aria-valuetext={`${used.toLocaleString()} of ${max.toLocaleString()} tokens`}
                >
                    <circle
                        cx="10"
                        cy="10"
                        r={radius}
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2.5"
                        className="opacity-20"
                    />
                    {used > 0 && (
                        <circle
                            cx="10"
                            cy="10"
                            r={radius}
                            fill="none"
                            stroke="currentColor"
                            strokeWidth="2.5"
                            strokeLinecap="round"
                            strokeDasharray={circumference}
                            strokeDashoffset={circumference * (1 - ratio)}
                            className={cn(
                                "transition-[stroke-dashoffset] duration-300",
                                SAVE_TONE_TEXT[tone]
                            )}
                        />
                    )}
                </svg>
                <span className={cn(tone === "danger" && "text-destructive")}>
                    {compactNumber.format(used)} / {compactNumber.format(max)} tokens
                </span>
            </div>
        </EditorTooltip>
    )
}

// The add row sits exactly where the next input will appear, so adding reads as the
// row turning into an input; the last allowed entry simply takes the row's place.
// The first `minSlots` inputs are always shown and cannot be removed.
function PromptList({
    items,
    onChange,
    minSlots,
    max,
    maxLength,
    itemLabel,
    placeholder,
    addLabel
}: {
    items: string[]
    onChange: (items: string[]) => void
    minSlots: number
    max: number
    maxLength: number
    itemLabel: string
    placeholder: string
    addLabel: string
}) {
    const keys = useRef<string[]>([])
    const nextKey = useRef(0)
    const focusIndex = useRef<number | null>(null)
    while (keys.current.length < items.length) keys.current.push(`item-${nextKey.current++}`)
    if (keys.current.length > items.length) keys.current.length = items.length
    const canAdd = items.length < max
    const slide = { type: "spring", stiffness: 520, damping: 42 } as const

    return (
        <ol className="space-y-3">
            {items.map((item, index) => (
                <motion.li
                    key={keys.current[index]}
                    layout="position"
                    transition={slide}
                    className="relative"
                >
                    <Input
                        ref={(element) => {
                            if (element && focusIndex.current === index) {
                                element.focus()
                                focusIndex.current = null
                            }
                        }}
                        value={item}
                        maxLength={maxLength}
                        aria-label={`${itemLabel} ${index + 1}`}
                        placeholder={placeholder}
                        className={cn(index >= minSlots && "pr-10")}
                        onChange={(event) =>
                            onChange(
                                items.map((value, valueIndex) =>
                                    valueIndex === index ? event.target.value : value
                                )
                            )
                        }
                    />
                    {index >= minSlots && (
                        <Button
                            variant="ghost"
                            size="icon"
                            type="button"
                            aria-label={`Remove ${itemLabel.toLowerCase()} ${index + 1}`}
                            className="absolute top-1/2 right-1 size-7 -translate-y-1/2 text-muted-foreground hover:text-destructive"
                            onClick={() => {
                                keys.current.splice(index, 1)
                                onChange(items.filter((_, valueIndex) => valueIndex !== index))
                            }}
                        >
                            <Trash2 className="size-4" />
                        </Button>
                    )}
                </motion.li>
            ))}
            {canAdd && (
                <motion.li
                    key="add-item"
                    layout="position"
                    transition={slide}
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                >
                    <button
                        type="button"
                        onClick={() => {
                            focusIndex.current = items.length
                            onChange([...items, ""])
                        }}
                        className="flex h-9 w-full min-w-0 items-center gap-2 rounded-md border border-input border-dashed px-3 text-muted-foreground text-sm transition-colors hover:border-ring hover:text-foreground focus-visible:border-ring focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50"
                    >
                        <Plus className="size-4 shrink-0" />
                        {addLabel}
                    </button>
                </motion.li>
            )}
        </ol>
    )
}

const isKnowledgeFile = (file: File) =>
    /\.(?:md|markdown|txt)$/i.test(file.name) ||
    file.type === "text/markdown" ||
    file.type === "text/plain"

// The composer's corner action for attachment tiles: cancel, remove, or dismiss a failure.
function KnowledgeTileAction({ label, onClick }: { label: string; onClick: () => void }) {
    return (
        <EditorTooltip label={label}>
            <Button
                type="button"
                variant="secondary"
                size="icon"
                onClick={onClick}
                aria-label={label}
                className="absolute -top-2 -right-2 h-8 w-8 bg-background/50 text-foreground opacity-100 shadow-sm transition-opacity hover:bg-destructive hover:text-destructive-foreground focus-visible:opacity-100 md:-top-1 md:-right-1 md:h-5 md:w-5 md:opacity-0 md:group-hover:opacity-100"
                style={{ borderRadius: "var(--radius-xl)" }}
            >
                <X className="size-4 md:size-3" />
            </Button>
        </EditorTooltip>
    )
}

// Documents use the composer's attachment tiles and upload lifecycle, so files look
// and move the same wherever they are attached. The section also accepts dropped files.
function KnowledgeBaseFiles({
    docs,
    pendingDocs,
    docsInputRef,
    onUpload,
    onRemove,
    onCancelPending
}: {
    docs: PersonaDocUpload[]
    pendingDocs: PendingPersonaDoc[]
    docsInputRef: RefObject<HTMLInputElement | null>
    onUpload: (files: FileList | File[] | null) => Promise<void>
    onRemove: (key: string) => void
    onCancelPending: (id: string) => void
}) {
    const [isDragging, setIsDragging] = useState(false)
    const remaining = MAX_PERSONA_KNOWLEDGE_DOCS - docs.length - pendingDocs.length

    return (
        <section
            aria-labelledby="persona-knowledge-label"
            className="space-y-3"
            onDragOver={(event) => {
                if (remaining <= 0 || !event.dataTransfer.types.includes("Files")) return
                event.preventDefault()
                setIsDragging(true)
            }}
            onDragLeave={(event) => {
                if (!event.currentTarget.contains(event.relatedTarget as Node | null)) {
                    setIsDragging(false)
                }
            }}
            onDrop={(event) => {
                if (remaining <= 0) return
                event.preventDefault()
                setIsDragging(false)
                const files = Array.from(event.dataTransfer.files)
                const accepted = files.filter(isKnowledgeFile)
                if (accepted.length < files.length) {
                    toast.warning("Only Markdown and plain text files can be added.")
                }
                if (accepted.length > 0) void onUpload(accepted)
            }}
        >
            <Label id="persona-knowledge-label">Knowledge Base</Label>
            <input
                ref={docsInputRef}
                type="file"
                accept=".md,.markdown,.txt,text/markdown,text/plain"
                className="hidden"
                multiple
                onChange={(event) => {
                    void onUpload(event.target.files)
                    event.target.value = ""
                }}
            />
            <div
                className={cn(
                    "flex flex-wrap gap-2 rounded-lg transition-shadow",
                    isDragging && "ring-2 ring-ring/50 ring-offset-4 ring-offset-background"
                )}
            >
                {docs.map((doc) => (
                    <div key={doc.key} className="group relative">
                        <EditorTooltip
                            label={`${doc.fileName} · ${doc.tokenCount.toLocaleString()} tokens`}
                        >
                            <div>
                                <AttachmentTile
                                    fileName={doc.fileName}
                                    className="w-auto min-w-[5rem]"
                                    nativeTitle={false}
                                />
                            </div>
                        </EditorTooltip>
                        <KnowledgeTileAction
                            label={`Remove ${doc.fileName}`}
                            onClick={() => onRemove(doc.key)}
                        />
                    </div>
                ))}
                {pendingDocs.map((doc) => (
                    <div key={doc.id} className="group relative">
                        <EditorTooltip label={doc.fileName}>
                            <div>
                                <AttachmentTile
                                    fileName={doc.fileName}
                                    status={doc.status}
                                    progress={doc.progress}
                                    error={doc.error}
                                    className="w-auto min-w-[5rem]"
                                    nativeTitle={false}
                                />
                            </div>
                        </EditorTooltip>
                        <KnowledgeTileAction
                            label={
                                doc.status === "error" ? "Remove failed upload" : "Cancel upload"
                            }
                            onClick={() => onCancelPending(doc.id)}
                        />
                    </div>
                ))}
                {remaining > 0 && (
                    <AttachmentTile
                        fileName="Add document"
                        icon={<Plus className="size-4" />}
                        detail={docs.length + pendingDocs.length === 0 ? ".md or .txt" : undefined}
                        onClick={() => docsInputRef.current?.click()}
                        className="w-auto min-w-[5rem] border-dashed bg-transparent text-muted-foreground hover:text-foreground has-[:focus-visible]:border-ring"
                        nativeTitle={false}
                    />
                )}
            </div>
        </section>
    )
}

// Names reach Markdown and markup, so keep only characters that cannot open syntax.
const previewName = (name: string) => name.replace(/[<>"*_`~[\]\\]/g, "").trim()

// A user turn, then one reply written both ways: the prose a Persona writes by default,
// and the same beats in roleplay markup, rendered by the chat's own renderer.
const PREVIEW_USER_MESSAGE =
    "*I duck in out of the rain and grab a booth by the window.* Sorry, the roads flooded."
// Supporting characters take portraits from the caller, as in chat; this one is a stand-in.
const PREVIEW_AVATARS = { barkeep: "/avatars/renji.webp" }

function RoleplayFormatPreview({ form }: { form: PersonaFormState }) {
    const name = previewName(form.name) || "Persona"
    const shortName = previewName(form.shortName) || name
    const persona = useMemo(
        () => ({
            name,
            avatarKind: form.avatar ? ("r2" as const) : undefined,
            avatarValue: form.avatar?.key
        }),
        [name, form.avatar]
    )
    const content = form.roleplayFormat
        ? `<roleplay>
<narration>Rain drums against the tavern windows.</narration>
<character id="persona" name="${name}">
<move via="foot">${shortName} shoulders through the crowd to an ornate booth.</move>
<thought>Ughhh! He's always late!</thought>
<dialogue>You kept me waiting.</dialogue>
</character>
<character id="barkeep" name="Barkeep">
<action>The barkeep sets down a polished glass and reaches for a dusty bottle.</action>
<dialogue>The usual, then?</dialogue>
</character>
</roleplay>`
        : `Rain drums against the tavern windows. *${shortName} shoulders through the crowd to an ornate booth.* *Ughhh! He's always late!* "You kept me waiting."

*The barkeep sets down a polished glass and reaches for a dusty bottle.* "The usual, then?"`

    return (
        <section
            aria-label="Preview"
            className="mt-4 overflow-hidden rounded-[var(--radius-lg)] border bg-background/60"
        >
            <p className="px-4 pt-3 text-muted-foreground text-xs">Preview</p>
            <div className={cn(USER_MESSAGE_BUBBLE_CLASS, "mx-4 mt-2 mb-0 text-sm")}>
                <MemoizedMarkdown content={PREVIEW_USER_MESSAGE} />
            </div>
            <motion.div layout transition={{ duration: 0.25, ease: [0.16, 1, 0.3, 1] }}>
                <AnimatePresence mode="wait" initial={false}>
                    <motion.div
                        key={form.roleplayFormat ? "rich" : "prose"}
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        transition={{ duration: 0.15 }}
                        className="px-4 pt-6 pb-4"
                    >
                        <RoleplayPersonaProvider value={persona}>
                            <MemoizedMarkdown content={content} roleplayAvatars={PREVIEW_AVATARS} />
                        </RoleplayPersonaProvider>
                    </motion.div>
                </AnimatePresence>
            </motion.div>
        </section>
    )
}

function PersonaEditorForm({
    form,
    setForm,
    hasPersonaModels,
    avatarInputRef,
    docsInputRef,
    pendingDocs,
    onCancelPendingDoc,
    onAvatarUpload,
    onKnowledgeDocsUpload
}: {
    form: PersonaFormState
    setForm: Dispatch<SetStateAction<PersonaFormState>>
    hasPersonaModels: boolean
    avatarInputRef: RefObject<HTMLInputElement | null>
    docsInputRef: RefObject<HTMLInputElement | null>
    pendingDocs: PendingPersonaDoc[]
    onCancelPendingDoc: (id: string) => void
    onAvatarUpload: (file?: File) => Promise<void>
    onKnowledgeDocsUpload: (files: FileList | File[] | null) => Promise<void>
}) {
    // The last removed avatar, restorable from the badge until a new one is set. The
    // editor unmounts on close, so it never outlives this editing session.
    const [removedAvatar, setRemovedAvatar] = useState<PersonaAvatarUpload | null>(null)
    const canRestoreAvatar = Boolean(removedAvatar) && !form.avatar

    return (
        <div className="space-y-8">
            <div className="flex justify-center">
                {/* The corner badge carries the avatar's secondary action: remove once
                    set, undo right after removing, upload when empty. The picture itself
                    always uploads. Remove and undo are siblings, not nested, buttons. */}
                <div className="relative shrink-0">
                    <button
                        type="button"
                        onClick={() => avatarInputRef.current?.click()}
                        className="relative inline-flex size-20 items-center justify-center rounded-full border bg-background transition-colors hover:bg-muted/50"
                        aria-label={
                            form.avatar ? "Replace persona avatar" : "Upload persona avatar"
                        }
                    >
                        <PersonaAvatar
                            name={form.name || "Persona"}
                            avatarKind={form.avatar ? "r2" : undefined}
                            avatarValue={form.avatar?.key}
                            className="size-full [&_[data-slot=avatar-fallback]]:text-xl"
                            rounded="full"
                        />
                        {!form.avatar && !canRestoreAvatar && (
                            <span className="absolute right-0.5 bottom-0.5 flex size-6 items-center justify-center rounded-full border bg-background text-muted-foreground">
                                <Upload className="size-3.5" />
                            </span>
                        )}
                    </button>
                    {form.avatar && (
                        <EditorTooltip label="Remove avatar" side="right">
                            <button
                                type="button"
                                aria-label="Remove persona avatar"
                                onClick={() => {
                                    // A draft edit, so an undo beats a confirmation.
                                    setRemovedAvatar(form.avatar)
                                    setForm((current) => ({ ...current, avatar: null }))
                                }}
                                className="absolute right-0.5 bottom-0.5 flex size-6 items-center justify-center rounded-full border bg-background text-destructive transition-colors hover:border-destructive hover:bg-destructive hover:text-destructive-foreground"
                            >
                                <Trash2 className="size-3.5" />
                            </button>
                        </EditorTooltip>
                    )}
                    {canRestoreAvatar && (
                        <EditorTooltip label="Undo remove" side="right">
                            <button
                                type="button"
                                aria-label="Restore removed avatar"
                                onClick={() => {
                                    setForm((current) => ({
                                        ...current,
                                        avatar: removedAvatar
                                    }))
                                    setRemovedAvatar(null)
                                }}
                                className="absolute right-0.5 bottom-0.5 flex size-6 items-center justify-center rounded-full border bg-background text-foreground transition-colors hover:bg-muted"
                            >
                                <Undo2 className="size-3.5" />
                            </button>
                        </EditorTooltip>
                    )}
                </div>
                <input
                    ref={avatarInputRef}
                    type="file"
                    accept=".avif,.webp,.jpg,.jpeg,.png,image/avif,image/webp,image/jpeg,image/png"
                    className="hidden"
                    onChange={(event) => {
                        void onAvatarUpload(event.target.files?.[0])
                        event.target.value = ""
                    }}
                />
            </div>

            <div className="space-y-3">
                <Label htmlFor="persona-name">Name</Label>
                <Input
                    id="persona-name"
                    value={form.name}
                    onChange={(event) =>
                        setForm((current) => ({
                            ...current,
                            name: event.target.value
                        }))
                    }
                    maxLength={80}
                    placeholder="Senior systems architect"
                />
            </div>

            <div className="space-y-3">
                <Label htmlFor="persona-short-name">Short Name</Label>
                <Input
                    id="persona-short-name"
                    value={form.shortName}
                    onChange={(event) =>
                        setForm((current) => ({
                            ...current,
                            shortName: event.target.value
                        }))
                    }
                    maxLength={10}
                    placeholder="Pep"
                />
            </div>

            <div className="space-y-3">
                <Label htmlFor="persona-description">Description</Label>
                <Textarea
                    id="persona-description"
                    value={form.description}
                    onChange={(event) =>
                        setForm((current) => ({
                            ...current,
                            description: event.target.value
                        }))
                    }
                    rows={3}
                    maxLength={240}
                    placeholder="Direct, technical guidance for architecture and tradeoff reviews."
                    className={PERSONA_DESCRIPTION_TEXTAREA_CLASS}
                />
            </div>

            <div className="space-y-3">
                <Label htmlFor="persona-instructions">Instructions</Label>
                <Textarea
                    id="persona-instructions"
                    value={form.instructions}
                    onChange={(event) =>
                        setForm((current) => ({
                            ...current,
                            instructions: event.target.value
                        }))
                    }
                    rows={10}
                    placeholder="Describe how this persona should respond, reason, and structure answers."
                    className={PERSONA_INSTRUCTIONS_TEXTAREA_CLASS}
                />
            </div>

            <div id="persona-default-model" className="space-y-3">
                <div className="flex items-center justify-between gap-3">
                    <Label>Default Model</Label>
                    {!hasPersonaModels && (
                        <span className="text-destructive text-xs">No compatible text models</span>
                    )}
                </div>
                {hasPersonaModels ? (
                    <ModelSelector
                        selectedModel={form.defaultModelId}
                        onModelChange={(value) =>
                            setForm((current) => ({
                                ...current,
                                defaultModelId: value
                            }))
                        }
                        telemetrySurface="persona_settings"
                        className="h-10 w-full justify-between border bg-background px-3 text-sm hover:bg-background"
                        triggerWrapperClassName="w-full"
                        contentClassName="z-[80]"
                        preferShortName={false}
                    />
                ) : (
                    <div className="rounded-lg border border-dashed px-3 py-2 text-muted-foreground text-sm">
                        Add a text chat model in Settings before assigning a persona default.
                    </div>
                )}
            </div>

            <div id="persona-openings" className="space-y-3">
                <Label>Persona Openings</Label>
                <PromptList
                    items={form.openings}
                    onChange={(openings) => setForm((current) => ({ ...current, openings }))}
                    minSlots={1}
                    max={MAX_PERSONA_OPENINGS}
                    maxLength={MAX_PERSONA_OPENING_LENGTH}
                    itemLabel="Persona opening"
                    placeholder="Have the persona speak first. New chats pick one at random."
                    addLabel="Add a persona opening"
                />
            </div>

            <div id="persona-conversation-starters" className="space-y-3">
                <Label>Conversation Starters</Label>
                <PromptList
                    items={form.conversationStarters}
                    onChange={(conversationStarters) =>
                        setForm((current) => ({ ...current, conversationStarters }))
                    }
                    minSlots={MIN_PERSONA_STARTERS}
                    max={MAX_PERSONA_STARTERS}
                    maxLength={160}
                    itemLabel="Conversation starter"
                    placeholder="Kick off the conversation with a suggested prompt."
                    addLabel="Add a conversation starter"
                />
            </div>

            <KnowledgeBaseFiles
                docs={form.knowledgeDocs}
                pendingDocs={pendingDocs}
                onCancelPending={onCancelPendingDoc}
                docsInputRef={docsInputRef}
                onUpload={onKnowledgeDocsUpload}
                onRemove={(key) =>
                    setForm((current) => ({
                        ...current,
                        knowledgeDocs: current.knowledgeDocs.filter(
                            (candidate) => candidate.key !== key
                        )
                    }))
                }
            />

            <Card className="p-4">
                <div className="flex items-start justify-between gap-4">
                    <div className="space-y-1.5">
                        <Label htmlFor="persona-roleplay-format" className="text-base">
                            Rich Roleplay Format
                        </Label>
                        <p
                            id="persona-roleplay-format-description"
                            className="text-muted-foreground text-sm"
                        >
                            Replace text-heavy RP with speech bubbles, profile pictures, action and
                            thought icons, and more. Ideal for RP scenarios with multiple characters
                            or complex settings.
                        </p>
                    </div>
                    <Switch
                        id="persona-roleplay-format"
                        checked={form.roleplayFormat}
                        onCheckedChange={(checked) =>
                            setForm((current) => ({ ...current, roleplayFormat: checked }))
                        }
                        aria-describedby="persona-roleplay-format-description"
                    />
                </div>
                <RoleplayFormatPreview form={form} />
            </Card>
        </div>
    )
}

function PersonaEditor({
    open,
    onOpenChange,
    form,
    setForm,
    personaPromptUsage,
    saveIssue,
    hasPersonaModels,
    avatarInputRef,
    docsInputRef,
    pendingDocs,
    onCancelPendingDoc,
    isSaving,
    isDeleting,
    onAvatarUpload,
    onKnowledgeDocsUpload,
    onDelete,
    onSave
}: {
    open: boolean
    onOpenChange: (open: boolean) => void
    form: PersonaFormState
    setForm: Dispatch<SetStateAction<PersonaFormState>>
    personaPromptUsage: number
    saveIssue?: PersonaSaveIssue
    hasPersonaModels: boolean
    avatarInputRef: RefObject<HTMLInputElement | null>
    docsInputRef: RefObject<HTMLInputElement | null>
    pendingDocs: PendingPersonaDoc[]
    onCancelPendingDoc: (id: string) => void
    isSaving: boolean
    isDeleting: boolean
    onAvatarUpload: (file?: File) => Promise<void>
    onKnowledgeDocsUpload: (files: FileList | File[] | null) => Promise<void>
    onDelete: () => Promise<void>
    onSave: () => Promise<void>
}) {
    const isMobile = useIsMobile()
    const canSave = !saveIssue
    const IssueIcon = saveIssue ? SAVE_ISSUE_ICON[saveIssue.tone] : undefined
    // Deleting takes a second, deliberate click; the confirmation lapses on its own.
    const [confirmingDelete, setConfirmingDelete] = useState(false)
    useEffect(() => {
        if (!confirmingDelete) return
        const timeoutId = window.setTimeout(() => setConfirmingDelete(false), 4000)
        return () => window.clearTimeout(timeoutId)
    }, [confirmingDelete])
    useEffect(() => {
        if (!open) setConfirmingDelete(false)
    }, [open])
    const title = form.personaId ? "Edit Persona" : "Create Persona"
    const description = form.personaId
        ? "Update this persona. Existing threads are not affected."
        : "Create a Persona to chat with at any time."
    const footerActions = (
        <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            {form.personaId ? (
                <Button
                    variant={confirmingDelete ? "destructive" : "outline"}
                    className={cn(!confirmingDelete && "text-destructive hover:text-destructive")}
                    onClick={() => (confirmingDelete ? void onDelete() : setConfirmingDelete(true))}
                    disabled={isDeleting || isSaving}
                >
                    {isDeleting ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                        <Trash2 className="h-4 w-4" />
                    )}
                    {confirmingDelete ? "Confirm Delete" : "Delete"}
                </Button>
            ) : (
                <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isSaving}>
                    Cancel
                </Button>
            )}
            {isMobile && form.personaId && (
                <DrawerClose asChild>
                    <Button variant="outline" disabled={isSaving || isDeleting}>
                        Cancel
                    </Button>
                </DrawerClose>
            )}
            {!isMobile && form.personaId && (
                <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isSaving}>
                    Cancel
                </Button>
            )}
            <Button onClick={() => void onSave()} disabled={!canSave || isSaving || isDeleting}>
                {isSaving ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                    <Save className="h-4 w-4" />
                )}
                {form.personaId ? "Save Changes" : "Create Persona"}
            </Button>
        </div>
    )
    const footer = (
        <div className="flex w-full flex-col gap-3">
            <div className="flex items-center gap-3">
                <div
                    role="status"
                    className="flex min-w-0 flex-1 items-center text-muted-foreground text-sm"
                >
                    {saveIssue && IssueIcon && (
                        <button
                            type="button"
                            onClick={() => revealSaveIssue(saveIssue)}
                            className="flex min-w-0 items-center gap-2 text-left transition-colors hover:text-foreground"
                        >
                            <IssueIcon
                                className={cn("size-4 shrink-0", SAVE_TONE_TEXT[saveIssue.tone])}
                                aria-hidden="true"
                            />
                            <span className="truncate">{saveIssue.message}</span>
                            {Boolean(saveIssue.remaining) && (
                                <span className="shrink-0 text-muted-foreground/70 tabular-nums">
                                    +{saveIssue.remaining} more
                                </span>
                            )}
                        </button>
                    )}
                </div>
                <PersonaTokenRing used={personaPromptUsage} max={MAX_PERSONA_PROMPT_TOKENS} />
            </div>
            {footerActions}
        </div>
    )

    if (isMobile) {
        return (
            <Drawer open={open} onOpenChange={onOpenChange} repositionInputs={false}>
                <DrawerContent
                    className="z-[70] flex h-[92dvh] max-h-[92dvh] flex-col gap-0 overflow-hidden border-border/60 bg-background p-0"
                    overlayClassName="z-[70]"
                >
                    <DrawerHeader className="shrink-0 text-left">
                        <DrawerTitle>{title}</DrawerTitle>
                        <DrawerDescription>{description}</DrawerDescription>
                    </DrawerHeader>
                    <div className="min-h-0 flex-1 overflow-y-auto px-4 pb-6">
                        <PersonaEditorForm
                            form={form}
                            setForm={setForm}
                            hasPersonaModels={hasPersonaModels}
                            avatarInputRef={avatarInputRef}
                            docsInputRef={docsInputRef}
                            pendingDocs={pendingDocs}
                            onCancelPendingDoc={onCancelPendingDoc}
                            onAvatarUpload={onAvatarUpload}
                            onKnowledgeDocsUpload={onKnowledgeDocsUpload}
                        />
                    </div>
                    <DrawerFooter className="shrink-0 border-t px-4 pb-[calc(env(safe-area-inset-bottom)+1rem)]">
                        {footer}
                    </DrawerFooter>
                </DrawerContent>
            </Drawer>
        )
    }

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="flex max-h-[90dvh] max-w-3xl flex-col gap-0 overflow-hidden p-0">
                <DialogHeader className="border-b px-6 pt-6 pb-4">
                    <DialogTitle>{title}</DialogTitle>
                    <DialogDescription>{description}</DialogDescription>
                </DialogHeader>
                <div className="min-h-0 flex-1 overflow-y-auto px-6 py-6">
                    <PersonaEditorForm
                        form={form}
                        setForm={setForm}
                        hasPersonaModels={hasPersonaModels}
                        avatarInputRef={avatarInputRef}
                        docsInputRef={docsInputRef}
                        pendingDocs={pendingDocs}
                        onCancelPendingDoc={onCancelPendingDoc}
                        onAvatarUpload={onAvatarUpload}
                        onKnowledgeDocsUpload={onKnowledgeDocsUpload}
                    />
                </div>
                <DialogFooter className="border-t px-6 py-4">{footer}</DialogFooter>
            </DialogContent>
        </Dialog>
    )
}

function PersonasSettings() {
    const session = useSession()
    const auth = useConvexAuth()
    const { token } = useToken()
    const builtIns = useConvexQuery(
        api.personas.listBuiltInPersonas,
        session.user?.id ? {} : "skip"
    )
    const userPersonas = useConvexQuery(
        api.personas.listUserPersonas,
        session.user?.id ? {} : "skip"
    )
    const userSettings = useCurrentUserSettings(session.user?.id, auth.isLoading)
    const createPersona = useConvexMutation(api.personas.createUserPersona)
    const updatePersona = useConvexMutation(api.personas.updateUserPersona)
    const deletePersona = useConvexMutation(api.personas.deleteUserPersona)
    const { availableModels } = useAvailableModels(
        "error" in userSettings ? undefined : userSettings
    )
    const { models: sharedModels } = useSharedModels()

    const personaModels = useMemo(
        () => availableModels.filter((model) => isChatModel(model)),
        [availableModels]
    )

    const resolveModelName = useMemo(() => {
        const namesById = new Map<string, string>()
        for (const model of sharedModels) namesById.set(model.id, model.name)
        for (const model of availableModels) namesById.set(model.id, model.name)
        return (modelId: string) => namesById.get(modelId) ?? modelId
    }, [sharedModels, availableModels])

    const [form, setForm] = useState<PersonaFormState>(EMPTY_FORM)
    const [isEditorOpen, setIsEditorOpen] = useState(false)
    const [isSaving, setIsSaving] = useState(false)
    const [isDeleting, setIsDeleting] = useState(false)
    const [pendingDocs, setPendingDocs] = useState<PendingPersonaDoc[]>([])
    const [isUploadingAvatar, setIsUploadingAvatar] = useState(false)
    const [avatarCropState, setAvatarCropState] = useState<AvatarCropState | null>(null)
    const avatarInputRef = useRef<HTMLInputElement>(null)
    const docsInputRef = useRef<HTMLInputElement>(null)

    const resetForm = () =>
        setForm({
            ...EMPTY_FORM,
            defaultModelId: personaModels[0]?.id || ""
        })

    useEffect(() => {
        if (!form.defaultModelId && personaModels.length > 0) {
            setForm((current) => ({
                ...current,
                defaultModelId: personaModels[0].id
            }))
        }
    }, [form.defaultModelId, personaModels])

    useEffect(() => {
        if (
            !form.defaultModelId ||
            personaModels.some((model) => model.id === form.defaultModelId)
        ) {
            return
        }

        const replacement = resolveAvailableModelReplacement({
            modelId: form.defaultModelId,
            sharedModels,
            availableModels: personaModels
        })

        if (!replacement.replacementId || !replacement.replacement) return

        setForm((current) =>
            current.defaultModelId === form.defaultModelId
                ? {
                      ...current,
                      defaultModelId: replacement.replacementId!
                  }
                : current
        )

        if (replacement.originalModel) {
            notifyModelReplacement(replacement.originalModel, replacement.replacement)
        }
    }, [form.defaultModelId, personaModels, sharedModels])

    const personaPromptUsage = useMemo(() => estimatePromptUsage(form), [form])
    const [debouncedPersonaPromptUsage, setDebouncedPersonaPromptUsage] =
        useState(personaPromptUsage)

    useEffect(() => {
        const timeoutId = window.setTimeout(() => {
            setDebouncedPersonaPromptUsage(personaPromptUsage)
        }, 150)

        return () => window.clearTimeout(timeoutId)
    }, [personaPromptUsage])

    const normalizedStarterCount = useMemo(
        () => normalizeStarterList(form.conversationStarters).length,
        [form.conversationStarters]
    )
    const saveIssue = getPersonaSaveIssue(form, {
        starterCount: normalizedStarterCount,
        promptUsage: personaPromptUsage,
        hasValidModel: personaModels.some((model) => model.id === form.defaultModelId),
        uploadingDocs: pendingDocs.filter((doc) => doc.status !== "error").length
    })
    const canSave = !saveIssue

    const handleEditorOpenChange = (open: boolean) => {
        setIsEditorOpen(open)
        if (!open) {
            setAvatarCropState(null)
            // In-flight documents belong to this draft, so they must not land in the next one.
            for (const doc of pendingDocs) doc.abortController.abort()
            setPendingDocs([])
            resetForm()
        }
    }

    const openCreatePersona = () => {
        resetForm()
        setIsEditorOpen(true)
    }

    const openEditPersona = (persona: UserPersonaRecord) => {
        setForm(buildFormFromPersona(persona))
        setIsEditorOpen(true)
    }

    const openDuplicatePersona = (persona: UserPersonaRecord) => {
        setForm(buildFormFromPersona(persona, true))
        setIsEditorOpen(true)
    }

    const handleAvatarCropOpenChange = (open: boolean) => {
        if (!open && !isUploadingAvatar) {
            setAvatarCropState(null)
        }
    }

    const uploadPersonaFile = async (
        purpose: "persona-avatar" | "persona-doc",
        file: File,
        options: { onProgress?: (progress: number) => void; signal?: AbortSignal } = {}
    ) => {
        const jwt = await resolveJwtToken(token)
        if (!jwt) {
            throw new Error("Authentication token unavailable")
        }

        return uploadFileDirect({
            file,
            jwt,
            uploadBaseUrl: `${browserEnv("VITE_CONVEX_API_URL")}/upload`,
            purpose,
            ...options
        })
    }

    const handleAvatarUpload = async (file?: File) => {
        if (!file) return

        try {
            const src = await readFileAsDataUrl(file)
            setAvatarCropState({
                src,
                fileName: file.name
            })
        } catch (error) {
            toast.error(error instanceof Error ? error.message : "Avatar upload failed")
        }
    }

    const handleAvatarCropConfirm = async (croppedAreaPixels: Area) => {
        if (!avatarCropState) return

        setIsUploadingAvatar(true)
        try {
            const cropped = await cropAvatarToSquare({
                src: avatarCropState.src,
                croppedAreaPixels,
                fileName: avatarCropState.fileName
            })
            const compressed = await compressAvatar(cropped)
            const uploaded = (await uploadPersonaFile(
                "persona-avatar",
                compressed
            )) as PersonaAvatarUpload
            setForm((current) => ({
                ...current,
                avatar: uploaded
            }))
            setAvatarCropState(null)
        } catch (error) {
            toast.error(error instanceof Error ? error.message : "Avatar upload failed")
        } finally {
            setIsUploadingAvatar(false)
        }
    }

    const handleKnowledgeDocsUpload = async (files: FileList | File[] | null) => {
        if (!files) return

        const remainingSlots =
            MAX_PERSONA_KNOWLEDGE_DOCS - form.knowledgeDocs.length - pendingDocs.length
        if (remainingSlots <= 0) {
            toast.warning(`Personas can only include ${MAX_PERSONA_KNOWLEDGE_DOCS} docs.`)
            return
        }

        const filesToUpload = Array.from(files).slice(0, remainingSlots)
        if (files.length > remainingSlots) {
            toast.warning(`Only the first ${remainingSlots} document(s) were added.`)
        }

        const newPendingDocs = filesToUpload.map<PendingPersonaDoc>((file) => ({
            id: crypto.randomUUID(),
            fileName: file.name,
            startedAt: Date.now(),
            progress: 0,
            status: "uploading",
            abortController: new AbortController()
        }))
        setPendingDocs((current) => [...current, ...newPendingDocs])

        const updatePendingDoc = (id: string, patch: Partial<PendingPersonaDoc>) =>
            setPendingDocs((current) =>
                current.map((doc) => (doc.id === id ? { ...doc, ...patch } : doc))
            )

        // Each document settles on its own, with the composer's upload beats.
        await Promise.all(
            newPendingDocs.map(async (pending, index) => {
                const file = filesToUpload[index]
                const { signal } = pending.abortController
                try {
                    const tokenCount = estimateTokenCount(await file.text())
                    if (tokenCount > MAX_PERSONA_PROMPT_TOKENS) {
                        throw new Error(
                            `Knowledge document exceeds ${MAX_PERSONA_PROMPT_TOKENS.toLocaleString()} token limit`
                        )
                    }
                    const uploaded = await uploadPersonaFile("persona-doc", file, {
                        onProgress: (progress) => updatePendingDoc(pending.id, { progress }),
                        signal
                    })

                    await wait(Math.max(0, 500 - (Date.now() - pending.startedAt)))
                    updatePendingDoc(pending.id, { progress: 100, status: "success" })
                    await wait(500)
                    updatePendingDoc(pending.id, { status: "ready" })
                    await wait(200)
                    if (signal.aborted) return

                    setForm((current) => ({
                        ...current,
                        knowledgeDocs: [
                            ...current.knowledgeDocs,
                            { ...uploaded, fileType: "text/markdown", tokenCount }
                        ]
                    }))
                    setPendingDocs((current) => current.filter((doc) => doc.id !== pending.id))
                } catch (error) {
                    if (signal.aborted) return
                    const message = error instanceof Error ? error.message : "Upload failed"
                    toast.error(message)
                    updatePendingDoc(pending.id, { status: "error", error: message })
                }
            })
        )
    }

    const handleCancelPendingDoc = (id: string) => {
        pendingDocs.find((doc) => doc.id === id)?.abortController.abort()
        setPendingDocs((current) => current.filter((doc) => doc.id !== id))
    }

    const handleSave = async () => {
        if (!session.user?.id || !canSave) return

        setIsSaving(true)
        try {
            const payload = {
                name: form.name,
                shortName: form.shortName,
                description: form.description,
                instructions: form.instructions,
                conversationStarters: normalizeStarterList(form.conversationStarters),
                openings: normalizeStarterList(form.openings),
                defaultModelId: form.defaultModelId,
                roleplayFormat: form.roleplayFormat,
                avatar: form.avatar
                    ? {
                          key: form.avatar.key,
                          mimeType: form.avatar.fileType,
                          sizeBytes: form.avatar.fileSize
                      }
                    : null,
                knowledgeDocs: form.knowledgeDocs.map((doc) => ({
                    key: doc.key,
                    fileName: doc.fileName,
                    mimeType: "text/markdown" as const,
                    sizeBytes: doc.fileSize
                }))
            }

            if (form.personaId) {
                await updatePersona({
                    personaId: form.personaId,
                    ...payload
                })
                toast.success("Persona updated")
            } else {
                await createPersona(payload)
                toast.success("Persona created")
            }

            handleEditorOpenChange(false)
        } catch (error) {
            toast.error(error instanceof Error ? error.message : "Failed to save persona")
        } finally {
            setIsSaving(false)
        }
    }

    const handleDelete = async () => {
        if (!form.personaId) return

        setIsDeleting(true)
        try {
            await deletePersona({ personaId: form.personaId })
            toast.success("Persona deleted")
            handleEditorOpenChange(false)
        } catch (error) {
            toast.error(error instanceof Error ? error.message : "Failed to delete persona")
        } finally {
            setIsDeleting(false)
        }
    }

    if (!session.user?.id) {
        return (
            <SettingsLayout title="Personas" description="Create reusable prompt personas">
                <p className="text-muted-foreground text-sm">Sign in to manage personas.</p>
            </SettingsLayout>
        )
    }

    if (!builtIns || !userPersonas) {
        return (
            <SettingsLayout title="Personas" description="Create reusable prompt personas">
                <div className="flex items-center justify-center p-8">
                    <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                </div>
            </SettingsLayout>
        )
    }

    return (
        <SettingsLayout title="Personas" description="Create reusable prompt personas">
            <div className="space-y-8">
                <div className="space-y-4">
                    <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                        <div>
                            <h3 className="font-semibold text-foreground">Your Personas</h3>
                            <p className="mt-1 text-muted-foreground text-sm">
                                Create, duplicate, and edit your own personas and experts.
                            </p>
                        </div>
                        <Button onClick={openCreatePersona}>
                            <Plus className="h-4 w-4" />
                            New Persona
                        </Button>
                    </div>
                    {userPersonas.length === 0 ? (
                        <Card className="p-5">
                            <div>
                                <h4 className="font-medium">No custom personas yet</h4>
                                <p className="mt-1 text-muted-foreground text-sm">
                                    Start from scratch and add your own instructions, starters, and
                                    knowledge docs.
                                </p>
                            </div>
                        </Card>
                    ) : (
                        <div className="space-y-3">
                            {userPersonas.map((persona) => (
                                <Card
                                    key={persona._id}
                                    className="min-w-0 gap-4 rounded-[var(--radius-xl)] p-4 shadow-none"
                                >
                                    <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
                                        <div className="flex min-w-0 flex-1 items-start gap-3">
                                            <PersonaAvatar
                                                name={persona.name}
                                                avatarKind={persona.avatarKey ? "r2" : undefined}
                                                avatarValue={persona.avatarKey}
                                                className="size-10 shrink-0 [&_[data-slot=avatar-fallback]]:text-sm"
                                            />
                                            <div className="min-w-0">
                                                <h4 className="font-medium [overflow-wrap:anywhere]">
                                                    {persona.name}
                                                </h4>
                                                <p className="mt-1 text-muted-foreground text-sm leading-relaxed [overflow-wrap:anywhere]">
                                                    {persona.description}
                                                </p>
                                                <div className="mt-2 flex flex-wrap gap-2">
                                                    <Badge
                                                        variant="secondary"
                                                        className="max-w-full whitespace-normal rounded-[var(--radius-md)] text-left [overflow-wrap:anywhere]"
                                                    >
                                                        {resolveModelName(persona.defaultModelId)}
                                                    </Badge>
                                                    {persona.knowledgeDocs.length > 0 && (
                                                        <Badge
                                                            variant="outline"
                                                            className="rounded-[var(--radius-md)]"
                                                        >
                                                            {persona.knowledgeDocs.length} doc
                                                            {persona.knowledgeDocs.length === 1
                                                                ? ""
                                                                : "s"}
                                                        </Badge>
                                                    )}
                                                </div>
                                            </div>
                                        </div>
                                        <div className="flex shrink-0 items-center gap-2 self-end md:self-center">
                                            <Button
                                                variant="outline"
                                                size="sm"
                                                className="h-9 rounded-[var(--radius-md)]"
                                                aria-label={`Edit ${persona.name}`}
                                                onClick={() => openEditPersona(persona)}
                                            >
                                                <Pencil className="h-4 w-4" />
                                                Edit
                                            </Button>
                                            <Button
                                                variant="ghost"
                                                size="sm"
                                                className="h-9 rounded-[var(--radius-md)]"
                                                aria-label={`Duplicate ${persona.name}`}
                                                onClick={() => openDuplicatePersona(persona)}
                                            >
                                                <Copy className="h-4 w-4" />
                                                Duplicate
                                            </Button>
                                        </div>
                                    </div>
                                </Card>
                            ))}
                        </div>
                    )}
                </div>

                <div className="space-y-4">
                    <div>
                        <h3 className="font-semibold text-foreground">Built-in Personas</h3>
                        <p className="mt-1 text-muted-foreground text-sm">
                            Ready-to-use personas available in the chat persona selector.
                        </p>
                    </div>
                    <div className="grid gap-4 md:grid-cols-2">
                        {builtIns.map((persona) => (
                            <Card
                                key={persona.id}
                                className="min-w-0 gap-3 rounded-[var(--radius-xl)] p-4 shadow-none"
                            >
                                <div className="flex items-center gap-3">
                                    <PersonaAvatar
                                        name={persona.name}
                                        avatarKind={persona.avatarKind}
                                        avatarValue={persona.avatarValue}
                                        className="size-10 shrink-0 [&_[data-slot=avatar-fallback]]:text-sm"
                                    />
                                    <h4 className="min-w-0 font-medium [overflow-wrap:anywhere]">
                                        {persona.name}
                                    </h4>
                                </div>
                                <p className="text-muted-foreground text-sm leading-relaxed [overflow-wrap:anywhere]">
                                    {persona.description}
                                </p>
                                <div className="mt-auto flex flex-wrap items-start gap-2 pt-1">
                                    <Badge
                                        variant="secondary"
                                        className="max-w-full whitespace-normal rounded-[var(--radius-md)] text-left [overflow-wrap:anywhere]"
                                    >
                                        {resolveModelName(persona.defaultModelId)}
                                    </Badge>
                                    {persona.docNames.map((docName) => (
                                        <Badge
                                            key={docName}
                                            variant="outline"
                                            className="max-w-full whitespace-normal rounded-[var(--radius-md)] text-left [overflow-wrap:anywhere]"
                                        >
                                            {docName}
                                        </Badge>
                                    ))}
                                </div>
                            </Card>
                        ))}
                    </div>
                </div>
            </div>

            <PersonaEditor
                open={isEditorOpen}
                onOpenChange={handleEditorOpenChange}
                form={form}
                setForm={setForm}
                personaPromptUsage={debouncedPersonaPromptUsage}
                saveIssue={saveIssue}
                hasPersonaModels={personaModels.length > 0}
                avatarInputRef={avatarInputRef}
                docsInputRef={docsInputRef}
                pendingDocs={pendingDocs}
                onCancelPendingDoc={handleCancelPendingDoc}
                isSaving={isSaving}
                isDeleting={isDeleting}
                onAvatarUpload={handleAvatarUpload}
                onKnowledgeDocsUpload={handleKnowledgeDocsUpload}
                onDelete={handleDelete}
                onSave={handleSave}
            />
            <AvatarCropper
                cropState={avatarCropState}
                open={Boolean(avatarCropState)}
                onOpenChange={handleAvatarCropOpenChange}
                onConfirm={handleAvatarCropConfirm}
                isSaving={isUploadingAvatar}
            />
        </SettingsLayout>
    )
}
import { useCurrentUserSettings } from "@/hooks/use-current-user-settings"
import { isChatModel } from "@/convex/lib/models"
