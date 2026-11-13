import { Button } from "@/components/ui/button"
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle
} from "@/components/ui/dialog"
import { Skeleton } from "@/components/ui/skeleton"
import { Switch } from "@/components/ui/switch"
import { api } from "@/convex/_generated/api"
import {
    MODERATION_SEED_DOMAIN,
    MODERATION_SEED_SCENARIOS,
    type ModerationSeedScenarioId
} from "@/convex/lib/seeds/moderation"
import { useSession } from "@/hooks/auth-hooks"
import { useCapAlignedIcon } from "@/hooks/use-cap-aligned-icon"
import { cn } from "@/lib/utils"
import { Link } from "@tanstack/react-router"
import { useMutation, useQuery } from "convex/react"
import type { FunctionReturnType } from "convex/server"
import { ConvexError } from "convex/values"
import {
    AlertTriangle,
    History,
    Loader2,
    type LucideIcon,
    MailWarning,
    RotateCcw,
    Scale,
    TimerOff
} from "lucide-react"
import { useState } from "react"
import { toast } from "sonner"

export type ModerationSeedState = FunctionReturnType<
    typeof api.dev_moderation_seed.getModerationSeedState
>

type ScenarioStatus = Extract<
    ModerationSeedState,
    { available: true }
>["scenarios"][number]["status"]

// The same icons the moderation page uses for what each scenario puts on it.
const SCENARIO_ICONS: Record<ModerationSeedScenarioId, LucideIcon> = {
    strike_limit: AlertTriangle,
    appeals: Scale,
    failed_deliveries: MailWarning,
    suspension: TimerOff,
    history: History
}

const ALL_SCENARIOS = MODERATION_SEED_SCENARIOS.map((scenario) => scenario.id)

const UNAVAILABLE_COPY = {
    not_operator: "Sign in as a moderator to seed this deployment.",
    disabled: "Seeding is off on this Convex deployment. Set DEV_CREDIT_LAB_ENABLED=1 to use it."
} as const

function ScenarioRow({
    scenario,
    status,
    working,
    disabled,
    onSeed,
    onClear
}: {
    scenario: (typeof MODERATION_SEED_SCENARIOS)[number]
    // Undefined while the deployment's state loads.
    status: ScenarioStatus | undefined
    working: boolean
    disabled: boolean
    onSeed: () => void
    onClear: () => void
}) {
    const Icon = SCENARIO_ICONS[scenario.id]
    const { iconRef, textRef, marginTop } = useCapAlignedIcon<HTMLParagraphElement>(Icon)
    const seeded = status !== undefined && status !== "absent"

    return (
        <li className="flex items-start gap-3 py-3">
            <Icon
                ref={iconRef}
                className={cn(
                    "size-4 shrink-0",
                    seeded ? "text-foreground" : "text-muted-foreground"
                )}
                style={{ marginTop }}
            />
            <div className="min-w-0 flex-1">
                <p ref={textRef} className="font-medium text-sm leading-5">
                    {scenario.title}
                </p>
                <p className="text-muted-foreground text-xs">{scenario.description}</p>
            </div>
            <div className="flex shrink-0 items-center gap-2 self-center">
                {working ? (
                    <Loader2 className="size-4 animate-spin text-muted-foreground" />
                ) : (
                    // Offered once the scenario's cases have been acted on or have run out.
                    status === "changed" && (
                        <Button
                            type="button"
                            size="sm"
                            variant="ghost"
                            disabled={disabled}
                            onClick={onSeed}
                            className="h-7 rounded-[var(--radius-md)] px-2 text-xs"
                        >
                            <RotateCcw className="size-3.5" />
                            Restore
                        </Button>
                    )
                )}
                {status === undefined ? (
                    <Skeleton className="h-5 w-9 rounded-full" />
                ) : (
                    <Switch
                        aria-label={scenario.title}
                        checked={seeded}
                        disabled={disabled}
                        onCheckedChange={(checked) => (checked ? onSeed() : onClear())}
                    />
                )}
            </div>
        </li>
    )
}

// Split from the data so the dialog can be looked at with fixed states.
export function ModerationSeedDialogView({
    open,
    onOpenChange,
    state,
    workingOn,
    onSeed,
    onClear
}: {
    open: boolean
    onOpenChange: (open: boolean) => void
    // Undefined while loading.
    state: ModerationSeedState | undefined
    // The scenarios a seed or clear is running for.
    workingOn: readonly ModerationSeedScenarioId[]
    onSeed: (scenarioIds: ModerationSeedScenarioId[]) => void
    onClear: (scenarioIds: ModerationSeedScenarioId[]) => void
}) {
    const busy = workingOn.length > 0
    const statusOf = (id: ModerationSeedScenarioId) =>
        state?.available
            ? state.scenarios.find((scenario) => scenario.id === id)?.status
            : undefined
    const statuses = ALL_SCENARIOS.map(statusOf)
    const anySeeded = statuses.some((status) => status === "fresh" || status === "changed")
    const allFresh = statuses.every((status) => status === "fresh")

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent
                data-dev-audit-ignore
                className="gap-0 rounded-[var(--radius-xl)] p-5 sm:max-w-lg"
            >
                <DialogHeader>
                    <DialogTitle>Moderation seed</DialogTitle>
                    <DialogDescription>
                        Fake accounts on {MODERATION_SEED_DOMAIN} for the moderation page. Nothing
                        is emailed.
                    </DialogDescription>
                </DialogHeader>

                {state && !state.available ? (
                    <p className="pt-4 text-muted-foreground text-sm">
                        {UNAVAILABLE_COPY[state.reason]}
                    </p>
                ) : (
                    <>
                        <ul className="divide-y pt-2">
                            {MODERATION_SEED_SCENARIOS.map((scenario) => (
                                <ScenarioRow
                                    key={scenario.id}
                                    scenario={scenario}
                                    status={statusOf(scenario.id)}
                                    working={workingOn.includes(scenario.id)}
                                    disabled={busy}
                                    onSeed={() => onSeed([scenario.id])}
                                    onClear={() => onClear([scenario.id])}
                                />
                            ))}
                        </ul>
                        <div className="flex flex-wrap items-center gap-2 pt-3">
                            <Button asChild type="button" size="sm" variant="ghost">
                                <Link to="/settings/moderation" onClick={() => onOpenChange(false)}>
                                    Open Moderation
                                </Link>
                            </Button>
                            <div className="ml-auto flex gap-2">
                                {anySeeded && (
                                    <Button
                                        type="button"
                                        size="sm"
                                        variant="outline"
                                        disabled={busy || !state}
                                        onClick={() => onClear(ALL_SCENARIOS)}
                                    >
                                        Clear all
                                    </Button>
                                )}
                                {/* Nothing to do once every scenario is seeded and untouched. */}
                                {!allFresh && (
                                    <Button
                                        type="button"
                                        size="sm"
                                        disabled={busy || !state}
                                        onClick={() => onSeed(ALL_SCENARIOS)}
                                    >
                                        {anySeeded ? "Restore all" : "Seed all"}
                                    </Button>
                                )}
                            </div>
                        </div>
                    </>
                )}
            </DialogContent>
        </Dialog>
    )
}

const errorText = (error: unknown) =>
    error instanceof ConvexError && typeof error.data === "string"
        ? error.data
        : "Could not update the seed data."

export function ModerationSeedDialog({
    open,
    onOpenChange
}: {
    open: boolean
    onOpenChange: (open: boolean) => void
}) {
    const { data: session } = useSession()
    const signedIn = Boolean(session?.user)
    const state = useQuery(
        api.dev_moderation_seed.getModerationSeedState,
        open && signedIn ? {} : "skip"
    )
    const seed = useMutation(api.dev_moderation_seed.seedModerationScenarios)
    const clear = useMutation(api.dev_moderation_seed.clearModerationScenarios)
    const [workingOn, setWorkingOn] = useState<ModerationSeedScenarioId[]>([])

    const run = async (
        action: typeof seed | typeof clear,
        scenarioIds: ModerationSeedScenarioId[]
    ) => {
        setWorkingOn(scenarioIds)
        try {
            await action({ scenarioIds })
        } catch (error) {
            toast.error(errorText(error))
        } finally {
            setWorkingOn([])
        }
    }

    return (
        <ModerationSeedDialogView
            open={open}
            onOpenChange={onOpenChange}
            // Signed out, the query never runs, and only a moderator can seed anyway.
            state={signedIn ? state : { available: false, reason: "not_operator" }}
            workingOn={workingOn}
            onSeed={(scenarioIds) => void run(seed, scenarioIds)}
            onClear={(scenarioIds) => void run(clear, scenarioIds)}
        />
    )
}
