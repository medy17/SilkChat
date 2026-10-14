import { SPOTLIGHT_CARD_CLASS } from "@/components/renderers/spotlight-frame"
import {
    Dialog,
    DialogClose,
    DialogContent,
    DialogDescription,
    DialogTitle
} from "@/components/ui/dialog"
import { cn } from "@/lib/utils"
import { AppWindow, CircleAlert, Code, Loader2, Maximize2, RotateCcw, X } from "lucide-react"
import { type ComponentType, memo, useEffect, useRef, useState } from "react"
import { SilkAppFrame, type SilkAppFrameStatus } from "./silk-app-frame"

const iconButtonClass =
    "inline-flex size-8 shrink-0 items-center justify-center rounded-[var(--radius-sm)] text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring aria-pressed:text-foreground"

/** Mounts once the block nears the viewport, so a long thread doesn't boot every app. */
function useNearViewport() {
    const ref = useRef<HTMLDivElement>(null)
    const [near, setNear] = useState(false)

    useEffect(() => {
        const element = ref.current
        if (!element || near) return
        if (typeof IntersectionObserver === "undefined") {
            setNear(true)
            return
        }
        const observer = new IntersectionObserver(
            (entries) => {
                if (entries.some((entry) => entry.isIntersecting)) setNear(true)
            },
            { rootMargin: "600px 0px" }
        )
        observer.observe(element)
        return () => observer.disconnect()
    }, [near])

    return { ref, near }
}

function LoadingCard({ label, detail }: { label: string; detail?: string }) {
    return (
        <div className={cn("flex h-28 items-center gap-2 px-5 text-sm", SPOTLIGHT_CARD_CLASS)}>
            <Loader2 className="size-4 animate-spin text-primary" />
            <span className="text-muted-foreground">{label}</span>
            {detail && <span className="text-muted-foreground/60 tabular-nums">· {detail}</span>}
        </div>
    )
}

function AppError({ message }: { message: string }) {
    return (
        <div className="flex items-start gap-2 rounded-[var(--radius-md)] border border-destructive/30 bg-destructive/10 px-3 py-2 text-destructive text-sm">
            <CircleAlert className="mt-0.5 size-4 shrink-0" />
            <div className="min-w-0 flex-1">
                <p>The app couldn't run.</p>
                <p className="mt-0.5 break-words font-mono text-destructive/80 text-xs">
                    {message}
                </p>
            </div>
        </div>
    )
}

const countLines = (code: string) => (code.match(/\n/g)?.length ?? 0) + 1

export type SilkAppSourceProps = { code: string; isStreaming: boolean }

/**
 * A model-written interactive app in a message. While the fence streams it holds a
 * loading card; once complete it boots the sandboxed frame and fades the app in.
 */
export const SilkAppBlock = memo(function SilkAppBlock({
    code,
    isStreaming,
    cutOff = false,
    source: Source
}: {
    code: string
    isStreaming: boolean
    /** The reply stopped mid-fence, so the code is incomplete and isn't run. */
    cutOff?: boolean
    /** Renders the highlighted source, in the style of whatever hosts this app. */
    source: ComponentType<SilkAppSourceProps>
}) {
    const { ref, near } = useNearViewport()
    const [status, setStatus] = useState<SilkAppFrameStatus>({ status: "loading" })
    const [expandedStatus, setExpandedStatus] = useState<SilkAppFrameStatus>({
        status: "loading"
    })
    const [showCode, setShowCode] = useState(false)
    const [expanded, setExpanded] = useState(false)
    const [runId, setRunId] = useState(0)

    const rendered = status.status === "rendered"
    const failed = status.status === "error"
    const runnable = !isStreaming && !cutOff
    const mounted = near && runnable

    return (
        <div ref={ref} data-silk-app className="not-prose group/app relative my-5 w-full">
            {isStreaming && !showCode && (
                <LoadingCard
                    label="Building interactive app…"
                    detail={`${countLines(code)} lines`}
                />
            )}
            {runnable && !rendered && !failed && !showCode && <LoadingCard label="Starting app…" />}
            {cutOff && !showCode && (
                <div
                    className={cn(
                        "flex h-28 items-center gap-2 px-5 text-muted-foreground text-sm",
                        SPOTLIGHT_CARD_CLASS
                    )}
                >
                    <CircleAlert className="size-4 shrink-0" />
                    The reply stopped before this app was finished.
                </div>
            )}

            {failed && !showCode && <AppError message={status.message} />}

            {showCode && <Source code={code} isStreaming={isStreaming} />}

            {mounted && (
                // Kept mounted while the code is shown, so the app keeps its state. While it
                // boots it sits transparent over the loading card at full size: browsers
                // pause rendering in hidden or zero-size cross-origin frames, which would
                // stall the boot.
                <div
                    aria-hidden={!rendered || showCode}
                    className={cn(
                        !rendered
                            ? "pointer-events-none absolute inset-x-0 top-0 h-28 opacity-0"
                            : showCode
                              ? "pointer-events-none invisible h-0 overflow-hidden"
                              : "fade-in-0 slide-in-from-bottom-1 animate-in duration-500"
                    )}
                >
                    <SilkAppFrame
                        key={runId}
                        code={code}
                        mode="inline"
                        title="Interactive app"
                        onStatusChange={setStatus}
                        // The frame pads its body by 0.25rem so focus rings and shadows
                        // aren't clipped; this pulls the content back into line.
                        className="-mx-1 -my-1 w-[calc(100%+0.5rem)]"
                    />
                </div>
            )}

            <div className="mt-1 flex h-8 items-center justify-end gap-0.5 opacity-0 transition-opacity focus-within:opacity-100 group-hover/app:opacity-100 [@media(hover:none)]:opacity-100">
                <button
                    type="button"
                    aria-label={showCode ? "Show app" : "Show code"}
                    aria-pressed={showCode}
                    className={iconButtonClass}
                    onClick={() => setShowCode((current) => !current)}
                >
                    {showCode ? <AppWindow className="size-4" /> : <Code className="size-4" />}
                </button>
                {runnable && (
                    <>
                        <button
                            type="button"
                            aria-label="Restart app"
                            className={iconButtonClass}
                            onClick={() => {
                                setStatus({ status: "loading" })
                                setShowCode(false)
                                setRunId((current) => current + 1)
                            }}
                        >
                            <RotateCcw className="size-4" />
                        </button>
                        <button
                            type="button"
                            aria-label="Expand app"
                            disabled={!rendered}
                            className={cn(
                                iconButtonClass,
                                "hidden disabled:opacity-40 md:inline-flex"
                            )}
                            onClick={() => {
                                setExpandedStatus({ status: "loading" })
                                setExpanded(true)
                            }}
                        >
                            <Maximize2 className="size-4" />
                        </button>
                    </>
                )}
            </div>

            <Dialog open={expanded} onOpenChange={setExpanded}>
                <DialogContent
                    showCloseButton={false}
                    overlayClassName="backdrop-blur-md"
                    className="flex max-w-none flex-col gap-0 overflow-hidden rounded-[var(--radius-lg)] bg-background p-0"
                    style={{
                        width: "92vw",
                        height: "88vh",
                        maxWidth: "72rem",
                        maxHeight: "60rem"
                    }}
                >
                    <DialogTitle className="sr-only">Interactive app</DialogTitle>
                    <DialogDescription className="sr-only">
                        The app from this message, expanded.
                    </DialogDescription>
                    {/* Its own row: apps often put controls top-right, where an overlaid
                        close button would cover them. */}
                    <div className="flex shrink-0 justify-end px-3 pt-3">
                        <DialogClose asChild>
                            <button
                                type="button"
                                aria-label="Close expanded app"
                                className={iconButtonClass}
                            >
                                <X className="size-4" />
                            </button>
                        </DialogClose>
                    </div>
                    {/* A fresh instance, so it starts from the app's initial state. */}
                    {expanded && (
                        <div className="relative flex min-h-0 flex-1 flex-col px-3 pb-3">
                            {expandedStatus.status === "error" && (
                                <AppError message={expandedStatus.message} />
                            )}
                            {expandedStatus.status === "loading" && (
                                <div className="absolute inset-0 flex items-center justify-center">
                                    <Loader2 className="size-5 animate-spin text-primary" />
                                </div>
                            )}
                            <SilkAppFrame
                                code={code}
                                mode="expanded"
                                title="Interactive app, expanded"
                                onStatusChange={setExpandedStatus}
                                className={cn(
                                    "min-h-0 w-full flex-1",
                                    // Transparent rather than hidden while it boots, as inline.
                                    expandedStatus.status === "loading" && "opacity-0",
                                    expandedStatus.status === "error" && "hidden"
                                )}
                            />
                        </div>
                    )}
                </DialogContent>
            </Dialog>
        </div>
    )
})
