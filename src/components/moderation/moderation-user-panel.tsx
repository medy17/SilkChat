import { UserPreview } from "@/components/auth/impersonation"
import {
    CaseDetails,
    CaseHeader,
    StrikeMeter,
    describeStanding
} from "@/components/moderation/case-details"
import { CaseUpdateDialog } from "@/components/moderation/case-update-dialog"
import { ModerationActionForm } from "@/components/moderation/moderation-action-form"
import { Button } from "@/components/ui/button"
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger
} from "@/components/ui/dropdown-menu"
import { Card, CardContent } from "@/components/ui/card"
import { api } from "@/convex/_generated/api"
import { useAction, useMutation, useQuery } from "convex/react"
import type { FunctionReturnType } from "convex/server"
import { ConvexError } from "convex/values"
import {
    ArrowLeft,
    CalendarMinus,
    CalendarPlus,
    Check,
    Copy,
    Download,
    Gavel,
    History,
    Loader2,
    LockOpen,
    MoreHorizontal,
    Undo2
} from "lucide-react"
import { AnimatePresence, motion } from "motion/react"
import { type ReactNode, useState } from "react"
import { toast } from "sonner"

type OperatorCase = NonNullable<
    FunctionReturnType<typeof api.moderation.getUserModeration>
>["cases"][number]

const errorText = (error: unknown, fallback: string) =>
    error instanceof ConvexError && typeof error.data === "string" ? error.data : fallback

const DELIVERY_LABELS = {
    pending: "Sending",
    sent: "Sent",
    failed: "Failed"
} as const

const LENGTH_OPTIONS = [1, 3, 7, 14, 30, 60, 90, 180, 365]
const DAY_MS = 24 * 60 * 60 * 1000

function RetryLink({ onRetry }: { onRetry: () => Promise<unknown> }) {
    return (
        <button
            type="button"
            onClick={() =>
                void onRetry().catch((error) => toast.error(errorText(error, "Retry failed.")))
            }
            className="ml-2 underline underline-offset-2 hover:text-primary"
        >
            Retry
        </button>
    )
}

function Delivery({
    status,
    error,
    onRetry
}: {
    status: keyof typeof DELIVERY_LABELS
    error: string | null
    onRetry: () => Promise<unknown>
}) {
    return (
        <span className={status === "failed" ? "text-destructive" : undefined}>
            {DELIVERY_LABELS[status]}
            {error && ` · ${error}`}
            {status === "failed" && <RetryLink onRetry={onRetry} />}
        </span>
    )
}

function OperatorCaseRows({ moderationCase }: { moderationCase: OperatorCase }) {
    const retryDelivery = useMutation(api.moderation.retryModerationDelivery)
    const row = (key: string, label: string, value: ReactNode) => (
        <div key={key} className="grid gap-0.5 sm:grid-cols-[9rem_1fr] sm:gap-3">
            <dt className="text-muted-foreground text-xs sm:pt-0.5">{label}</dt>
            <dd className="min-w-0 break-words text-sm">{value}</dd>
        </div>
    )
    return (
        <>
            {row(
                "email",
                "Email",
                <Delivery
                    status={moderationCase.emailStatus}
                    error={moderationCase.emailError}
                    onRetry={() => retryDelivery({ caseId: moderationCase.id })}
                />
            )}
            {moderationCase.subscriptionCancellation &&
                row(
                    "subscription",
                    "Subscription",
                    moderationCase.subscriptionCancellation === "done"
                        ? "Cancelled"
                        : moderationCase.subscriptionCancellation === "failed"
                          ? "Cancellation failed"
                          : "Cancelling"
                )}
            {moderationCase.internalNote &&
                row(
                    "notes",
                    "Moderators' notes",
                    <span className="whitespace-pre-wrap">{moderationCase.internalNote}</span>
                )}
        </>
    )
}

// Case details plus what only operators see: delivery, subscription, notes, appeal text.
export function OperatorCaseDetails({ moderationCase }: { moderationCase: OperatorCase }) {
    const retryUpdate = useMutation(api.moderation.retryModerationUpdateDelivery)
    return (
        <CaseDetails
            data={moderationCase}
            showAppealMessage
            extraRows={<OperatorCaseRows moderationCase={moderationCase} />}
            updateStatus={(update) => (
                <Delivery
                    status={update.emailStatus}
                    error={update.emailError}
                    onRetry={() => retryUpdate({ updateId: update.id })}
                />
            )}
        />
    )
}

type CaseEdit = "shorten" | "extend" | "lift" | "overturn"

function CaseActions({ moderationCase }: { moderationCase: OperatorCase }) {
    const resolveCase = useMutation(api.moderation.resolveModerationCase)
    const changeEnd = useMutation(api.moderation.changeModerationCaseEnd)
    const [edit, setEdit] = useState<CaseEdit | null>(null)
    if (moderationCase.state !== "active") return null

    const restriction = moderationCase.action === "suspension" || moderationCase.action === "ban"
    const currentEnd = moderationCase.expiresAt ?? moderationCase.endsAt
    const now = Date.now()
    const lengthOptions = moderationCase.action === "warning" ? [] : LENGTH_OPTIONS
    // No end date means it never expires, so every option is shorter and none is longer.
    const shorter = lengthOptions.filter(
        (days) => currentEnd === null || now + days * DAY_MS < currentEnd
    )
    const longer =
        currentEnd === null ? [] : lengthOptions.filter((days) => now + days * DAY_MS > currentEnd)
    const durationLabel = moderationCase.action === "strike" ? "Expires in" : "Ends in"
    const change = ({ note, days }: { note?: string; days?: number }) =>
        changeEnd({ caseId: moderationCase.id, days: days ?? 1, note })
    const dialog = (kind: CaseEdit) => ({
        open: edit === kind,
        onOpenChange: (open: boolean) => setEdit(open ? kind : null)
    })

    return (
        <>
            <DropdownMenu>
                <DropdownMenuTrigger asChild>
                    <Button
                        size="icon"
                        variant="ghost"
                        className="size-8"
                        aria-label={`Actions for ${moderationCase.caseId}`}
                    >
                        <MoreHorizontal className="size-4" />
                    </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                    {shorter.length > 0 && (
                        <DropdownMenuItem onClick={() => setEdit("shorten")}>
                            <CalendarMinus className="size-4" />
                            Shorten
                        </DropdownMenuItem>
                    )}
                    {longer.length > 0 && (
                        <DropdownMenuItem onClick={() => setEdit("extend")}>
                            <CalendarPlus className="size-4" />
                            Extend
                        </DropdownMenuItem>
                    )}
                    {restriction && (
                        <DropdownMenuItem onClick={() => setEdit("lift")}>
                            <LockOpen className="size-4" />
                            Lift
                        </DropdownMenuItem>
                    )}
                    <DropdownMenuItem onClick={() => setEdit("overturn")}>
                        <Undo2 className="size-4" />
                        Overturn
                    </DropdownMenuItem>
                </DropdownMenuContent>
            </DropdownMenu>
            <CaseUpdateDialog
                {...dialog("shorten")}
                label="Shorten"
                title={`Shorten ${moderationCase.caseId}`}
                durations={shorter}
                durationLabel={durationLabel}
                onConfirm={change}
            />
            <CaseUpdateDialog
                {...dialog("extend")}
                label="Extend"
                title={`Extend ${moderationCase.caseId}`}
                durations={longer}
                durationLabel={durationLabel}
                onConfirm={change}
            />
            <CaseUpdateDialog
                {...dialog("lift")}
                label="Lift"
                title={`Lift ${moderationCase.caseId}`}
                description="They can sign in again."
                onConfirm={({ note }) =>
                    resolveCase({ caseId: moderationCase.id, resolution: "lifted", note })
                }
            />
            <CaseUpdateDialog
                {...dialog("overturn")}
                label="Overturn"
                title={`Overturn ${moderationCase.caseId}`}
                description="Withdraws the case and ends any restriction."
                onConfirm={({ note }) =>
                    resolveCase({ caseId: moderationCase.id, resolution: "overturned", note })
                }
            />
        </>
    )
}

type CardStep = "overview" | "history" | "moderate" | "data-copy"

function StepHeader({ title, description }: { title: string; description?: ReactNode }) {
    return (
        <div className="space-y-1">
            <h4 className="font-semibold text-foreground">{title}</h4>
            {description ? <p className="text-muted-foreground text-sm">{description}</p> : null}
        </div>
    )
}

function BackButton({ onClick, disabled }: { onClick: () => void; disabled?: boolean }) {
    return (
        <Button variant="outline" onClick={onClick} disabled={disabled}>
            <ArrowLeft className="size-4" /> Back
        </Button>
    )
}

function HistoryStep({ cases, onBack }: { cases: OperatorCase[]; onBack: () => void }) {
    return (
        <div className="space-y-5">
            <StepHeader title="History" />
            {cases.length === 0 ? (
                <p className="text-muted-foreground text-sm">Nothing yet.</p>
            ) : (
                <div className="divide-y">
                    {cases.map((moderationCase) => (
                        <div key={moderationCase.id} className="space-y-4 py-4 first:pt-0">
                            <CaseHeader
                                data={moderationCase}
                                action={<CaseActions moderationCase={moderationCase} />}
                            />
                            <OperatorCaseDetails moderationCase={moderationCase} />
                        </div>
                    ))}
                </div>
            )}
            <BackButton onClick={onBack} />
        </div>
    )
}

function DataCopyStep({
    authUserId,
    email,
    onBack
}: {
    authUserId: string
    email: string
    onBack: () => void
}) {
    const requestExport = useAction(api.account_exports_node.requestSupportAccountExport)
    const [preparing, setPreparing] = useState(false)
    const [password, setPassword] = useState<string | null>(null)
    const [nextRequestAt, setNextRequestAt] = useState<number | null>(null)
    const [copied, setCopied] = useState(false)

    const prepare = async () => {
        setPreparing(true)
        try {
            const result = await requestExport({ authUserId })
            if (result.accepted) setPassword(result.password)
            else setNextRequestAt(result.nextRequestAt)
        } catch (error) {
            toast.error(errorText(error, "Could not prepare the export."))
        } finally {
            setPreparing(false)
        }
    }

    if (password) {
        return (
            <div className="space-y-5">
                <StepHeader title="ZIP password" description="Shown once." />
                <div className="flex min-w-0 items-center gap-2">
                    <code className="block w-0 min-w-0 flex-1 truncate whitespace-nowrap rounded-[var(--radius-md)] bg-muted p-3 text-xs">
                        {password}
                    </code>
                    <Button
                        variant="outline"
                        size="icon"
                        aria-label="Copy ZIP password"
                        className="shrink-0 rounded-[var(--radius-md)]"
                        onClick={() =>
                            void navigator.clipboard.writeText(password).then(() => setCopied(true))
                        }
                    >
                        {copied ? <Check className="size-4" /> : <Copy className="size-4" />}
                    </Button>
                </div>
                <div className="flex justify-end">
                    <Button onClick={onBack}>Done</Button>
                </div>
            </div>
        )
    }

    return (
        <div className="space-y-5">
            <StepHeader
                title="Send data copy"
                description={`Emails an encrypted ZIP link to ${email}.`}
            />
            {nextRequestAt !== null && (
                <p className="text-muted-foreground text-sm">
                    Available again {new Date(nextRequestAt).toLocaleString()}.
                </p>
            )}
            <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-between">
                <BackButton onClick={onBack} disabled={preparing} />
                <Button
                    onClick={() => void prepare()}
                    disabled={preparing || nextRequestAt !== null}
                >
                    {preparing ? (
                        <Loader2 className="size-4 animate-spin" />
                    ) : (
                        <Download className="size-4" />
                    )}
                    Prepare export
                </Button>
            </div>
        </div>
    )
}

export function ModerationUserPanel({
    authUserId,
    onClose
}: {
    authUserId: string
    onClose: () => void
}) {
    const data = useQuery(api.moderation.getUserModeration, { authUserId })
    const [step, setStep] = useState<CardStep>("overview")

    if (data === undefined) {
        return (
            <Card className="py-5">
                <CardContent className="px-5">
                    <UserPreview user={null} />
                </CardContent>
            </Card>
        )
    }
    if (data === null) {
        return <p className="text-muted-foreground text-sm">This account no longer exists.</p>
    }

    const { title, detail } = describeStanding(data.standing)
    const restricted =
        data.standing.status === "banned" || data.standing.status === "suspended"
            ? data.standing.status
            : null
    const toOverview = () => setStep("overview")

    return (
        // One card: the overview's actions swap the body in place.
        <Card className="py-5">
            <CardContent className="px-5">
                <motion.div layout transition={{ duration: 0.25, ease: [0.16, 1, 0.3, 1] }}>
                    <AnimatePresence mode="wait" initial={false}>
                        <motion.div
                            key={step}
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                            transition={{ duration: 0.15 }}
                        >
                            {step === "overview" && (
                                <div className="space-y-4">
                                    <UserPreview user={data.user} />
                                    <div className="flex flex-col items-center gap-2 text-center">
                                        <p className="font-medium text-sm">{title}</p>
                                        {detail && (
                                            <p className="text-muted-foreground text-xs">
                                                {detail}
                                            </p>
                                        )}
                                        <StrikeMeter
                                            active={data.standing.activeStrikes}
                                            limit={data.standing.strikeLimit}
                                        />
                                    </div>
                                    <div className="flex flex-col-reverse gap-2 pt-2 sm:flex-row sm:justify-between">
                                        <BackButton onClick={onClose} />
                                        <div className="flex flex-col-reverse gap-2 sm:flex-row">
                                            <Button
                                                variant="outline"
                                                onClick={() => setStep("history")}
                                            >
                                                <History className="size-4" />
                                                History
                                                {data.cases.length > 0 && (
                                                    <span className="text-muted-foreground tabular-nums">
                                                        {data.cases.length}
                                                    </span>
                                                )}
                                            </Button>
                                            <Button
                                                variant="outline"
                                                onClick={() => setStep("data-copy")}
                                            >
                                                <Download className="size-4" />
                                                Send data copy
                                            </Button>
                                            <Button onClick={() => setStep("moderate")}>
                                                <Gavel className="size-4" />
                                                Moderate
                                            </Button>
                                        </div>
                                    </div>
                                </div>
                            )}
                            {step === "moderate" && (
                                <div className="space-y-5">
                                    <StepHeader
                                        title={`Moderate ${data.user.name || data.user.email}`}
                                    />
                                    <ModerationActionForm
                                        authUserId={authUserId}
                                        email={data.user.email}
                                        nextStrikeNumber={data.nextStrikeNumber}
                                        strikeLimit={data.standing.strikeLimit}
                                        restricted={restricted}
                                        onBack={toOverview}
                                        onSent={toOverview}
                                    />
                                </div>
                            )}
                            {step === "history" && (
                                <HistoryStep cases={data.cases} onBack={toOverview} />
                            )}
                            {step === "data-copy" && (
                                <DataCopyStep
                                    authUserId={authUserId}
                                    email={data.user.email}
                                    onBack={toOverview}
                                />
                            )}
                        </motion.div>
                    </AnimatePresence>
                </motion.div>
            </CardContent>
        </Card>
    )
}
