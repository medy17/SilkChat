import {
    ACTION_ICONS,
    ACTION_LABELS,
    CaseStateBadge,
    formatModerationDate
} from "@/components/moderation/case-details"
import { AppealRow } from "@/components/moderation/moderation-appeals"
import { EscalationRow } from "@/components/moderation/moderation-priority"
import {
    ModerationRow,
    ModerationRowDate,
    ModerationRowList,
    ModerationRowSkeleton,
    RowAccount
} from "@/components/moderation/moderation-row"
import {
    CaseActions,
    type OperatorCase,
    OperatorCaseDetails
} from "@/components/moderation/moderation-user-panel"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import { api } from "@/convex/_generated/api"
import { type ModerationAction, getModerationCategory } from "@/convex/lib/moderation"
import { usePaginatedQuery, useQuery } from "convex/react"
import type { FunctionReturnType } from "convex/server"
import { Loader2, MailWarning } from "lucide-react"

type RecentCase = FunctionReturnType<
    typeof api.moderation.listRecentModerationCases
>["page"][number]

const INITIAL_CASES = 10
const MORE_CASES = 20

// Only a case still in effect takes its action's color.
const ACTION_TONES: Record<ModerationAction, string> = {
    warning: "text-muted-foreground",
    strike: "text-warning",
    suspension: "text-destructive",
    ban: "text-destructive"
}

// A delivery that gave up after its retries, so the user may not have heard from us.
const deliveryProblem = (moderationCase: OperatorCase) => {
    if (moderationCase.subscriptionCancellation === "failed") {
        return "Subscription cancellation failed"
    }
    if (moderationCase.emailStatus === "failed") return "Email failed"
    if (moderationCase.updates.some((update) => update.emailStatus === "failed")) {
        return "Update email failed"
    }
    return null
}

function CaseRow({
    item,
    failedDelivery = false,
    onOpenUser
}: {
    item: RecentCase
    // Listed under Needs review for its delivery rather than for the case itself.
    failedDelivery?: boolean
    onOpenUser: (authUserId: string) => void
}) {
    const moderationCase = item.case
    const problem = deliveryProblem(moderationCase)
    const createdOn = formatModerationDate(moderationCase.createdAt)
    const stateBadge = (
        <CaseStateBadge
            action={moderationCase.action}
            state={moderationCase.state}
            until={moderationCase.expiresAt ?? moderationCase.endsAt}
        />
    )

    return (
        <ModerationRow
            icon={failedDelivery ? MailWarning : ACTION_ICONS[moderationCase.action]}
            iconClassName={
                failedDelivery
                    ? "text-destructive"
                    : moderationCase.state === "active"
                      ? ACTION_TONES[moderationCase.action]
                      : undefined
            }
            title={<RowAccount name={item.recipientName} email={moderationCase.recipientEmail} />}
            meta={
                <>
                    {problem && <span className="text-destructive">{problem}</span>}
                    {problem && " · "}
                    {ACTION_LABELS[moderationCase.action]}
                    {" · "}
                    {getModerationCategory(moderationCase.category)?.label ??
                        moderationCase.category}
                    {!failedDelivery && ` · ${createdOn}`}
                </>
            }
            // Under Needs review every row ends on its date, like the rows around it.
            trailing={
                failedDelivery ? (
                    <ModerationRowDate>{createdOn}</ModerationRowDate>
                ) : (
                    <span className="hidden sm:contents">{stateBadge}</span>
                )
            }
        >
            <div className={failedDelivery ? undefined : "sm:hidden"}>{stateBadge}</div>
            <OperatorCaseDetails moderationCase={moderationCase} />
            <div className="flex items-center justify-end gap-2">
                <CaseActions moderationCase={moderationCase} />
                <Button variant="outline" onClick={() => onOpenUser(item.authUserId)}>
                    Open account
                </Button>
            </div>
        </ModerationRow>
    )
}

// The page's default view: what is waiting on a moderator, then what has been done lately.
export function ModerationOverview({ onOpenUser }: { onOpenUser: (authUserId: string) => void }) {
    const escalations = useQuery(api.moderation.listModerationEscalations, {})
    const appeals = useQuery(api.moderation.listPendingAppeals, {})
    const recent = usePaginatedQuery(
        api.moderation.listRecentModerationCases,
        {},
        { initialNumItems: INITIAL_CASES }
    )
    const recentLoading = recent.status === "LoadingFirstPage"
    // Failed deliveries surface from the cases loaded below, which is where new ones land.
    const failedDeliveries = recent.results.filter((item) => deliveryProblem(item.case))
    const queueLoading = escalations === undefined || appeals === undefined || recentLoading
    const queueEmpty =
        !queueLoading && escalations.length + appeals.length + failedDeliveries.length === 0

    return (
        <>
            <section className="space-y-3" aria-labelledby="moderation-review-heading">
                <h3 id="moderation-review-heading" className="font-semibold">
                    Needs review
                </h3>
                {queueLoading ? (
                    <Skeleton className="h-5 w-40" />
                ) : queueEmpty ? (
                    <p className="text-muted-foreground text-sm">Nothing needs review.</p>
                ) : (
                    <ModerationRowList>
                        {escalations.map((escalation) => (
                            <EscalationRow
                                key={escalation.escalationId}
                                escalation={escalation}
                                onOpenUser={onOpenUser}
                            />
                        ))}
                        {appeals.map((appeal) => (
                            <AppealRow
                                key={appeal.appealId}
                                appeal={appeal}
                                onOpenUser={onOpenUser}
                            />
                        ))}
                        {failedDeliveries.map((item) => (
                            <CaseRow
                                key={item.case.id}
                                item={item}
                                failedDelivery
                                onOpenUser={onOpenUser}
                            />
                        ))}
                    </ModerationRowList>
                )}
            </section>

            <section className="space-y-3" aria-labelledby="moderation-recent-heading">
                <h3 id="moderation-recent-heading" className="font-semibold">
                    Recent cases
                </h3>
                {recentLoading ? (
                    <ModerationRowSkeleton />
                ) : recent.results.length === 0 ? (
                    <p className="text-muted-foreground text-sm">No cases yet.</p>
                ) : (
                    <>
                        <ModerationRowList>
                            {recent.results.map((item) => (
                                <CaseRow key={item.case.id} item={item} onOpenUser={onOpenUser} />
                            ))}
                        </ModerationRowList>
                        {(recent.status === "CanLoadMore" || recent.status === "LoadingMore") && (
                            <div className="flex justify-center">
                                <Button
                                    variant="ghost"
                                    size="sm"
                                    className="text-muted-foreground"
                                    disabled={recent.status === "LoadingMore"}
                                    onClick={() => recent.loadMore(MORE_CASES)}
                                >
                                    {recent.status === "LoadingMore" && (
                                        <Loader2 className="size-4 animate-spin" />
                                    )}
                                    Show more
                                </Button>
                            </div>
                        )}
                    </>
                )}
            </section>
        </>
    )
}
