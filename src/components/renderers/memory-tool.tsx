import { SupermemoryIcon } from "@/components/brand-icons"
import { Button } from "@/components/ui/button"
import { api } from "@/convex/_generated/api"
import type { Id } from "@/convex/_generated/dataModel"
import type { UIToolInvocation } from "ai"
import { useAction } from "convex/react"
import { AlertCircle, Check, Loader2, Pencil, Plus, Trash2, X } from "lucide-react"
import { memo, useState } from "react"
import { toast } from "sonner"

type MemoryToolInvocation = UIToolInvocation<{
    input: unknown
    output: unknown | undefined
}>

type PreparedMemoryChangeOutput = {
    success?: boolean
    code?: string
    kind?: "prepared_memory_change"
    status?: "pending_confirmation" | "executing" | "completed" | "failed" | "cancelled"
    cardId?: string
    operation?: "add" | "update" | "forget"
    content?: string
    memoryId?: string
    currentContent?: string
    newContent?: string
    reason?: string
    metadata?: {
        title?: string
        category?: string
        tags?: string[]
    }
    error?: string
}

const getErrorMessage = (error: unknown, fallback: string) => {
    if (error instanceof Error && error.message) return error.message
    return fallback
}

const operationDetails = {
    add: {
        title: "Remember this",
        description: "Add this to persistent memory",
        confirmLabel: "Remember",
        completedLabel: "Remembered",
        icon: Plus
    },
    update: {
        title: "Update memory",
        description: "Replace an existing memory with the corrected version",
        confirmLabel: "Update",
        completedLabel: "Updated",
        icon: Pencil
    },
    forget: {
        title: "Forget memory",
        description: "Remove this from persistent memory",
        confirmLabel: "Forget",
        completedLabel: "Forgotten",
        icon: Trash2
    }
} as const

export const MemoryToolRenderer = memo(
    ({
        toolInvocation,
        threadId,
        messageId
    }: {
        toolInvocation: MemoryToolInvocation
        threadId?: string
        messageId?: string
    }) => {
        const confirmMemoryChange = useAction(api.supermemory_node.confirmPreparedMemoryChange)
        const cancelMemoryChange = useAction(api.supermemory_node.cancelPreparedMemoryChange)
        const [isConfirming, setIsConfirming] = useState(false)
        const [isCancelling, setIsCancelling] = useState(false)

        const isLoading =
            toolInvocation.state === "input-streaming" || toolInvocation.state === "input-available"
        const output =
            toolInvocation.state === "output-available" &&
            typeof toolInvocation.output === "object" &&
            toolInvocation.output !== null
                ? (toolInvocation.output as PreparedMemoryChangeOutput)
                : undefined
        const preparedOutput = output?.kind === "prepared_memory_change" ? output : undefined

        if (isLoading) {
            return (
                <div className="my-3 flex w-full max-w-lg items-center gap-3 rounded-[var(--radius-xl)] border bg-card p-4 shadow-sm">
                    <Loader2 className="size-5 animate-spin text-primary" aria-hidden="true" />
                    <span className="text-muted-foreground text-sm">Preparing memory change</span>
                </div>
            )
        }

        const operation = preparedOutput?.operation
        if (!preparedOutput || !operation) {
            // A duplicate prepare is a no-op retry by the model, not a user-facing failure;
            // the original confirmation card is already visible above.
            if (output?.code === "duplicate_memory_change") return null

            const error = output?.error ?? "Could not prepare this memory change."
            return (
                <div
                    className="my-3 flex w-full max-w-lg items-start gap-3 rounded-[var(--radius-xl)] border border-destructive/50 bg-destructive/10 p-4"
                    role="alert"
                >
                    <AlertCircle className="mt-0.5 size-5 shrink-0 text-destructive" />
                    <p className="text-destructive text-sm">{error}</p>
                </div>
            )
        }

        const change = preparedOutput
        const details = operationDetails[operation]
        const OperationIcon = details.icon
        const status = change.status ?? "pending_confirmation"
        const canAct =
            status === "pending_confirmation" &&
            Boolean(change.cardId && threadId && messageId) &&
            !isConfirming &&
            !isCancelling

        const actionArgs = () => ({
            threadId: threadId as Id<"threads">,
            assistantMessageId: messageId as string,
            toolCallId: toolInvocation.toolCallId,
            cardId: change.cardId as string
        })

        const handleConfirm = async () => {
            if (!canAct) return
            setIsConfirming(true)
            try {
                await confirmMemoryChange(actionArgs())
                toast.success(details.completedLabel)
            } catch (error) {
                toast.error(getErrorMessage(error, "Could not apply memory change"))
            } finally {
                setIsConfirming(false)
            }
        }

        const handleCancel = async () => {
            if (!canAct) return
            setIsCancelling(true)
            try {
                await cancelMemoryChange(actionArgs())
            } catch (error) {
                toast.error(getErrorMessage(error, "Could not cancel memory change"))
            } finally {
                setIsCancelling(false)
            }
        }

        const isWorking = status === "executing" || isConfirming
        const tags = change.metadata?.tags ?? []

        return (
            <section
                className="not-prose my-3 w-full max-w-lg overflow-hidden rounded-[var(--radius-xl)] border bg-card shadow-sm"
                aria-label={`${details.title} confirmation card`}
            >
                <div className="flex items-start gap-3 border-b bg-muted/20 p-4">
                    <div className="flex size-9 shrink-0 items-center justify-center rounded-[var(--radius-lg)] bg-primary/10 text-primary">
                        <SupermemoryIcon className="size-5" />
                    </div>
                    <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                            <OperationIcon className="size-4 text-primary" aria-hidden="true" />
                            <h3 className="font-medium text-sm">{details.title}</h3>
                        </div>
                        <p className="mt-1 text-muted-foreground text-xs">{details.description}</p>
                    </div>
                </div>

                <div className="space-y-3 p-4">
                    {change.operation === "update" ? (
                        <div className="space-y-2">
                            <div className="rounded-[var(--radius-md)] bg-muted/40 p-3">
                                <p className="mb-1 font-medium text-muted-foreground text-xs">
                                    Current
                                </p>
                                <p className="text-muted-foreground text-sm line-through">
                                    {change.currentContent}
                                </p>
                            </div>
                            <div className="rounded-[var(--radius-md)] border border-primary/20 bg-primary/5 p-3">
                                <p className="mb-1 font-medium text-primary text-xs">Replacement</p>
                                <p className="whitespace-pre-wrap text-sm">{change.newContent}</p>
                            </div>
                        </div>
                    ) : (
                        <div className="rounded-[var(--radius-md)] bg-muted/40 p-3">
                            <p className="whitespace-pre-wrap text-sm">{change.content}</p>
                        </div>
                    )}

                    {(change.metadata?.category || tags.length > 0) && (
                        <div className="flex flex-wrap gap-1.5">
                            {change.metadata?.category && (
                                <span className="rounded-[var(--radius-sm)] bg-secondary px-2 py-1 text-secondary-foreground text-xs">
                                    {change.metadata.category}
                                </span>
                            )}
                            {tags.map((tag) => (
                                <span
                                    key={tag}
                                    className="rounded-[var(--radius-sm)] bg-secondary px-2 py-1 text-secondary-foreground text-xs"
                                >
                                    {tag}
                                </span>
                            ))}
                        </div>
                    )}

                    {status === "failed" && change.error && (
                        <div className="flex items-start gap-2 text-destructive" role="alert">
                            <AlertCircle className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
                            <p className="text-xs">{change.error}</p>
                        </div>
                    )}
                </div>

                <div className="border-t bg-muted/10 p-3">
                    {status === "pending_confirmation" ? (
                        <div className="flex gap-2">
                            <Button
                                type="button"
                                variant="ghost"
                                className="flex-1"
                                disabled={!canAct}
                                onClick={() => void handleCancel()}
                            >
                                {isCancelling ? (
                                    <Loader2 className="size-4 animate-spin" aria-hidden="true" />
                                ) : (
                                    <X className="size-4" aria-hidden="true" />
                                )}
                                Cancel
                            </Button>
                            <Button
                                type="button"
                                variant={change.operation === "forget" ? "destructive" : "default"}
                                className="flex-1"
                                disabled={!canAct}
                                onClick={() => void handleConfirm()}
                            >
                                {isConfirming ? (
                                    <Loader2 className="size-4 animate-spin" aria-hidden="true" />
                                ) : (
                                    <OperationIcon className="size-4" aria-hidden="true" />
                                )}
                                {details.confirmLabel}
                            </Button>
                        </div>
                    ) : isWorking ? (
                        <Button type="button" className="w-full" disabled>
                            <Loader2 className="size-4 animate-spin" aria-hidden="true" />
                            Applying change
                        </Button>
                    ) : status === "completed" ? (
                        <div className="flex items-center justify-center gap-2 py-1 text-primary text-sm">
                            <Check className="size-4" aria-hidden="true" />
                            {details.completedLabel}
                        </div>
                    ) : status === "cancelled" ? (
                        <div className="flex items-center justify-center gap-2 py-1 text-muted-foreground text-sm">
                            <X className="size-4" aria-hidden="true" />
                            Cancelled
                        </div>
                    ) : (
                        <div className="flex items-center justify-center gap-2 py-1 text-destructive text-sm">
                            <AlertCircle className="size-4" aria-hidden="true" />
                            Change failed
                        </div>
                    )}
                </div>
            </section>
        )
    }
)

MemoryToolRenderer.displayName = "MemoryToolRenderer"
