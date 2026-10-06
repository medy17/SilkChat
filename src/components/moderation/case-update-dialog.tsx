import { Button } from "@/components/ui/button"
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle
} from "@/components/ui/dialog"
import { Label } from "@/components/ui/label"
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue
} from "@/components/ui/select"
import { Textarea } from "@/components/ui/textarea"
import { MODERATION_NOTE_MAX_LENGTH } from "@/convex/lib/moderation"
import { ConvexError } from "convex/values"
import { Loader2 } from "lucide-react"
import { useEffect, useState } from "react"
import { toast } from "sonner"

// Every case change emails the user, so each one takes an optional note for that email.
export function CaseUpdateDialog({
    open,
    onOpenChange,
    label,
    title,
    description,
    durations,
    durationLabel,
    onConfirm
}: {
    open: boolean
    onOpenChange: (open: boolean) => void
    label: string
    title: string
    description?: string
    // Shorten only: whole days from now, already limited to ones before the current end.
    durations?: number[]
    durationLabel?: string
    onConfirm: (input: { note?: string; days?: number }) => Promise<unknown>
}) {
    const [note, setNote] = useState("")
    const [days, setDays] = useState("")
    const [busy, setBusy] = useState(false)
    const firstDuration = durations?.[0]

    useEffect(() => {
        if (!open) return
        setNote("")
        setDays(firstDuration ? String(firstDuration) : "")
    }, [open, firstDuration])

    const confirm = async () => {
        setBusy(true)
        try {
            await onConfirm({
                note: note.trim() || undefined,
                ...(durations ? { days: Number(days) } : {})
            })
            onOpenChange(false)
        } catch (error) {
            toast.error(
                error instanceof ConvexError && typeof error.data === "string"
                    ? error.data
                    : "That didn't work. Try again."
            )
        } finally {
            setBusy(false)
        }
    }

    return (
        <Dialog open={open} onOpenChange={(next) => !busy && onOpenChange(next)}>
            <DialogContent className="rounded-[var(--radius-xl)]">
                <DialogHeader>
                    <DialogTitle>{title}</DialogTitle>
                    {description ? <DialogDescription>{description}</DialogDescription> : null}
                </DialogHeader>
                {durations && (
                    <div className="space-y-2">
                        <Label htmlFor="case-update-days">{durationLabel}</Label>
                        <Select value={days} onValueChange={setDays}>
                            <SelectTrigger id="case-update-days" className="w-full">
                                <SelectValue />
                            </SelectTrigger>
                            {/* Dialogs sit at z-[70]; the list has to clear them. */}
                            <SelectContent className="z-[80]">
                                {durations.map((option) => (
                                    <SelectItem key={option} value={String(option)}>
                                        {option === 1 ? "1 day" : `${option} days`}
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </div>
                )}
                <Textarea
                    aria-label="Note to user (optional)"
                    placeholder="Note to user (optional)"
                    value={note}
                    maxLength={MODERATION_NOTE_MAX_LENGTH}
                    onChange={(event) => setNote(event.target.value)}
                    className="max-h-40 min-h-16"
                />
                <DialogFooter>
                    <Button variant="outline" onClick={() => onOpenChange(false)} disabled={busy}>
                        Cancel
                    </Button>
                    <Button onClick={() => void confirm()} disabled={busy || (durations && !days)}>
                        {busy && <Loader2 className="size-4 animate-spin" />}
                        {label} and email
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    )
}
