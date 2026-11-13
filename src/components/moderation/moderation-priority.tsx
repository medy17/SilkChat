import {
    StrikeMeter,
    describeStanding,
    formatModerationDate
} from "@/components/moderation/case-details"
import {
    ModerationRow,
    ModerationRowDate,
    RowAccount
} from "@/components/moderation/moderation-row"
import { Button } from "@/components/ui/button"
import { api } from "@/convex/_generated/api"
import { useMutation } from "convex/react"
import type { FunctionReturnType } from "convex/server"
import { ConvexError } from "convex/values"
import { AlertTriangle, Loader2 } from "lucide-react"
import { useState } from "react"
import { toast } from "sonner"

export type Escalation = FunctionReturnType<typeof api.moderation.listModerationEscalations>[number]

const REASON_LABELS: Record<Escalation["reason"], string> = {
    strike_limit: "Strike limit reached"
}

// An account raised for review, e.g. at the strike limit.
export function EscalationRow({
    escalation,
    onOpenUser
}: {
    escalation: Escalation
    onOpenUser: (authUserId: string) => void
}) {
    const dismiss = useMutation(api.moderation.dismissModerationEscalation)
    const [dismissing, setDismissing] = useState(false)
    const { title } = describeStanding(escalation.standing)

    const submitDismiss = async () => {
        setDismissing(true)
        try {
            await dismiss({ escalationId: escalation.escalationId })
        } catch (error) {
            toast.error(
                error instanceof ConvexError && typeof error.data === "string"
                    ? error.data
                    : "Could not dismiss."
            )
            setDismissing(false)
        }
    }

    return (
        <ModerationRow
            icon={AlertTriangle}
            iconClassName="text-warning"
            title={<RowAccount name={escalation.recipientName} email={escalation.recipientEmail} />}
            meta={`${REASON_LABELS[escalation.reason]} · ${title}`}
            trailing={
                <ModerationRowDate>{formatModerationDate(escalation.createdAt)}</ModerationRowDate>
            }
        >
            <div className="space-y-2">
                <StrikeMeter
                    active={escalation.standing.activeStrikes}
                    limit={escalation.standing.strikeLimit}
                />
                <p className="text-muted-foreground text-xs">
                    Raised by <span className="font-mono">{escalation.caseId}</span>
                </p>
            </div>
            <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
                <Button
                    variant="outline"
                    onClick={() => void submitDismiss()}
                    disabled={dismissing}
                >
                    {dismissing && <Loader2 className="size-4 animate-spin" />}
                    Dismiss
                </Button>
                <Button onClick={() => onOpenUser(escalation.authUserId)}>Review</Button>
            </div>
        </ModerationRow>
    )
}
