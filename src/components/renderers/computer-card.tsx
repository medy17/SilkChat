import { Codeblock } from "@/components/codeblock"
import {
    ComputerCover,
    ComputerDetailItem,
    ComputerDisclosure,
    type ComputerMarkTone
} from "@/components/computer-ui"
import { AnimatedCollapsible } from "@/components/ui/animated-collapsible"
import { Button } from "@/components/ui/button"
import { api } from "@/convex/_generated/api"
import type { Id } from "@/convex/_generated/dataModel"
import { COMPUTER_DEFAULT_NAME } from "@/convex/lib/computer_policy"
import type { MessageComputerRun } from "@/lib/message-computer-runs"
import { cn } from "@/lib/utils"
import type { UIToolInvocation } from "ai"
import { useAction, useMutation, useQuery } from "convex/react"
import { ChevronDown, CircleAlert, Loader2, Play } from "lucide-react"
import { memo, useState } from "react"
import { toast } from "sonner"
import { SPOTLIGHT_CARD_CLASS, SpotlightHeader } from "./spotlight-frame"

type ComputerRequestOutput = {
    kind?: "computer_request"
    status?: "pending_confirmation" | "provisioning" | "ready" | "failed" | "denied" | "expired"
    cardId?: string
    purpose?: string
    confirmationExpiresAt?: number
    error?: string
}

const REQUEST_STATUS: Record<
    NonNullable<ComputerRequestOutput["status"]>,
    { label: string; tone: ComputerMarkTone }
> = {
    pending_confirmation: { label: "Not set up", tone: "quiet" },
    provisioning: { label: "Setting up", tone: "pulse" },
    ready: { label: "Ready", tone: "active" },
    failed: { label: "Failed", tone: "problem" },
    denied: { label: "Declined", tone: "quiet" },
    expired: { label: "Expired", tone: "quiet" }
}

const getErrorMessage = (error: unknown, fallback: string) =>
    error instanceof Error ? error.message : fallback

const useComputerName = () => useQuery(api.computers.getMyComputer)?.name ?? COMPUTER_DEFAULT_NAME

function ComputerTitle({ name }: { name: string }) {
    return <p className="truncate font-semibold text-xl tracking-tight">{name}</p>
}

export const ComputerRequestCard = memo(
    ({
        toolInvocation,
        threadId,
        messageId
    }: {
        toolInvocation: UIToolInvocation<{ input: unknown; output: unknown }>
        threadId?: string
        messageId?: string
    }) => {
        const confirm = useAction(api.computers_node.confirmComputerRequest)
        const deny = useMutation(api.computers.denyComputerRequest)
        const name = useComputerName()
        const [acting, setActing] = useState<"allow" | "decline" | null>(null)
        const [allowedHere, setAllowedHere] = useState(false)
        const localOutput =
            toolInvocation.state === "output-available" &&
            (toolInvocation.output as ComputerRequestOutput | null)?.kind === "computer_request"
                ? (toolInvocation.output as ComputerRequestOutput)
                : undefined
        const persisted = useQuery(
            api.computers.getComputerCardResult,
            localOutput?.cardId && threadId && messageId
                ? {
                      threadId: threadId as Id<"threads">,
                      messageId,
                      toolCallId: toolInvocation.toolCallId,
                      cardId: localOutput.cardId
                  }
                : "skip"
        ) as ComputerRequestOutput | null | undefined
        const output = persisted ?? localOutput
        if (!output?.cardId) return null

        const identifiers = {
            threadId: threadId as Id<"threads">,
            messageId: messageId as string,
            toolCallId: toolInvocation.toolCallId,
            cardId: output.cardId
        }
        const rawStatus = output.status ?? "pending_confirmation"
        const expired =
            rawStatus === "pending_confirmation" &&
            Boolean(output.confirmationExpiresAt) &&
            (output.confirmationExpiresAt as number) <= Date.now()
        const status = expired ? "expired" : acting === "allow" ? "provisioning" : rawStatus
        const canAct =
            status === "pending_confirmation" && !acting && Boolean(threadId && messageId)
        const asking = status === "pending_confirmation" || status === "provisioning"

        const act = async (
            kind: "allow" | "decline",
            run: () => Promise<unknown>,
            fallback: string
        ) => {
            setActing(kind)
            try {
                await run()
            } catch (error) {
                toast.error(getErrorMessage(error, fallback))
            } finally {
                setActing(null)
            }
        }

        return (
            <section
                className={cn("not-prose my-3 w-full overflow-hidden", SPOTLIGHT_CARD_CLASS)}
                aria-label={name}
            >
                <ComputerCover
                    className="h-20"
                    compact
                    title={<ComputerTitle name={name} />}
                    status={REQUEST_STATUS[status].label}
                    tone={REQUEST_STATUS[status].tone}
                />
                {asking ? (
                    <>
                        <SpotlightHeader
                            className="pt-4"
                            title="Give Silky a computer?"
                            action={
                                <>
                                    <Button
                                        type="button"
                                        size="sm"
                                        variant="ghost"
                                        className="rounded-[var(--radius-md)]"
                                        disabled={!canAct}
                                        onClick={() =>
                                            void act(
                                                "decline",
                                                () => deny(identifiers),
                                                "Couldn't decline"
                                            )
                                        }
                                    >
                                        Not now
                                    </Button>
                                    <Button
                                        type="button"
                                        size="sm"
                                        className="rounded-[var(--radius-md)] px-5"
                                        disabled={!canAct}
                                        onClick={() =>
                                            void act(
                                                "allow",
                                                async () => {
                                                    await confirm(identifiers)
                                                    setAllowedHere(true)
                                                },
                                                "Couldn't set up the computer"
                                            )
                                        }
                                    >
                                        {status === "provisioning" ? (
                                            <Loader2
                                                className="size-3.5 animate-spin"
                                                aria-hidden="true"
                                            />
                                        ) : (
                                            <Play className="size-3.5" aria-hidden="true" />
                                        )}
                                        Allow
                                    </Button>
                                </>
                            }
                        />
                        <ComputerDisclosure label="Details" className="px-5 pt-3 pb-5">
                            <div className="space-y-1.5 text-muted-foreground text-xs">
                                {output.purpose && <p>{output.purpose}</p>}
                                <p>
                                    It sleeps when idle. Time awake and stored files use your
                                    credits.
                                </p>
                            </div>
                        </ComputerDisclosure>
                    </>
                ) : output.error ? (
                    <p className="px-5 py-4 text-destructive text-sm">{output.error}</p>
                ) : status === "ready" && allowedHere ? (
                    <p className="px-5 py-4 text-muted-foreground text-sm">
                        Send a message to pick up where Silky left off.
                    </p>
                ) : null}
            </section>
        )
    }
)

ComputerRequestCard.displayName = "ComputerRequestCard"

const formatDuration = (durationMs: number) =>
    durationMs < 1_000
        ? `${Math.round(durationMs)} ms`
        : `${(durationMs / 1_000).toFixed(durationMs < 10_000 ? 1 : 0)} s`

function ComputerRunStep({ run }: { run: MessageComputerRun }) {
    const [open, setOpen] = useState(false)
    const output = [run.stdout, run.stderr].filter(Boolean).join("\n")

    return (
        <section>
            <button
                type="button"
                data-pause-chat-scroll-follow=""
                className="flex w-full items-center gap-2 px-5 py-2 text-left outline-none transition-colors hover:bg-muted/40 focus-visible:bg-muted/40"
                onClick={() => setOpen((shown) => !shown)}
                aria-expanded={open}
            >
                {run.status === "running" && (
                    <Loader2
                        className="size-3.5 shrink-0 animate-spin text-primary"
                        aria-hidden="true"
                    />
                )}
                {run.status === "failed" && (
                    <CircleAlert
                        className="size-3.5 shrink-0 text-destructive"
                        aria-hidden="true"
                    />
                )}
                <span className="min-w-0 flex-1 truncate font-medium text-sm">{run.title}</span>
                {typeof run.durationMs === "number" && (
                    <span className="shrink-0 text-muted-foreground text-xs">
                        {formatDuration(run.durationMs)}
                    </span>
                )}
                <ChevronDown
                    className={cn(
                        "size-4 shrink-0 text-muted-foreground transition-transform",
                        open && "rotate-180"
                    )}
                    aria-hidden="true"
                />
            </button>
            <AnimatedCollapsible open={open}>
                <div className="space-y-3 px-5 pt-1 pb-3">
                    {run.command && (
                        <Codeblock className="language-bash" default={{ wrap: true }}>
                            {run.command}
                        </Codeblock>
                    )}
                    {output && (
                        <Codeblock className="language-plaintext" default={{ wrap: true }}>
                            {output}
                        </Codeblock>
                    )}
                    {run.error && <p className="m-0 text-destructive text-sm">{run.error}</p>}
                    {typeof run.exitCode === "number" && (
                        <ComputerDisclosure label="Details">
                            <dl className="text-xs">
                                <ComputerDetailItem label="Exit code" value={run.exitCode} />
                            </dl>
                        </ComputerDisclosure>
                    )}
                </div>
            </AnimatedCollapsible>
        </section>
    )
}

/**
 * Every command from one reply, under the computer's cover. The reply owns the status: between
 * commands no step is running, but Silky isn't finished until the whole reply is.
 */
export const ComputerRunCard = memo(
    ({ runs, isStreaming }: { runs: MessageComputerRun[]; isStreaming: boolean }) => {
        const name = useComputerName()
        const running = runs.find((run) => run.status === "running")
        const working = isStreaming || Boolean(running)
        // The last step stays on show in the gaps, so the card doesn't jump between commands.
        const current = running ?? (working ? runs.at(-1) : undefined)
        const failed = !working && runs.at(-1)?.status === "failed"

        return (
            <section
                className={cn("not-prose mb-6 w-full overflow-hidden", SPOTLIGHT_CARD_CLASS)}
                aria-label={name}
            >
                <ComputerCover
                    className="h-20"
                    compact
                    title={<ComputerTitle name={name} />}
                    status={working ? "Working" : failed ? "Stopped" : "Finished"}
                    tone={working ? "active" : failed ? "problem" : "quiet"}
                />
                <div className="space-y-2 pt-4">
                    {current && (
                        <p className="flex items-center gap-2 px-5 text-sm">
                            <Loader2
                                className="size-3.5 shrink-0 animate-spin text-primary"
                                aria-hidden="true"
                            />
                            <span className="min-w-0 truncate">{current.title}</span>
                        </p>
                    )}
                    <ComputerDisclosure
                        label="Steps"
                        triggerClassName="px-5 pb-5 transition-[color,padding] aria-expanded:pb-0"
                    >
                        {runs.map((run) => (
                            <ComputerRunStep key={run.toolCallId} run={run} />
                        ))}
                    </ComputerDisclosure>
                </div>
            </section>
        )
    }
)

ComputerRunCard.displayName = "ComputerRunCard"
