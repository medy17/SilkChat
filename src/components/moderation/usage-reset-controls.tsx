import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle
} from "@/components/ui/alert-dialog"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import { DatePicker } from "@/components/ui/date-picker"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Skeleton } from "@/components/ui/skeleton"
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue
} from "@/components/ui/select"
import { api } from "@/convex/_generated/api"
import type { Id } from "@/convex/_generated/dataModel"
import {
    DEFAULT_USAGE_RESET_EXPIRY_MONTHS,
    USAGE_RESET_EXPIRY_MONTH_OPTIONS,
    USAGE_RESET_NOTE_MAX_LENGTH,
    type UsageResetDelivery,
    type UsageResetWindow
} from "@/convex/lib/usage_resets"
import { useCapAlignedIcon } from "@/hooks/use-cap-aligned-icon"
import { cn } from "@/lib/utils"
import { useMutation, useQuery } from "convex/react"
import { endOfDay } from "date-fns"
import type { FunctionReturnType } from "convex/server"
import { ConvexError } from "convex/values"
import {
    CalendarDays,
    CalendarRange,
    CheckCircle,
    Hourglass,
    Loader2,
    type LucideIcon,
    RotateCcw,
    Ticket,
    Zap
} from "lucide-react"
import { type ReactNode, useState } from "react"
import { toast } from "sonner"

type GrantView = FunctionReturnType<typeof api.usage_resets.listRecentGlobalUsageResets>[number] & {
    redeemed?: boolean
}

type GrantTarget = { kind: "user"; authUserId: string } | { kind: "global" }

const errorText = (error: unknown, fallback: string) =>
    error instanceof ConvexError && typeof error.data === "string" ? error.data : fallback

type TileOption<T extends string> = {
    value: T
    label: string
    icon: LucideIcon
    description: string
    // Fills the meter, matching the moderation action tiles.
    level?: number
}

const WINDOW_OPTIONS: TileOption<UsageResetWindow>[] = [
    {
        value: "five_hour",
        label: "5-hour",
        icon: Hourglass,
        description: "Clears the 5-hour window.",
        level: 1
    },
    {
        value: "weekly",
        label: "Weekly",
        icon: CalendarDays,
        description: "Gives back a quarter of the month.",
        level: 2
    },
    {
        value: "monthly",
        label: "Monthly",
        icon: CalendarRange,
        description: "Clears the whole month.",
        level: 3
    }
]

const DELIVERY_OPTIONS: TileOption<UsageResetDelivery>[] = [
    {
        value: "instant",
        label: "Instant",
        icon: Zap,
        description: "Applies straight away."
    },
    {
        value: "banked",
        label: "Banked",
        icon: Ticket,
        description: "Used whenever they choose."
    }
]

function TilePicker<T extends string>({
    name,
    label,
    options,
    value,
    onChange
}: {
    name: string
    label: string
    options: TileOption<T>[]
    value: T
    onChange: (value: T) => void
}) {
    const maxLevel = Math.max(0, ...options.map((option) => option.level ?? 0))

    return (
        <div
            role="radiogroup"
            aria-label={label}
            className={cn(
                "grid gap-2 sm:gap-3",
                options.length === 3 ? "grid-cols-1 sm:grid-cols-3" : "grid-cols-2"
            )}
        >
            {options.map((option) => {
                const isSelected = value === option.value
                const Icon = option.icon
                const descriptionId = `${name}-${option.value}-description`
                return (
                    <label
                        key={option.value}
                        className={cn(
                            "flex cursor-pointer flex-col rounded-[var(--radius-xl)] border-0 bg-muted/20 p-3 transition-all duration-200 hover:bg-muted/40 sm:p-4 [&:has(input:focus-visible)]:ring-2 [&:has(input:focus-visible)]:ring-ring",
                            isSelected
                                ? "bg-primary/5 ring-1 ring-primary/20"
                                : "hover:ring-1 hover:ring-border"
                        )}
                    >
                        <input
                            type="radio"
                            name={name}
                            value={option.value}
                            checked={isSelected}
                            onChange={() => onChange(option.value)}
                            aria-describedby={descriptionId}
                            className="sr-only"
                        />
                        <div className="flex min-w-0 flex-1 flex-col gap-2">
                            <div className="flex items-center gap-2">
                                <div className="flex size-7 shrink-0 items-center justify-center rounded-full bg-background">
                                    <Icon className="size-3.5 text-foreground" aria-hidden="true" />
                                </div>
                                <span className="truncate font-medium text-foreground text-sm">
                                    {option.label}
                                </span>
                                {isSelected && (
                                    <CheckCircle className="ml-auto size-4 shrink-0 text-primary" />
                                )}
                            </div>
                            <p
                                id={descriptionId}
                                className="text-muted-foreground text-xs leading-5"
                            >
                                {option.description}
                            </p>
                            {option.level !== undefined && (
                                // Pinned to the bottom so description length never moves the meter.
                                <div className="mt-auto flex gap-1 pt-1" aria-hidden="true">
                                    {Array.from({ length: maxLevel }, (_, index) => (
                                        <div
                                            key={index}
                                            className={cn(
                                                "h-1.5 flex-1 rounded-[var(--radius-sm)]",
                                                index < (option.level ?? 0)
                                                    ? "bg-primary"
                                                    : "bg-muted"
                                            )}
                                        />
                                    ))}
                                </div>
                            )}
                        </div>
                    </label>
                )
            })}
        </div>
    )
}

const PLAN_OPTIONS = [
    { value: "all", label: "Everyone" },
    { value: "free", label: "Free" },
    { value: "pro", label: "Pro" }
] as const

const formatDate = (timestamp: number) =>
    new Intl.DateTimeFormat(undefined, { day: "numeric", month: "short", year: "numeric" }).format(
        new Date(timestamp)
    )

// The whole chosen day counts; the server caps the cutoff at the moment of granting.
const endOfLocalDay = (date: Date) => endOfDay(date).getTime()

// Nobody signed up before this, so the signup picker starts here.
const EARLIEST_SIGNUP_DATE = new Date(2026, 0, 1)

export function UsageResetGrantForm({
    target,
    onGranted
}: {
    target: GrantTarget
    onGranted?: () => void
}) {
    const grant = useMutation(api.usage_resets.grantUsageReset)
    const today = new Date()
    const [resetWindow, setResetWindow] = useState<UsageResetWindow>("five_hour")
    const [includesFiveHour, setIncludesFiveHour] = useState(false)
    const [delivery, setDelivery] = useState<UsageResetDelivery>("instant")
    const [expiry, setExpiry] = useState(String(DEFAULT_USAGE_RESET_EXPIRY_MONTHS))
    const [plan, setPlan] = useState<(typeof PLAN_OPTIONS)[number]["value"]>("all")
    const [signedUpBefore, setSignedUpBefore] = useState<Date | undefined>(today)
    const [note, setNote] = useState("")
    const [confirming, setConfirming] = useState(false)
    const [submitting, setSubmitting] = useState(false)
    const isGlobal = target.kind === "global"
    const idPrefix = isGlobal ? "global-reset" : "user-reset"

    const submit = async () => {
        setSubmitting(true)
        try {
            await grant({
                target: isGlobal
                    ? {
                          kind: "global",
                          plan: plan === "all" ? undefined : plan,
                          signedUpBefore: signedUpBefore ? endOfLocalDay(signedUpBefore) : undefined
                      }
                    : target,
                window: resetWindow,
                includesFiveHour: resetWindow !== "five_hour" && includesFiveHour,
                delivery,
                expiryMonths: expiry === "never" ? null : Number(expiry),
                note: note.trim() || undefined
            })
            toast.success(delivery === "instant" ? "Usage reset" : "Banked Reset granted")
            setNote("")
            setConfirming(false)
            onGranted?.()
        } catch (error) {
            toast.error(errorText(error, "Could not grant the reset."))
        } finally {
            setSubmitting(false)
        }
    }

    const actionLabel = delivery === "instant" ? "Reset now" : "Grant Banked Reset"
    const audienceTitle = plan === "all" ? "everyone" : plan === "free" ? "Free users" : "Pro users"
    const audience = `${plan === "all" ? "All" : plan === "free" ? "Free" : "Pro"} users who signed up by ${
        signedUpBefore ? formatDate(endOfLocalDay(signedUpBefore)) : "today"
    }`

    return (
        <div className="space-y-5">
            <div className="space-y-3">
                <TilePicker
                    name={`${idPrefix}-window`}
                    label="Reset"
                    options={WINDOW_OPTIONS}
                    value={resetWindow}
                    onChange={setResetWindow}
                />
                {resetWindow !== "five_hour" && (
                    <Label className="flex items-center gap-2 font-normal text-sm">
                        <Checkbox
                            checked={includesFiveHour}
                            onCheckedChange={(checked) => setIncludesFiveHour(checked === true)}
                        />
                        Also clear the 5-hour window
                    </Label>
                )}
            </div>
            <TilePicker
                name={`${idPrefix}-delivery`}
                label="Delivery"
                options={DELIVERY_OPTIONS}
                value={delivery}
                onChange={setDelivery}
            />
            {(delivery === "banked" || isGlobal) && (
                <div
                    className={cn(
                        "grid gap-4",
                        // One column per field, so three fields never leave a gap.
                        delivery === "banked" && isGlobal ? "sm:grid-cols-3" : "sm:grid-cols-2"
                    )}
                >
                    {delivery === "banked" && (
                        <div className="space-y-2">
                            <Label htmlFor={`${idPrefix}-expiry`}>Expires after</Label>
                            <Select value={expiry} onValueChange={setExpiry}>
                                <SelectTrigger id={`${idPrefix}-expiry`} className="w-full">
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                    {USAGE_RESET_EXPIRY_MONTH_OPTIONS.map((months) => (
                                        <SelectItem key={months} value={String(months)}>
                                            {months === 1 ? "1 month" : `${months} months`}
                                        </SelectItem>
                                    ))}
                                    <SelectItem value="never">Never</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>
                    )}
                    {isGlobal && (
                        <>
                            <div className="space-y-2">
                                <Label htmlFor={`${idPrefix}-plan`}>Plan</Label>
                                <Select
                                    value={plan}
                                    onValueChange={(value) =>
                                        setPlan(value as (typeof PLAN_OPTIONS)[number]["value"])
                                    }
                                >
                                    <SelectTrigger id={`${idPrefix}-plan`} className="w-full">
                                        <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {PLAN_OPTIONS.map((option) => (
                                            <SelectItem key={option.value} value={option.value}>
                                                {option.label}
                                            </SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor={`${idPrefix}-signed-up`}>Signed up by</Label>
                                <DatePicker
                                    id={`${idPrefix}-signed-up`}
                                    value={signedUpBefore}
                                    onChange={setSignedUpBefore}
                                    minDate={EARLIEST_SIGNUP_DATE}
                                    maxDate={today}
                                />
                            </div>
                        </>
                    )}
                </div>
            )}
            <div className="space-y-2">
                <Label htmlFor={`${idPrefix}-note`}>Note (optional)</Label>
                <Input
                    id={`${idPrefix}-note`}
                    value={note}
                    maxLength={USAGE_RESET_NOTE_MAX_LENGTH}
                    onChange={(event) => setNote(event.target.value)}
                />
            </div>
            <div className="flex justify-end">
                <Button
                    onClick={() => (isGlobal ? setConfirming(true) : void submit())}
                    disabled={submitting}
                >
                    {submitting ? (
                        <Loader2 className="size-4 animate-spin" />
                    ) : delivery === "instant" ? (
                        <RotateCcw className="size-4" />
                    ) : (
                        <Ticket className="size-4" />
                    )}
                    {actionLabel}
                </Button>
            </div>

            {isGlobal && (
                <AlertDialog open={confirming} onOpenChange={setConfirming}>
                    <AlertDialogContent>
                        <AlertDialogHeader>
                            <AlertDialogTitle>
                                {delivery === "instant"
                                    ? `Reset usage for ${audienceTitle}?`
                                    : `Grant a Banked Reset to ${audienceTitle}?`}
                            </AlertDialogTitle>
                            <AlertDialogDescription>
                                {delivery === "instant"
                                    ? `${audience} are reset straight away. This can't be undone.`
                                    : `${audience} each get a Banked Reset. You can revoke it until it's used.`}
                            </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                            <AlertDialogCancel disabled={submitting}>Cancel</AlertDialogCancel>
                            <AlertDialogAction
                                disabled={submitting}
                                onClick={(event) => {
                                    event.preventDefault()
                                    void submit()
                                }}
                            >
                                {submitting && <Loader2 className="size-4 animate-spin" />}
                                {actionLabel}
                            </AlertDialogAction>
                        </AlertDialogFooter>
                    </AlertDialogContent>
                </AlertDialog>
            )}
        </div>
    )
}

const describeGrantStatus = (grant: GrantView) => {
    if (grant.delivery === "instant") return `Applied ${formatDate(grant.createdAt)}`
    if (grant.redeemed) return "Used"
    if (grant.revokedAt !== null) return `Revoked ${formatDate(grant.revokedAt)}`
    if (grant.expiresAt !== null && grant.expiresAt <= Date.now()) {
        return `Expired ${formatDate(grant.expiresAt)}`
    }
    return grant.expiresAt === null ? "Never expires" : `Expires ${formatDate(grant.expiresAt)}`
}

const GRANT_AUDIENCE = { free: "Free", pro: "Pro" } as const

const describeGrantMeta = (grant: GrantView) =>
    [
        grant.scope === "global" ? (grant.plan ? GRANT_AUDIENCE[grant.plan] : "Everyone") : null,
        describeGrantStatus(grant),
        grant.note
    ]
        .filter(Boolean)
        .join(" · ")

function GrantRow({
    grant,
    revoking,
    disabled,
    onRevoke
}: {
    grant: GrantView
    revoking: boolean
    disabled: boolean
    onRevoke: () => void
}) {
    const Icon = grant.delivery === "instant" ? RotateCcw : Ticket
    const { iconRef, textRef, marginTop } = useCapAlignedIcon<HTMLParagraphElement>(Icon)
    const revocable =
        grant.delivery === "banked" &&
        grant.revokedAt === null &&
        !grant.redeemed &&
        (grant.expiresAt === null || grant.expiresAt > Date.now())

    return (
        <li className="flex items-center gap-3 py-3 first:pt-0 last:pb-0">
            <div className="flex min-w-0 flex-1 items-start gap-2.5">
                <Icon
                    ref={iconRef}
                    className="size-4 shrink-0 text-muted-foreground"
                    style={{ marginTop }}
                />
                <div className="min-w-0 flex-1">
                    <p ref={textRef} className="font-medium text-sm leading-5">
                        {grant.label}
                    </p>
                    <p className="truncate text-muted-foreground text-xs">
                        {describeGrantMeta(grant)}
                    </p>
                </div>
            </div>
            {revocable && (
                <Button size="sm" variant="outline" disabled={disabled} onClick={onRevoke}>
                    {revoking && <Loader2 className="size-4 animate-spin" />}
                    Revoke
                </Button>
            )}
        </li>
    )
}

function GrantListSkeleton() {
    return (
        <div className="flex items-start gap-2.5">
            <Skeleton className="mt-0.5 size-4 shrink-0" />
            <div className="space-y-1.5">
                <Skeleton className="h-4 w-40" />
                <Skeleton className="h-3 w-28" />
            </div>
        </div>
    )
}

export function UsageResetGrantList({ grants }: { grants: GrantView[] | undefined }) {
    const revoke = useMutation(api.usage_resets.revokeUsageReset)
    const [revokingId, setRevokingId] = useState<Id<"usageResetGrants"> | null>(null)

    if (grants === undefined) return <GrantListSkeleton />
    if (grants.length === 0) {
        return <p className="text-muted-foreground text-sm">No resets yet.</p>
    }

    const handleRevoke = async (grantId: Id<"usageResetGrants">) => {
        setRevokingId(grantId)
        try {
            await revoke({ grantId })
            toast.success("Banked Reset revoked")
        } catch (error) {
            toast.error(errorText(error, "Could not revoke the Banked Reset."))
        } finally {
            setRevokingId(null)
        }
    }

    return (
        <ul className="divide-y">
            {grants.map((grant) => (
                <GrantRow
                    key={grant.id}
                    grant={grant}
                    revoking={revokingId === grant.id}
                    disabled={revokingId !== null}
                    onRevoke={() => void handleRevoke(grant.id)}
                />
            ))}
        </ul>
    )
}

const formatUsd = (usd: number) => `$${usd.toFixed(2)}`

function UsageValue({ children }: { children: ReactNode }) {
    return children === undefined ? (
        <dd className="py-0.5">
            <Skeleton className="h-4 w-24" />
        </dd>
    ) : (
        <dd className="tabular-nums">{children}</dd>
    )
}

// The form needs no data, so only the figures and the history wait on the query.
export function UserUsageResets({ authUserId }: { authUserId: string }) {
    const data = useQuery(api.usage_resets.getUserUsageResets, { authUserId })

    if (data === null) {
        return <p className="text-muted-foreground text-sm">This account no longer exists.</p>
    }

    const usage = data?.usage
    return (
        <div className="space-y-6">
            <dl className="grid grid-cols-[auto_minmax(0,1fr)] gap-x-4 gap-y-1.5 text-sm">
                <dt className="text-muted-foreground">Plan</dt>
                <UsageValue>{data && (data.plan === "pro" ? "Pro" : "Free")}</UsageValue>
                <dt className="text-muted-foreground">5-hour</dt>
                <UsageValue>
                    {usage &&
                        `${formatUsd(usage.fiveHourUsedUsd)} of ${formatUsd(usage.fiveHourLimitUsd)}`}
                </UsageValue>
                <dt className="text-muted-foreground">Monthly</dt>
                <UsageValue>
                    {usage &&
                        `${formatUsd(usage.monthlyUsedUsd)} of ${formatUsd(usage.monthlyLimitUsd)}`}
                </UsageValue>
                <dt className="text-muted-foreground">Unused Banked Resets</dt>
                <UsageValue>{data?.openTicketCount}</UsageValue>
            </dl>
            <UsageResetGrantForm target={{ kind: "user", authUserId }} />
            <UsageResetGrantList grants={data?.grants} />
        </div>
    )
}

export function GlobalUsageResetHistory() {
    const grants = useQuery(api.usage_resets.listRecentGlobalUsageResets, {})
    return <UsageResetGrantList grants={grants} />
}
