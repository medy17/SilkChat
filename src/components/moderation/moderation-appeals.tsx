import { CaseHeader, formatModerationDate } from "@/components/moderation/case-details"
import { OperatorCaseDetails } from "@/components/moderation/moderation-user-panel"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Textarea } from "@/components/ui/textarea"
import { api } from "@/convex/_generated/api"
import { MODERATION_NOTE_MAX_LENGTH } from "@/convex/lib/moderation"
import { useMutation, useQuery } from "convex/react"
import type { FunctionReturnType } from "convex/server"
import { ConvexError } from "convex/values"
import { Loader2 } from "lucide-react"
import { useState } from "react"
import { toast } from "sonner"

type PendingAppeal = FunctionReturnType<typeof api.moderation.listPendingAppeals>[number]

function AppealCard({
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
        <Card className="gap-4 py-4 shadow-none">
            <CardContent className="space-y-4 px-4">
                <div className="flex flex-wrap items-baseline justify-between gap-2">
                    <button
                        type="button"
                        onClick={() => onOpenUser(appeal.authUserId)}
                        className="min-w-0 truncate font-medium text-sm underline-offset-2 hover:underline"
                    >
                        {appeal.recipientName ? `${appeal.recipientName} · ` : ""}
                        {appeal.recipientEmail}
                    </button>
                    <span className="text-muted-foreground text-xs">
                        Appealed {formatModerationDate(appeal.createdAt)}
                    </span>
                </div>
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
                <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
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
            </CardContent>
        </Card>
    )
}

export function ModerationAppealsQueue({
    onOpenUser
}: {
    onOpenUser: (authUserId: string) => void
}) {
    const appeals = useQuery(api.moderation.listPendingAppeals, {})

    if (appeals === undefined) return null
    if (appeals.length === 0) {
        return <p className="text-muted-foreground text-sm">No appeals waiting for review.</p>
    }
    return (
        <div className="space-y-3">
            {appeals.map((appeal) => (
                <AppealCard key={appeal.appealId} appeal={appeal} onOpenUser={onOpenUser} />
            ))}
        </div>
    )
}
