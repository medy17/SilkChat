import { AnimatedCollapsible } from "@/components/ui/animated-collapsible"
import type { ComputerViewState } from "@/convex/lib/computer_policy"
import { cn } from "@/lib/utils"
import { ChevronDown } from "lucide-react"
import { type CSSProperties, type ReactNode, useState } from "react"

export const COMPUTER_STATE_LABELS: Record<ComputerViewState, string> = {
    setting_up: "Setting up",
    asleep: "Asleep",
    awake: "Awake",
    working: "Working",
    stuck: "Not responding",
    busy: "Updating",
    archived: "Archived"
}

export type ComputerMarkTone = "active" | "pulse" | "quiet" | "problem"

export const COMPUTER_STATE_TONES: Record<ComputerViewState, ComputerMarkTone> = {
    setting_up: "pulse",
    asleep: "quiet",
    awake: "active",
    working: "active",
    stuck: "problem",
    busy: "pulse",
    archived: "quiet"
}

const MARK_TONE_CLASS: Record<ComputerMarkTone, string> = {
    active: "bg-chart-1",
    pulse: "bg-chart-1 motion-safe:animate-pulse",
    quiet: "bg-muted-foreground/40",
    problem: "bg-destructive"
}

export function ComputerStatusMark({ tone }: { tone: ComputerMarkTone }) {
    return (
        <span
            aria-hidden="true"
            className={cn("size-2 shrink-0 rounded-[var(--radius-sm)]", MARK_TONE_CLASS[tone])}
        />
    )
}

// The workspace card's field, so the computer reads as its successor.
const coverPattern = (dimmed: boolean): CSSProperties => ({
    backgroundImage: [
        "radial-gradient(color-mix(in oklab, var(--chart-1) 45%, transparent) 1px, transparent 1.5px)",
        "linear-gradient(135deg, color-mix(in oklab, var(--chart-1) 24%, var(--card)), color-mix(in oklab, var(--chart-1) 4%, var(--card)))"
    ].join(", "),
    backgroundSize: "14px 14px, 100% 100%",
    filter: dimmed ? "grayscale(1)" : undefined,
    opacity: dimmed ? 0.6 : undefined
})

export function ComputerCover({
    title,
    status,
    tone,
    compact = false,
    className
}: {
    title: ReactNode
    status: string
    tone: ComputerMarkTone
    /** A slim banner for full-width chat cards: name and status on one line. */
    compact?: boolean
    className?: string
}) {
    return (
        <div className={cn("relative overflow-hidden border-border border-b", className)}>
            <div
                aria-hidden="true"
                className="absolute inset-0 transition-[filter,opacity] duration-500"
                style={coverPattern(tone === "quiet")}
            />
            <div
                className={cn(
                    "absolute left-5",
                    compact ? "inset-y-0 right-36 flex items-center" : "right-5 bottom-5"
                )}
            >
                {title}
            </div>
            <span
                className={cn(
                    "spotlight-glass absolute inline-flex h-7 items-center gap-2 rounded-[var(--radius-md)] px-2 font-medium text-xs",
                    compact ? "top-1/2 right-5 -translate-y-1/2" : "top-3 right-3"
                )}
            >
                <ComputerStatusMark tone={tone} />
                {status}
            </span>
        </div>
    )
}

/** A label that opens to more, matching the Details control in the Code Execution steps. */
export function ComputerDisclosure({
    label,
    children,
    className,
    triggerClassName
}: {
    label: string
    children: ReactNode
    className?: string
    triggerClassName?: string
}) {
    const [open, setOpen] = useState(false)
    return (
        <section className={className}>
            <button
                type="button"
                data-pause-chat-scroll-follow=""
                className={cn(
                    "flex items-center gap-1.5 text-muted-foreground text-xs transition-colors hover:text-foreground",
                    triggerClassName
                )}
                onClick={() => setOpen((shown) => !shown)}
                aria-expanded={open}
            >
                <ChevronDown
                    className={cn("size-3.5 transition-transform", open && "rotate-180")}
                    aria-hidden="true"
                />
                {label}
            </button>
            <AnimatedCollapsible open={open}>
                <div className="pt-2">{children}</div>
            </AnimatedCollapsible>
        </section>
    )
}

export function ComputerDetailItem({ label, value }: { label: string; value: ReactNode }) {
    return (
        <div className="flex min-w-0 items-baseline justify-between gap-4 py-1">
            <dt className="shrink-0 text-muted-foreground">{label}</dt>
            <dd className="min-w-0 text-right">{value}</dd>
        </div>
    )
}
