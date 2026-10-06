import { ACTION_LABELS } from "@/components/moderation/case-details"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue
} from "@/components/ui/select"
import { Textarea } from "@/components/ui/textarea"
import { api } from "@/convex/_generated/api"
import {
    DEFAULT_STRIKE_EXPIRY_DAYS,
    MODERATION_CATEGORIES,
    MODERATION_CONTENT_ACTION_MAX_LENGTH,
    MODERATION_NOTE_MAX_LENGTH,
    MODERATION_VIOLATION_MAX_LENGTH,
    type ModerationAction,
    getModerationCategory
} from "@/convex/lib/moderation"
import { useAction, useMutation } from "convex/react"
import { ConvexError } from "convex/values"
import { cn } from "@/lib/utils"
import {
    ArrowLeft,
    Ban,
    CheckCircle,
    Flag,
    Loader2,
    type LucideIcon,
    Mail,
    MessageSquareWarning,
    TimerOff
} from "lucide-react"
import { useState } from "react"
import { toast } from "sonner"

const STRIKE_EXPIRY_OPTIONS = ["30", "60", "90", "180", "365", "never"] as const
const SUSPENSION_OPTIONS = ["1", "3", "7", "14", "30", "90"] as const

// Severity drives the tile's meter, matching the bar previews on Appearance and Personalization.
const ACTION_OPTIONS: {
    value: ModerationAction
    icon: LucideIcon
    description: string
    severity: number
    tone: string
}[] = [
    {
        value: "warning",
        icon: MessageSquareWarning,
        description: "Email only.",
        severity: 1,
        tone: "bg-muted-foreground/60"
    },
    {
        value: "strike",
        icon: Flag,
        description: "Counts toward the limit.",
        severity: 2,
        tone: "bg-warning"
    },
    {
        value: "suspension",
        icon: TimerOff,
        description: "Blocks sign-in for a while.",
        severity: 3,
        tone: "bg-destructive"
    },
    {
        value: "ban",
        icon: Ban,
        description: "Permanent. Blocks re-sign-up.",
        severity: 4,
        tone: "bg-destructive"
    }
]

function ActionPicker({
    value,
    onChange,
    nextStrikeNumber,
    strikeLimit,
    unavailable
}: {
    value: ModerationAction
    onChange: (action: ModerationAction) => void
    nextStrikeNumber: number
    strikeLimit: number
    unavailable: Partial<Record<ModerationAction, string>>
}) {
    return (
        <div
            role="radiogroup"
            aria-label="Action"
            className="grid grid-cols-2 gap-2 sm:grid-cols-4 sm:gap-3"
        >
            {ACTION_OPTIONS.map((option) => {
                const isSelected = value === option.value
                const reason = unavailable[option.value]
                const Icon = option.icon
                return (
                    <label
                        key={option.value}
                        className={cn(
                            "flex flex-col rounded-[var(--radius-xl)] border-0 bg-muted/20 p-3 transition-all duration-200 sm:p-4 [&:has(input:focus-visible)]:ring-2 [&:has(input:focus-visible)]:ring-ring",
                            reason
                                ? "cursor-not-allowed opacity-50"
                                : "cursor-pointer hover:bg-muted/40",
                            isSelected
                                ? "bg-primary/5 ring-1 ring-primary/20"
                                : !reason && "hover:ring-1 hover:ring-border"
                        )}
                    >
                        <input
                            type="radio"
                            name="moderation-action"
                            value={option.value}
                            checked={isSelected}
                            disabled={Boolean(reason)}
                            onChange={() => onChange(option.value)}
                            aria-describedby={`moderation-action-${option.value}-description`}
                            className="sr-only"
                        />
                        <div className="flex min-w-0 flex-1 flex-col gap-2">
                            <div className="flex items-center gap-2">
                                <div className="flex size-7 shrink-0 items-center justify-center rounded-full bg-background">
                                    <Icon className="size-3.5 text-foreground" aria-hidden="true" />
                                </div>
                                <span className="truncate font-medium text-foreground text-sm">
                                    {ACTION_LABELS[option.value]}
                                </span>
                                {isSelected && (
                                    <CheckCircle className="ml-auto size-4 shrink-0 text-primary" />
                                )}
                            </div>
                            <p
                                id={`moderation-action-${option.value}-description`}
                                className="text-muted-foreground text-xs leading-5"
                            >
                                {reason ??
                                    (option.value === "strike"
                                        ? `Strike ${nextStrikeNumber} of ${strikeLimit}.`
                                        : option.description)}
                            </p>
                            {/* Pinned to the bottom so description length never moves the meter. */}
                            <div className="mt-auto flex gap-1 pt-1" aria-hidden="true">
                                {ACTION_OPTIONS.map((step) => (
                                    <div
                                        key={step.value}
                                        className={cn(
                                            "h-1.5 flex-1 rounded-[var(--radius-sm)]",
                                            step.severity <= option.severity
                                                ? option.tone
                                                : "bg-muted"
                                        )}
                                    />
                                ))}
                            </div>
                        </div>
                    </label>
                )
            })}
        </div>
    )
}

const errorText = (error: unknown, fallback: string) =>
    error instanceof ConvexError && typeof error.data === "string" ? error.data : fallback

type Preview = { subject: string; html: string }

export function ModerationActionForm({
    authUserId,
    email,
    nextStrikeNumber,
    strikeLimit,
    restricted,
    onBack,
    onSent
}: {
    authUserId: string
    email: string
    nextStrikeNumber: number
    strikeLimit: number
    restricted: "suspended" | "banned" | null
    onBack: () => void
    onSent: () => void
}) {
    const issueAction = useMutation(api.moderation.issueModerationAction)
    const previewEmail = useAction(api.moderation_node.previewModerationEmail)
    const [action, setAction] = useState<ModerationAction>("warning")
    const [category, setCategory] = useState("")
    const [violation, setViolation] = useState("")
    const [contentAction, setContentAction] = useState("")
    const [internalNote, setInternalNote] = useState("")
    const [strikeExpiry, setStrikeExpiry] = useState<string>(String(DEFAULT_STRIKE_EXPIRY_DAYS))
    const [suspensionDays, setSuspensionDays] = useState<string>("7")
    const [preview, setPreview] = useState<Preview | null>(null)
    const [loadingPreview, setLoadingPreview] = useState(false)
    const [sending, setSending] = useState(false)
    const [banConfirmed, setBanConfirmed] = useState(false)

    const draft = {
        authUserId,
        action,
        category,
        violation,
        contentAction: contentAction || undefined,
        strikeExpiryDays:
            action === "strike"
                ? strikeExpiry === "never"
                    ? null
                    : Number(strikeExpiry)
                : undefined,
        suspensionDays: action === "suspension" ? Number(suspensionDays) : undefined
    }
    // Actions the server would refuse are greyed out rather than rejected on send.
    const unavailable: Partial<Record<ModerationAction, string>> = {
        ...(restricted ? { suspension: `Already ${restricted}.` } : {}),
        ...(restricted === "banned" ? { ban: "Already banned." } : {})
    }
    const canPreview = Boolean(category && violation.trim()) && !unavailable[action]

    const selectCategory = (next: string) => {
        // Replace the prefilled summary, but never overwrite text the operator wrote.
        const previousSummary = getModerationCategory(category)?.summary
        if (!violation.trim() || violation === previousSummary) {
            setViolation(getModerationCategory(next)?.summary ?? "")
        }
        setCategory(next)
    }

    const openPreview = async () => {
        if (!canPreview || loadingPreview) return
        setLoadingPreview(true)
        try {
            setPreview(await previewEmail(draft))
            setBanConfirmed(false)
        } catch (error) {
            toast.error(errorText(error, "Could not render the email preview."))
        } finally {
            setLoadingPreview(false)
        }
    }

    const send = async () => {
        if (sending) return
        setSending(true)
        try {
            const { caseId } = await issueAction({
                ...draft,
                internalNote: internalNote || undefined
            })
            toast.success(`${ACTION_LABELS[action]} sent · ${caseId}`)
            setPreview(null)
            onSent()
        } catch (error) {
            toast.error(errorText(error, "Could not issue this action."))
        } finally {
            setSending(false)
        }
    }

    const destructive = action === "suspension" || action === "ban"

    return (
        <div className="space-y-5">
            <div className="space-y-3">
                <ActionPicker
                    value={action}
                    onChange={setAction}
                    nextStrikeNumber={nextStrikeNumber}
                    strikeLimit={strikeLimit}
                    unavailable={unavailable}
                />
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                    <Label htmlFor="moderation-category">Reason</Label>
                    <Select value={category} onValueChange={selectCategory}>
                        <SelectTrigger id="moderation-category" className="w-full">
                            <SelectValue placeholder="Choose a reason" />
                        </SelectTrigger>
                        <SelectContent>
                            {MODERATION_CATEGORIES.map((option) => (
                                <SelectItem key={option.id} value={option.id}>
                                    {option.label}
                                </SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                </div>
                {action === "strike" && (
                    <div className="space-y-2">
                        <Label htmlFor="moderation-strike-expiry">Strike expires after</Label>
                        <Select value={strikeExpiry} onValueChange={setStrikeExpiry}>
                            <SelectTrigger id="moderation-strike-expiry" className="w-full">
                                <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                                {STRIKE_EXPIRY_OPTIONS.map((option) => (
                                    <SelectItem key={option} value={option}>
                                        {option === "never" ? "Never" : `${option} days`}
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </div>
                )}
                {action === "suspension" && (
                    <div className="space-y-2">
                        <Label htmlFor="moderation-suspension">Suspend for</Label>
                        <Select value={suspensionDays} onValueChange={setSuspensionDays}>
                            <SelectTrigger id="moderation-suspension" className="w-full">
                                <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                                {SUSPENSION_OPTIONS.map((option) => (
                                    <SelectItem key={option} value={option}>
                                        {option === "1" ? "1 day" : `${option} days`}
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </div>
                )}
            </div>

            <div className="space-y-2">
                <Label htmlFor="moderation-violation">Description</Label>
                <Textarea
                    id="moderation-violation"
                    value={violation}
                    maxLength={MODERATION_VIOLATION_MAX_LENGTH}
                    onChange={(event) => setViolation(event.target.value)}
                    className="max-h-48 min-h-20"
                />
            </div>

            <div className="space-y-2">
                <Label htmlFor="moderation-content-action">Action (optional)</Label>
                <Input
                    id="moderation-content-action"
                    value={contentAction}
                    maxLength={MODERATION_CONTENT_ACTION_MAX_LENGTH}
                    onChange={(event) => setContentAction(event.target.value)}
                    placeholder="e.g. Removed the shared thread"
                />
            </div>

            <div className="space-y-2">
                <Label htmlFor="moderation-note">Moderators' notes (optional)</Label>
                <Textarea
                    id="moderation-note"
                    value={internalNote}
                    maxLength={MODERATION_NOTE_MAX_LENGTH}
                    onChange={(event) => setInternalNote(event.target.value)}
                    className="max-h-48 min-h-16"
                />
            </div>

            <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-between">
                <Button variant="outline" onClick={onBack}>
                    <ArrowLeft className="size-4" /> Back
                </Button>
                <Button onClick={() => void openPreview()} disabled={!canPreview || loadingPreview}>
                    {loadingPreview ? (
                        <Loader2 className="size-4 animate-spin" />
                    ) : (
                        <Mail className="size-4" />
                    )}
                    Preview email
                </Button>
            </div>

            <Dialog
                open={Boolean(preview)}
                onOpenChange={(open) => !open && !sending && setPreview(null)}
            >
                <DialogContent className="max-h-[calc(100dvh-2rem)] overflow-y-auto rounded-[var(--radius-xl)] sm:max-w-2xl">
                    <DialogHeader>
                        <DialogTitle>{preview?.subject}</DialogTitle>
                        <DialogDescription>To {email}</DialogDescription>
                    </DialogHeader>
                    {preview && (
                        <iframe
                            title="Email preview"
                            srcDoc={preview.html}
                            sandbox=""
                            className="h-[28rem] w-full rounded-[var(--radius-lg)] border bg-white"
                        />
                    )}
                    {action === "ban" && (
                        <Label className="flex items-start gap-2 font-normal text-sm leading-5">
                            <Checkbox
                                checked={banConfirmed}
                                onCheckedChange={(checked) => setBanConfirmed(checked === true)}
                                className="mt-0.5"
                            />
                            Permanently ban {email}
                        </Label>
                    )}
                    <DialogFooter>
                        <Button
                            variant="outline"
                            onClick={() => setPreview(null)}
                            disabled={sending}
                        >
                            Back
                        </Button>
                        <Button
                            variant={destructive ? "destructive" : "default"}
                            onClick={() => void send()}
                            disabled={sending || (action === "ban" && !banConfirmed)}
                        >
                            {sending && <Loader2 className="size-4 animate-spin" />}
                            Send {ACTION_LABELS[action].toLowerCase()}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    )
}
