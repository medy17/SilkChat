import { Badge } from "@/components/ui/badge"
import type {
    AccountStanding,
    ModerationAction,
    ModerationCaseState
} from "@/convex/lib/moderation"
import { cn } from "@/lib/utils"
import { Link } from "@tanstack/react-router"
import type { ReactNode } from "react"

export const ACTION_LABELS: Record<ModerationAction, string> = {
    warning: "Warning",
    strike: "Strike",
    suspension: "Suspension",
    ban: "Ban"
}

const STATE_LABELS: Record<ModerationCaseState, string> = {
    active: "Active",
    expired: "Expired",
    ended: "Ended",
    overturned: "Overturned",
    lifted: "Lifted"
}

const APPEAL_LABELS = {
    pending: "Under review",
    upheld: "Denied",
    overturned: "Accepted"
} as const

export const formatModerationDate = (timestamp: number) =>
    new Date(timestamp).toLocaleDateString(undefined, { dateStyle: "medium" })

export function ActionBadge({ action }: { action: ModerationAction }) {
    return (
        <Badge
            variant={
                action === "warning" ? "secondary" : action === "strike" ? "warning" : "destructive"
            }
        >
            {ACTION_LABELS[action]}
        </Badge>
    )
}

const HOUR_MS = 60 * 60 * 1000

const formatTimeUntil = (until: number, now = Date.now()) => {
    const hours = Math.ceil((until - now) / HOUR_MS)
    if (hours < 24) return hours <= 1 ? "<1 hour" : `${hours} hours`
    const days = Math.ceil(hours / 24)
    return days === 1 ? "1 day" : `${days} days`
}

// Suspensions end; strikes expire.
const endVerb = (action: ModerationAction) => (action === "strike" ? "Expires" : "Ends")

// Running strikes and suspensions count down instead of reading "Active".
export function CaseStateBadge({
    action,
    state,
    until
}: {
    action: ModerationAction
    state: ModerationCaseState
    until: number | null
}) {
    const counting = state === "active" && until !== null
    return (
        <Badge
            variant="outline"
            title={until !== null ? formatModerationDate(until) : undefined}
            className={cn("tabular-nums", state !== "active" && "text-muted-foreground")}
        >
            {counting ? `${endVerb(action)} in ${formatTimeUntil(until)}` : STATE_LABELS[state]}
        </Badge>
    )
}

export function describeStanding(standing: AccountStanding) {
    switch (standing.status) {
        case "good":
            return { title: "Good standing" }
        case "strikes":
            return {
                title: `${standing.activeStrikes} of ${standing.strikeLimit} strikes`,
                detail:
                    standing.activeStrikes >= standing.strikeLimit
                        ? "Strike limit reached."
                        : undefined
            }
        case "suspended":
            return {
                title: "Suspended",
                detail: `Until ${formatModerationDate(standing.endsAt)}`
            }
        case "banned":
            return { title: "Banned" }
    }
}

export function StrikeMeter({ active, limit }: { active: number; limit: number }) {
    return (
        <div
            role="meter"
            aria-label="Active strikes"
            aria-valuemin={0}
            aria-valuemax={limit}
            aria-valuenow={active}
            className="flex gap-1.5"
        >
            {Array.from({ length: limit }, (_, index) => (
                <span
                    key={index}
                    className={cn(
                        "h-1.5 w-8 rounded-[var(--radius-sm)]",
                        index < active ? "bg-warning" : "bg-muted"
                    )}
                />
            ))}
        </div>
    )
}

export type CaseDetailsData = {
    caseId: string
    action: ModerationAction
    violation: string
    policyReference: string | null
    policyAnchor: string | null
    contentAction: string | null
    strikeNumber: number | null
    strikeLimit: number | null
    expiresAt: number | null
    endsAt: number | null
    state: ModerationCaseState
    createdAt: number
    appeal: {
        status: keyof typeof APPEAL_LABELS
        message: string
    } | null
    updates: CaseUpdateData[]
}

export type CaseUpdateData = {
    id: string
    kind: "appeal_denied" | "overturned" | "lifted" | "shortened" | "extended"
    viaAppeal: boolean
    newEnd: number | null
    note: string | null
    createdAt: number
}

const updateLabel = (update: CaseUpdateData) =>
    update.kind === "overturned"
        ? update.viaAppeal
            ? "Appeal accepted"
            : "Overturned"
        : {
              appeal_denied: "Appeal denied",
              lifted: "Lifted",
              shortened: "Shortened",
              extended: "Extended"
          }[update.kind]

function DetailRow({ label, children }: { label: string; children: ReactNode }) {
    return (
        <div className="grid gap-0.5 sm:grid-cols-[9rem_1fr] sm:gap-3">
            <dt className="text-muted-foreground text-xs sm:pt-0.5">{label}</dt>
            <dd className="min-w-0 break-words text-sm">{children}</dd>
        </div>
    )
}

export function CaseDetails<Update extends CaseUpdateData>({
    data,
    showAppealMessage = false,
    extraRows,
    updateStatus
}: {
    data: Omit<CaseDetailsData, "updates"> & { updates: Update[] }
    showAppealMessage?: boolean
    extraRows?: ReactNode
    // Operators also see whether each update's email was delivered.
    updateStatus?: (update: Update) => ReactNode
}) {
    // An overturned or lifted case's end date no longer applies.
    const closed = data.state === "overturned" || data.state === "lifted"
    const until = closed ? null : (data.expiresAt ?? data.endsAt)
    return (
        <dl className="space-y-2">
            <DetailRow label="What we found">{data.violation}</DetailRow>
            {data.policyReference && (
                <DetailRow label="Policy">
                    {data.policyAnchor ? (
                        <Link
                            to="/terms-of-service"
                            hash={data.policyAnchor}
                            className="underline underline-offset-2 hover:text-primary"
                        >
                            {data.policyReference}
                        </Link>
                    ) : (
                        data.policyReference
                    )}
                </DetailRow>
            )}
            {data.contentAction && (
                <DetailRow label="Action on content">{data.contentAction}</DetailRow>
            )}
            {until !== null && (
                <DetailRow label={`${endVerb(data.action)} on`}>
                    {formatModerationDate(until)}
                </DetailRow>
            )}
            {data.action === "ban" && until === null && !closed && (
                <DetailRow label="Duration">Permanent</DetailRow>
            )}
            {extraRows}
            <DetailRow label="Case ID">
                <span className="font-mono text-xs">{data.caseId}</span>
            </DetailRow>
            {/* Decided appeals show up as an update row below. */}
            {data.appeal && (data.appeal.status === "pending" || showAppealMessage) && (
                <DetailRow label="Appeal">
                    <span className="font-medium">{APPEAL_LABELS[data.appeal.status]}</span>
                    {showAppealMessage && (
                        <span className="mt-1 block whitespace-pre-wrap text-muted-foreground">
                            {data.appeal.message}
                        </span>
                    )}
                </DetailRow>
            )}
            {data.updates.map((update) => (
                <DetailRow key={update.id} label={updateLabel(update)}>
                    {formatModerationDate(update.createdAt)}
                    {update.newEnd !== null &&
                        ` · now ${endVerb(data.action).toLowerCase()} ${formatModerationDate(update.newEnd)}`}
                    {updateStatus && <> · {updateStatus(update)}</>}
                    {update.note && (
                        <span className="mt-1 block whitespace-pre-wrap text-muted-foreground">
                            {update.note}
                        </span>
                    )}
                </DetailRow>
            ))}
        </dl>
    )
}

export function CaseHeader({ data, action }: { data: CaseDetailsData; action?: ReactNode }) {
    return (
        <div className="flex flex-wrap items-center gap-2">
            <ActionBadge action={data.action} />
            <CaseStateBadge
                action={data.action}
                state={data.state}
                until={data.expiresAt ?? data.endsAt}
            />
            <span className="text-muted-foreground text-xs">
                {formatModerationDate(data.createdAt)}
            </span>
            {action ? <div className="ml-auto flex flex-wrap gap-2">{action}</div> : null}
        </div>
    )
}
