import { Button } from "@/components/ui/button"
import { api } from "@/convex/_generated/api"
import type { Id } from "@/convex/_generated/dataModel"
import { getPersistentSandboxTitle } from "@/lib/persistent-sandbox-title"
import { cn } from "@/lib/utils"
import type { UIToolInvocation } from "ai"
import { useAction, useMutation, useQuery } from "convex/react"
import { CircleAlert, Clock3, Loader2, Play, Square, X } from "lucide-react"
import { type CSSProperties, memo, useEffect, useState } from "react"
import { toast } from "sonner"
import { SPOTLIGHT_CARD_CLASS, SpotlightHeader } from "./spotlight-frame"
import { formatTimerClock } from "./spotlight-timer"

type PersistentSandboxInvocation = UIToolInvocation<{
    input: unknown
    output: unknown
}>

type PersistentSandboxOutput = {
    success?: boolean
    kind?: "persistent_sandbox_request"
    status?:
        | "pending_confirmation"
        | "provisioning"
        | "active"
        | "stopping"
        | "stopped"
        | "expired"
        | "failed"
        | "denied"
    cardId?: string
    sandboxId?: Id<"persistentSandboxes">
    title?: string
    purpose?: string
    runtime?: "node" | "python"
    runtimeVersion?: string
    ttlMinutes?: number
    expiresAt?: number
    confirmationExpiresAt?: number
    error?: string
}

/** Stored statuses, plus "allowing" while the user's Allow is in flight. */
export type PersistentSandboxCardStatus =
    | NonNullable<PersistentSandboxOutput["status"]>
    | "allowing"

export type PersistentSandboxCardModel = {
    status: PersistentSandboxCardStatus
    title?: string
    purpose?: string
    runtime?: "node" | "python"
    runtimeVersion?: string
    ttlMinutes: number
    /** Time left while active. */
    remainingMs?: number
    error?: string
}

export type PersistentSandboxCardHandlers = {
    onAllow?: () => void
    onDeny?: () => void
    onStop?: () => void
}

const ENDING_SOON_MS = 60_000

const getErrorMessage = (error: unknown, fallback: string) =>
    error instanceof Error ? error.message : fallback

// A request ends without a card when the call errors, the tool refuses it, or the reply
// stops before a result arrives; each is final, so none of them may keep spinning.
const getRequestFailure = (
    toolInvocation: Pick<PersistentSandboxInvocation, "state"> & { output?: unknown },
    isStreaming: boolean,
    hasRequest: boolean
) => {
    const { state } = toolInvocation
    if (state === "output-error" || state === "output-denied") return "Couldn't request a workspace"
    if (state === "output-available" && !hasRequest) {
        const output = toolInvocation.output as { code?: unknown } | null | undefined
        return output?.code === "persistent_sandbox_already_active"
            ? "A workspace is already running"
            : "Couldn't request a workspace"
    }
    if (!isStreaming && (state === "input-streaming" || state === "input-available"))
        return "Workspace request stopped"
    return undefined
}

const isPending = (status: PersistentSandboxCardStatus) =>
    status === "pending_confirmation" || status === "allowing"

const isRunning = (status: PersistentSandboxCardStatus) =>
    status === "active" || status === "stopping"

/** Finished for good: nothing left to decide, start, or stop. */
const isSettled = (status: PersistentSandboxCardStatus) =>
    status === "stopped" || status === "expired" || status === "denied" || status === "failed"

const isEndingSoon = (model: PersistentSandboxCardModel) =>
    model.status === "active" &&
    model.remainingMs !== undefined &&
    model.remainingMs <= ENDING_SOON_MS

const remainingSeconds = (model: PersistentSandboxCardModel) =>
    Math.max(0, Math.ceil((model.remainingMs ?? 0) / 1000))

/** Share of the budget still ahead: full until it starts, draining while it runs. */
const remainingFraction = (model: PersistentSandboxCardModel) =>
    isPending(model.status) || model.status === "provisioning"
        ? 1
        : isRunning(model.status) && model.remainingMs !== undefined
          ? Math.min(1, model.remainingMs / (model.ttlMinutes * 60_000))
          : 0

const coverPattern = (settled: boolean): CSSProperties => ({
    backgroundImage: [
        "radial-gradient(color-mix(in oklab, var(--chart-1) 45%, transparent) 1px, transparent 1.5px)",
        "linear-gradient(135deg, color-mix(in oklab, var(--chart-1) 24%, var(--card)), color-mix(in oklab, var(--chart-1) 4%, var(--card)))"
    ].join(", "),
    backgroundSize: "14px 14px, 100% 100%",
    filter: settled ? "grayscale(1)" : undefined,
    opacity: settled ? 0.6 : undefined
})

/**
 * The one pill on the cover. It holds the budget before approval, the live countdown while
 * running, and the outcome after, so time and status never compete for the corner.
 */
function CoverPill({ model }: { model: PersistentSandboxCardModel }) {
    const { status } = model
    const content =
        status === "pending_confirmation"
            ? { icon: Clock3, label: `${model.ttlMinutes} min`, tone: "" }
            : status === "allowing" || status === "provisioning"
              ? { icon: Loader2, label: "Starting", tone: "text-primary", spin: true }
              : status === "active"
                ? {
                      icon: Clock3,
                      label: formatTimerClock(remainingSeconds(model)),
                      tone: isEndingSoon(model) ? "text-warning" : "text-primary",
                      clock: true
                  }
                : status === "stopping"
                  ? { icon: Loader2, label: "Stopping", tone: "text-primary", spin: true }
                  : status === "failed"
                    ? { icon: CircleAlert, label: "Failed", tone: "text-destructive" }
                    : status === "denied"
                      ? { icon: X, label: "Denied", tone: "text-muted-foreground" }
                      : status === "expired"
                        ? { icon: Clock3, label: "Expired", tone: "text-muted-foreground" }
                        : { icon: Square, label: "Stopped", tone: "text-muted-foreground" }
    const Icon = content.icon

    return (
        <span
            className={cn(
                "spotlight-glass absolute top-3 right-3 inline-flex h-7 items-center gap-1.5 rounded-[var(--radius-md)] px-2 font-medium text-xs",
                content.tone
            )}
            aria-label={"clock" in content ? `${content.label} remaining` : undefined}
        >
            <Icon
                className={cn("size-3.5", "spin" in content && "animate-spin")}
                aria-hidden="true"
            />
            <span className={cn("clock" in content && "font-mono tabular-nums")}>
                {content.label}
            </span>
        </span>
    )
}

function CardActions({
    model,
    handlers,
    disabled
}: {
    model: PersistentSandboxCardModel
    handlers?: PersistentSandboxCardHandlers
    disabled?: boolean
}) {
    // Every state between a click and its outcome keeps the row it started from, so the
    // card never loses its buttons mid-transition: Allow spins until the workspace runs.
    if (isPending(model.status) || model.status === "provisioning") {
        const allowing = model.status !== "pending_confirmation"
        return (
            <div className="flex items-center justify-end gap-2 px-5 pt-4 pb-5">
                <Button
                    type="button"
                    size="sm"
                    variant="ghost"
                    className="rounded-[var(--radius-md)]"
                    disabled={allowing || disabled}
                    onClick={handlers?.onDeny}
                >
                    Deny
                </Button>
                <Button
                    type="button"
                    size="sm"
                    className="rounded-[var(--radius-md)] px-5"
                    disabled={allowing || disabled}
                    onClick={handlers?.onAllow}
                >
                    {allowing ? (
                        <Loader2 className="mr-1.5 size-3.5 animate-spin" aria-hidden="true" />
                    ) : (
                        <Play className="mr-1.5 size-3.5" aria-hidden="true" />
                    )}
                    Allow
                </Button>
            </div>
        )
    }
    if (isRunning(model.status)) {
        const stopping = model.status === "stopping"
        return (
            <div className="flex items-center justify-end gap-2 px-5 pt-4 pb-5">
                <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    className="rounded-[var(--radius-md)] px-5"
                    disabled={stopping || disabled}
                    onClick={handlers?.onStop}
                >
                    {stopping ? (
                        <Loader2 className="mr-1.5 size-3.5 animate-spin" aria-hidden="true" />
                    ) : (
                        <Square className="mr-1.5 size-3 fill-current" aria-hidden="true" />
                    )}
                    Stop
                </Button>
            </div>
        )
    }
    return <div className="pb-5" />
}

/**
 * The workspace card. A recipe-style cover anchors it: the runtime version set large on a
 * chart-1 field, one glass pill for time and status, and the budget draining along its edge.
 */
export function PersistentSandboxCardView({
    model,
    handlers,
    disabled,
    className
}: {
    model: PersistentSandboxCardModel
    handlers?: PersistentSandboxCardHandlers
    /** Blocks Allow, Deny, and Stop, e.g. while another action is in flight. */
    disabled?: boolean
    className?: string
}) {
    const settled = isSettled(model.status)
    const title = getPersistentSandboxTitle(model.title, model.runtime)

    return (
        <section
            className={cn(
                "not-prose w-full max-w-md overflow-hidden",
                SPOTLIGHT_CARD_CLASS,
                className
            )}
            aria-label={title}
        >
            <div className="relative h-36 overflow-hidden border-border border-b">
                <div
                    aria-hidden="true"
                    className="absolute inset-0 transition-[filter,opacity] duration-500"
                    style={coverPattern(settled)}
                />
                <div
                    className={cn(
                        "absolute bottom-5 left-5 transition-colors",
                        settled ? "text-muted-foreground" : "text-foreground"
                    )}
                >
                    <div className="font-medium text-xs opacity-70">
                        {model.runtime === "node" ? "Node.js" : "Python"}
                    </div>
                    <div className="font-mono font-semibold text-5xl leading-none tracking-tighter">
                        {model.runtimeVersion ?? (model.runtime === "node" ? "js" : "py")}
                    </div>
                </div>
                <CoverPill model={model} />
                <div
                    aria-hidden="true"
                    className={cn(
                        "absolute bottom-0 left-0 h-1 w-full origin-left transition-[transform,background-color] duration-1000 ease-linear",
                        isEndingSoon(model)
                            ? "bg-warning"
                            : model.status === "provisioning" || model.status === "allowing"
                              ? "bg-primary/40"
                              : "bg-primary"
                    )}
                    style={{ transform: `scaleX(${remainingFraction(model)})` }}
                />
            </div>
            <SpotlightHeader
                className="pt-4"
                title={
                    <span className="block truncate" title={title}>
                        {title}
                    </span>
                }
                description={model.purpose}
            />
            {model.error && (
                <p className="mx-5 mt-3 rounded-[var(--radius-md)] border border-destructive/30 bg-destructive/10 px-3 py-2 text-destructive text-sm">
                    {model.error}
                </p>
            )}
            <CardActions model={model} handlers={handlers} disabled={disabled} />
        </section>
    )
}

/** The Spotlight loading row, before the request's result arrives. */
export function PersistentSandboxCardPreparing({ className }: { className?: string }) {
    return (
        <div
            className={cn(
                "not-prose flex w-full max-w-md items-center gap-2 px-5 py-4 text-muted-foreground text-sm",
                SPOTLIGHT_CARD_CLASS,
                className
            )}
        >
            <Loader2 className="size-4 animate-spin text-primary" aria-hidden="true" />
            Preparing workspace
        </div>
    )
}

/** A request that never produced a card. */
export function PersistentSandboxRequestFailure({
    label,
    className
}: {
    label: string
    className?: string
}) {
    return (
        <div
            className={cn("not-prose flex items-center gap-2 text-destructive text-sm", className)}
            role="status"
        >
            <CircleAlert className="size-4 shrink-0" aria-hidden="true" />
            <span className="font-medium">{label}</span>
        </div>
    )
}

export const PersistentSandboxCard = memo(
    ({
        toolInvocation,
        threadId,
        messageId,
        isStreaming = false
    }: {
        toolInvocation: PersistentSandboxInvocation
        threadId?: string
        messageId?: string
        isStreaming?: boolean
    }) => {
        const confirm = useAction(api.persistent_sandboxes_node.confirmPersistentSandboxRequest)
        const kill = useAction(api.persistent_sandboxes_node.killMyPersistentSandbox)
        const deny = useMutation(api.persistent_sandboxes.denyPersistentSandboxRequest)
        const [acting, setActing] = useState<"allow" | "deny" | "stop">()
        const [now, setNow] = useState(Date.now())
        const localOutput =
            toolInvocation.state === "output-available" &&
            typeof toolInvocation.output === "object" &&
            toolInvocation.output !== null &&
            (toolInvocation.output as PersistentSandboxOutput).kind === "persistent_sandbox_request"
                ? (toolInvocation.output as PersistentSandboxOutput)
                : undefined
        const persistedOutput = useQuery(
            api.messages.getPersistentSandboxCardResult,
            localOutput?.cardId && threadId && messageId
                ? {
                      threadId: threadId as Id<"threads">,
                      messageId,
                      toolCallId: toolInvocation.toolCallId,
                      cardId: localOutput.cardId
                  }
                : "skip"
        ) as PersistentSandboxOutput | null | undefined
        const output = persistedOutput ?? localOutput

        const rawStatus = output?.status ?? "pending_confirmation"
        const status =
            rawStatus === "pending_confirmation" &&
            output?.confirmationExpiresAt &&
            output.confirmationExpiresAt <= now
                ? "expired"
                : rawStatus

        useEffect(() => {
            const shouldTick =
                (rawStatus === "active" && Boolean(output?.expiresAt)) ||
                (rawStatus === "pending_confirmation" && Boolean(output?.confirmationExpiresAt))
            if (!shouldTick) return
            const interval = window.setInterval(() => setNow(Date.now()), 1_000)
            return () => window.clearInterval(interval)
        }, [output?.confirmationExpiresAt, output?.expiresAt, rawStatus])

        const failure = getRequestFailure(toolInvocation, isStreaming, Boolean(localOutput))
        if (failure) return <PersistentSandboxRequestFailure label={failure} className="my-3" />
        if (!output) return <PersistentSandboxCardPreparing className="my-3" />

        const canAct = Boolean(output.cardId && threadId && messageId) && !acting
        const cardIdentifiers = () => ({
            threadId: threadId as Id<"threads">,
            messageId: messageId as string,
            toolCallId: toolInvocation.toolCallId,
            cardId: output.cardId as string
        })

        const handleConfirm = async () => {
            if (!canAct) return
            setActing("allow")
            try {
                await confirm(cardIdentifiers())
                toast.success("Workspace started")
            } catch (error) {
                toast.error(getErrorMessage(error, "Couldn't start the workspace"))
            } finally {
                setActing(undefined)
            }
        }

        const handleDeny = async () => {
            if (!canAct) return
            setActing("deny")
            try {
                await deny(cardIdentifiers())
            } catch (error) {
                toast.error(getErrorMessage(error, "Couldn't deny the workspace"))
            } finally {
                setActing(undefined)
            }
        }

        const handleStop = async () => {
            if (!output.sandboxId || acting) return
            setActing("stop")
            try {
                await kill({ sandboxId: output.sandboxId })
                toast.success("Workspace stopped")
            } catch (error) {
                toast.error(getErrorMessage(error, "Couldn't stop the workspace"))
            } finally {
                setActing(undefined)
            }
        }

        const viewStatus: PersistentSandboxCardStatus =
            status === "pending_confirmation" && acting === "allow"
                ? "allowing"
                : status === "active" && acting === "stop"
                  ? "stopping"
                  : status

        return (
            <PersistentSandboxCardView
                className="my-3"
                model={{
                    status: viewStatus,
                    title: output.title,
                    purpose: output.purpose,
                    runtime: output.runtime,
                    runtimeVersion: output.runtimeVersion,
                    ttlMinutes: output.ttlMinutes ?? 3,
                    remainingMs:
                        status === "active" && output.expiresAt
                            ? output.expiresAt - now
                            : undefined,
                    error: output.error
                }}
                handlers={{
                    onAllow: () => void handleConfirm(),
                    onDeny: () => void handleDeny(),
                    onStop: () => void handleStop()
                }}
                disabled={isPending(viewStatus) ? !canAct : !output.sandboxId || Boolean(acting)}
            />
        )
    }
)

PersistentSandboxCard.displayName = "PersistentSandboxCard"
