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
import { Textarea } from "@/components/ui/textarea"
import { api } from "@/convex/_generated/api"
import type { Id } from "@/convex/_generated/dataModel"
import { MODERATION_APPEAL_MAX_LENGTH } from "@/convex/lib/moderation"
import { useMutation } from "convex/react"
import { ConvexError } from "convex/values"
import { Loader2 } from "lucide-react"
import { useState } from "react"
import { toast } from "sonner"

export function AppealDialog({
    caseId,
    caseLabel,
    open,
    onOpenChange
}: {
    caseId: Id<"moderationCases">
    caseLabel: string
    open: boolean
    onOpenChange: (open: boolean) => void
}) {
    const submitAppeal = useMutation(api.moderation.submitModerationAppeal)
    const [message, setMessage] = useState("")
    const [submitting, setSubmitting] = useState(false)
    const trimmed = message.trim()

    const submit = async () => {
        if (!trimmed || submitting) return
        setSubmitting(true)
        try {
            await submitAppeal({ caseId, message: trimmed })
            toast.success("Appeal sent. A person will review it.")
            setMessage("")
            onOpenChange(false)
        } catch (error) {
            toast.error(
                error instanceof ConvexError && typeof error.data === "string"
                    ? error.data
                    : "Could not send your appeal. Please try again."
            )
        } finally {
            setSubmitting(false)
        }
    }

    return (
        <Dialog open={open} onOpenChange={(next) => !submitting && onOpenChange(next)}>
            <DialogContent className="rounded-[var(--radius-xl)]">
                <DialogHeader>
                    <DialogTitle>Appeal {caseLabel}</DialogTitle>
                    <DialogDescription>
                        Tell us why you think we got this wrong. A person will review your appeal,
                        and you can only appeal each case once.
                    </DialogDescription>
                </DialogHeader>
                <div className="space-y-2">
                    <Label htmlFor="appeal-message">Your appeal</Label>
                    <Textarea
                        id="appeal-message"
                        value={message}
                        maxLength={MODERATION_APPEAL_MAX_LENGTH}
                        onChange={(event) => setMessage(event.target.value)}
                        className="max-h-64 min-h-32"
                        placeholder="Add any context you'd like us to consider."
                    />
                    <p className="text-right text-muted-foreground text-xs">
                        {message.length}/{MODERATION_APPEAL_MAX_LENGTH}
                    </p>
                </div>
                <DialogFooter>
                    <Button
                        variant="outline"
                        onClick={() => onOpenChange(false)}
                        disabled={submitting}
                    >
                        Cancel
                    </Button>
                    <Button onClick={() => void submit()} disabled={!trimmed || submitting}>
                        {submitting && <Loader2 className="size-4 animate-spin" />}
                        Send appeal
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    )
}
