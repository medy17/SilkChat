import { Button } from "@/components/ui/button"
import { api } from "@/convex/_generated/api"
import type { Id } from "@/convex/_generated/dataModel"
import type { UIToolInvocation } from "ai"
import { useAction, useMutation } from "convex/react"
import { Box, Clock3, Loader2, OctagonX, ShieldCheck, X } from "lucide-react"
import { memo, useEffect, useState } from "react"
import { toast } from "sonner"

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
    purpose?: string
    runtime?: "node" | "python"
    runtimeVersion?: string
    ttlMinutes?: number
    expiresAt?: number
    confirmationExpiresAt?: number
    error?: string
}

const getErrorMessage = (error: unknown, fallback: string) =>
    error instanceof Error ? error.message : fallback

const formatRemaining = (expiresAt: number | undefined, now: number) => {
    if (!expiresAt) return undefined
    const seconds = Math.max(0, Math.ceil((expiresAt - now) / 1000))
    const minutes = Math.floor(seconds / 60)
    const remainder = seconds % 60
    return `${minutes}:${remainder.toString().padStart(2, "0")}`
}

export const PersistentSandboxCard = memo(
    ({
        toolInvocation,
        threadId,
        messageId
    }: {
        toolInvocation: PersistentSandboxInvocation
        threadId?: string
        messageId?: string
    }) => {
        const confirm = useAction(api.persistent_sandboxes_node.confirmPersistentSandboxRequest)
        const kill = useAction(api.persistent_sandboxes_node.killMyPersistentSandbox)
        const deny = useMutation(api.persistent_sandboxes.denyPersistentSandboxRequest)
        const [isActing, setIsActing] = useState(false)
        const [now, setNow] = useState(Date.now())
        const output =
            toolInvocation.state === "output-available" &&
            typeof toolInvocation.output === "object" &&
            toolInvocation.output !== null &&
            (toolInvocation.output as PersistentSandboxOutput).kind === "persistent_sandbox_request"
                ? (toolInvocation.output as PersistentSandboxOutput)
                : undefined

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

        if (!output) {
            return (
                <div className="my-3 flex items-center gap-2 rounded-[var(--radius-lg)] border bg-card p-3 text-muted-foreground text-sm">
                    <Loader2 className="size-4 animate-spin" aria-hidden="true" />
                    Preparing persistent workspace request
                </div>
            )
        }

        const canDecide =
            status === "pending_confirmation" &&
            Boolean(output.cardId && threadId && messageId) &&
            !isActing
        const remaining = formatRemaining(output.expiresAt, now)

        const handleConfirm = async () => {
            if (!output.cardId || !threadId || !messageId) return
            setIsActing(true)
            try {
                await confirm({
                    threadId: threadId as Id<"threads">,
                    messageId,
                    toolCallId: toolInvocation.toolCallId,
                    cardId: output.cardId
                })
                toast.success("Persistent sandbox started")
            } catch (error) {
                toast.error(getErrorMessage(error, "Failed to start persistent sandbox"))
            } finally {
                setIsActing(false)
            }
        }

        const handleDeny = async () => {
            if (!output.cardId || !threadId || !messageId) return
            setIsActing(true)
            try {
                await deny({
                    threadId: threadId as Id<"threads">,
                    messageId,
                    toolCallId: toolInvocation.toolCallId,
                    cardId: output.cardId
                })
            } catch (error) {
                toast.error(getErrorMessage(error, "Failed to deny persistent sandbox"))
            } finally {
                setIsActing(false)
            }
        }

        const handleKill = async () => {
            if (!output.sandboxId) return
            setIsActing(true)
            try {
                await kill({ sandboxId: output.sandboxId })
                toast.success("Persistent sandbox killed")
            } catch (error) {
                toast.error(getErrorMessage(error, "Failed to kill persistent sandbox"))
            } finally {
                setIsActing(false)
            }
        }

        return (
            <section
                className="not-prose my-3 w-full max-w-md overflow-hidden rounded-[var(--radius-xl)] border bg-card shadow-sm"
                aria-label="Persistent sandbox request"
            >
                <div className="flex items-start gap-3 p-4">
                    <div className="flex size-9 shrink-0 items-center justify-center rounded-[var(--radius-md)] bg-primary/10 text-primary">
                        <Box className="size-4" aria-hidden="true" />
                    </div>
                    <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                            <h3 className="font-medium text-sm">Persistent workspace</h3>
                            <span className="rounded-[var(--radius-sm)] bg-muted px-1.5 py-0.5 text-muted-foreground text-xs">
                                {output.runtime === "python" ? "Python" : "Node.js"}
                                {output.runtimeVersion ? ` ${output.runtimeVersion}` : ""}
                            </span>
                        </div>
                        <p className="mt-1 text-muted-foreground text-sm">{output.purpose}</p>
                        <div className="mt-2 flex items-center gap-1.5 text-muted-foreground text-xs">
                            <Clock3 className="size-3.5" aria-hidden="true" />
                            {status === "active" && remaining
                                ? `${remaining} remaining`
                                : `${output.ttlMinutes ?? 3} minute TTL`}
                        </div>
                        {output.error && (
                            <p className="mt-2 text-destructive text-xs">{output.error}</p>
                        )}
                    </div>
                </div>

                <div className="border-t bg-muted/10 p-3">
                    {status === "pending_confirmation" ? (
                        <div className="grid grid-cols-2 gap-2">
                            <Button
                                type="button"
                                variant="secondary"
                                disabled={!canDecide}
                                onClick={() => void handleDeny()}
                            >
                                <X className="size-4" aria-hidden="true" />
                                Deny
                            </Button>
                            <Button
                                type="button"
                                disabled={!canDecide}
                                onClick={() => void handleConfirm()}
                            >
                                {isActing ? (
                                    <Loader2 className="size-4 animate-spin" aria-hidden="true" />
                                ) : (
                                    <ShieldCheck className="size-4" aria-hidden="true" />
                                )}
                                Allow
                            </Button>
                        </div>
                    ) : status === "provisioning" ? (
                        <Button type="button" className="w-full" disabled>
                            <Loader2 className="size-4 animate-spin" aria-hidden="true" />
                            Starting workspace
                        </Button>
                    ) : status === "active" ? (
                        <Button
                            type="button"
                            variant="destructive"
                            className="w-full"
                            disabled={isActing}
                            onClick={() => void handleKill()}
                        >
                            {isActing ? (
                                <Loader2 className="size-4 animate-spin" aria-hidden="true" />
                            ) : (
                                <OctagonX className="size-4" aria-hidden="true" />
                            )}
                            Kill sandbox
                        </Button>
                    ) : status === "stopping" ? (
                        <Button type="button" className="w-full" disabled>
                            <Loader2 className="size-4 animate-spin" aria-hidden="true" />
                            Killing sandbox
                        </Button>
                    ) : (
                        <output className="flex h-9 items-center justify-center rounded-[var(--radius-md)] bg-muted px-3 text-muted-foreground text-sm">
                            {status === "denied"
                                ? "Denied"
                                : status === "expired"
                                  ? "Expired"
                                  : status === "failed"
                                    ? "Failed"
                                    : "Stopped"}
                        </output>
                    )}
                </div>
            </section>
        )
    }
)

PersistentSandboxCard.displayName = "PersistentSandboxCard"
