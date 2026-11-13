import {
    ACTION_LABELS,
    CaseHeader,
    formatModerationDate
} from "@/components/moderation/case-details"
import {
    ModerationRow,
    ModerationRowDate,
    RowAccount
} from "@/components/moderation/moderation-row"
import { OperatorCaseDetails } from "@/components/moderation/moderation-user-panel"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { api } from "@/convex/_generated/api"
import { MODERATION_NOTE_MAX_LENGTH } from "@/convex/lib/moderation"
import { useMutation } from "convex/react"
import type { FunctionReturnType } from "convex/server"
import { ConvexError } from "convex/values"
import { Loader2, Scale } from "lucide-react"
import { useState } from "react"
import { toast } from "sonner"

export type PendingAppeal = FunctionReturnType<typeof api.moderation.listPendingAppeals>[number]

export function AppealRow({
    appeal,
    onOpenUser
}: {
    appeal: PendingAppeal
    onOpenUser: (authUserId: string) => void
}) {
    const decide = useMutation(api.moderation.decideModerationAppeal)
    const [note, setNote] = useState("")
    const [deciding, setDeciding] = useState<"upheld" | "overturned" | null>(null)

    const submit = async (decision: "upheld" | "overturned") => {
        setDeciding(decision)
        try {
            await decide({
                appealId: appeal.appealId,
                decision,
                decisionNote: note.trim() || undefined
            })
            toast.success(decision === "upheld" ? "Appeal denied" : "Case overturned")
        } catch (error) {
            toast.error(
                error instanceof ConvexError && typeof error.data === "string"
                    ? error.data
                    : "Could not record the decision."
            )
            setDeciding(null)
        }
    }

    return (
        <ModerationRow
            icon={Scale}
            title={<RowAccount name={appeal.recipientName} email={appeal.recipientEmail} />}
            meta={`Appealed ${ACTION_LABELS[appeal.case.action].toLowerCase()} · ${appeal.message}`}
            trailing={
                <ModerationRowDate>{formatModerationDate(appeal.createdAt)}</ModerationRowDate>
            }
        >
            <CaseHeader data={appeal.case} />
            <OperatorCaseDetails moderationCase={appeal.case} />
            <Textarea
                aria-label="Note to user (optional)"
                placeholder="Note to user (optional)"
                value={note}
                maxLength={MODERATION_NOTE_MAX_LENGTH}
                onChange={(event) => setNote(event.target.value)}
                className="max-h-40 min-h-16"
            />
            <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-between">
                <Button variant="outline" onClick={() => onOpenUser(appeal.authUserId)}>
                    Open account
                </Button>
                <div className="flex flex-col-reverse gap-2 sm:flex-row">
                    <Button
                        variant="outline"
                        onClick={() => void submit("upheld")}
                        disabled={deciding !== null}
                    >
                        {deciding === "upheld" && <Loader2 className="size-4 animate-spin" />}
                        Deny appeal
                    </Button>
                    <Button onClick={() => void submit("overturned")} disabled={deciding !== null}>
                        {deciding === "overturned" && <Loader2 className="size-4 animate-spin" />}
                        Overturn case
                    </Button>
                </div>
            </div>
        </ModerationRow>
    )
}
