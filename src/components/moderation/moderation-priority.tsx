import {
    StrikeMeter,
    describeStanding,
    formatModerationDate
} from "@/components/moderation/case-details"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { api } from "@/convex/_generated/api"
import { useMutation, useQuery } from "convex/react"
import type { FunctionReturnType } from "convex/server"
import { ConvexError } from "convex/values"
import { Loader2 } from "lucide-react"
import { useState } from "react"
import { toast } from "sonner"

type Escalation = FunctionReturnType<typeof api.moderation.listModerationEscalations>[number]

const REASON_LABELS: Record<Escalation["reason"], string> = {
    strike_limit: "Strike limit reached"
}

function EscalationCard({
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
        <Card className="gap-4 py-4 shadow-none">
            <CardContent className="space-y-3 px-4">
                <div className="flex flex-wrap items-baseline justify-between gap-2">
                    <button
                        type="button"
                        onClick={() => onOpenUser(escalation.authUserId)}
                        className="min-w-0 truncate font-medium text-sm underline-offset-2 hover:underline"
                    >
                        {escalation.recipientName ? `${escalation.recipientName} · ` : ""}
                        {escalation.recipientEmail}
                    </button>
                    <span className="text-muted-foreground text-xs">
                        {formatModerationDate(escalation.createdAt)}
                    </span>
                </div>
                <div className="space-y-2">
                    <p className="text-sm">
                        {REASON_LABELS[escalation.reason]}
                        <span className="text-muted-foreground">
                            {" · "}
                            {title} · <span className="font-mono">{escalation.caseId}</span>
                        </span>
                    </p>
                    <StrikeMeter
                        active={escalation.standing.activeStrikes}
                        limit={escalation.standing.strikeLimit}
                    />
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
            </CardContent>
        </Card>
    )
}

// Accounts raised for review, e.g. at the strike limit. Hidden when there are none.
export function ModerationPriorityQueue({
    onOpenUser
}: {
    onOpenUser: (authUserId: string) => void
}) {
    const escalations = useQuery(api.moderation.listModerationEscalations, {})

    if (!escalations?.length) return null
    return (
        <section className="space-y-3" aria-labelledby="moderation-priority-heading">
            <h3 id="moderation-priority-heading" className="font-semibold">
                Priority
            </h3>
            <div className="space-y-3">
                {escalations.map((escalation) => (
                    <EscalationCard
                        key={escalation.escalationId}
                        escalation={escalation}
                        onOpenUser={onOpenUser}
                    />
                ))}
            </div>
        </section>
    )
}
