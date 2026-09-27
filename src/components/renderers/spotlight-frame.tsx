"use client"

import {
    Dialog,
    DialogClose,
    DialogContent,
    DialogDescription,
    DialogTitle,
    DialogTrigger
} from "@/components/ui/dialog"
import { cn } from "@/lib/utils"
import { Maximize2, X } from "lucide-react"
import { type CSSProperties, type ReactNode, useLayoutEffect, useRef, useState } from "react"

export type SpotlightSize = {
    width: number
    height: number
}

/**
 * The Spotlight card: theme radius, hairline border, and the accent-washed surface
 * (`spotlight-surface` in globals.css). Every model-generated artifact card starts here.
 */
export const SPOTLIGHT_CARD_CLASS =
    "rounded-[var(--radius-lg)] border border-border text-card-foreground shadow-sm spotlight-surface"

const iconButtonClass =
    "size-8 shrink-0 items-center justify-center rounded-[var(--radius-sm)] text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"

export function SpotlightHeader({
    title,
    description,
    action,
    className
}: {
    title: ReactNode
    description?: ReactNode
    action?: ReactNode
    className?: string
}) {
    return (
        <div className={cn("px-5 pt-5", className)}>
            {/* Only the title shares a row with the controls, so adding controls never
                narrows the description. The negative margins keep the 32px controls from
                pushing the description down. */}
            <div className="flex items-start gap-3">
                <h3 className="min-w-0 flex-1 font-semibold text-base leading-snug tracking-tight">
                    {title}
                </h3>
                {action && (
                    <div className="-my-1.5 -mr-2 flex shrink-0 items-center gap-1.5">{action}</div>
                )}
            </div>
            {description && <p className="mt-1 text-muted-foreground text-sm">{description}</p>}
        </div>
    )
}

export type SpotlightChip = {
    key: string
    label: string
    color: string
}

/** Filter chips: click hides a series or group, hover and focus spotlight it. */
export function SpotlightChips({
    chips,
    hiddenKeys,
    onToggle,
    onFocusChange
}: {
    chips: SpotlightChip[]
    hiddenKeys: ReadonlySet<string>
    onToggle: (key: string) => void
    onFocusChange: (key: string | null) => void
}) {
    return (
        <div className="flex flex-wrap gap-1.5 px-5 pt-3" onMouseLeave={() => onFocusChange(null)}>
            {chips.map((chip) => {
                const hidden = hiddenKeys.has(chip.key)
                return (
                    <button
                        key={chip.key}
                        type="button"
                        aria-pressed={!hidden}
                        onClick={() => onToggle(chip.key)}
                        onMouseEnter={() => onFocusChange(hidden ? null : chip.key)}
                        onFocus={() => onFocusChange(hidden ? null : chip.key)}
                        onBlur={() => onFocusChange(null)}
                        className={cn(
                            "inline-flex items-center gap-1.5 rounded-[var(--radius-md)] border px-2.5 py-1 font-medium text-xs transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                            hidden
                                ? "border-border border-dashed text-muted-foreground"
                                : "border-border bg-background/70 shadow-xs hover:bg-accent"
                        )}
                    >
                        <span
                            aria-hidden
                            className="size-2 rounded-[var(--radius-sm)] border-2 transition-colors"
                            style={{
                                borderColor: chip.color,
                                background: hidden ? "transparent" : chip.color
                            }}
                        />
                        <span className={cn(hidden && "line-through")}>{chip.label}</span>
                    </button>
                )
            })}
        </div>
    )
}

/** Hide/show state for chips, keeping at least one item visible. */
export function useSpotlightFilter(total: number) {
    const [hiddenKeys, setHiddenKeys] = useState<ReadonlySet<string>>(new Set())
    const [focusKey, setFocusKey] = useState<string | null>(null)

    const toggle = (key: string) => {
        if (hiddenKeys.has(key)) {
            const next = new Set(hiddenKeys)
            next.delete(key)
            setHiddenKeys(next)
            return
        }
        if (hiddenKeys.size >= total - 1) return
        setHiddenKeys(new Set(hiddenKeys).add(key))
        if (focusKey === key) setFocusKey(null)
    }

    return { hiddenKeys, focusKey, toggle, setFocusKey }
}

function MeasuredSurface({ children }: { children: (size: SpotlightSize) => ReactNode }) {
    const surfaceRef = useRef<HTMLDivElement>(null)
    const [size, setSize] = useState<SpotlightSize>({ width: 0, height: 0 })

    useLayoutEffect(() => {
        const surface = surfaceRef.current
        if (!surface) return

        const updateSize = () => {
            const bounds = surface.getBoundingClientRect()
            const width = Math.max(0, Math.floor(bounds.width))
            const height = Math.max(0, Math.floor(bounds.height))
            setSize((current) =>
                current.width === width && current.height === height ? current : { width, height }
            )
        }

        updateSize()
        const observer =
            typeof ResizeObserver === "undefined" ? undefined : new ResizeObserver(updateSize)
        observer?.observe(surface)
        return () => observer?.disconnect()
    }, [])

    return (
        <div ref={surfaceRef} className="relative min-h-0 flex-1 overflow-hidden">
            {size.width > 0 && size.height > 0 ? children(size) : null}
        </div>
    )
}

type SpotlightFrameProps = {
    kind: "chart" | "network"
    title: string
    description?: string
    dataAttribute: "data-native-chart" | "data-native-network"
    /** Header controls shown before expand/close in both the inline and expanded views. */
    actions?: ReactNode
    /** Rendered under the header in both the inline and expanded views. */
    toolbar?: ReactNode
    /** The visualization; `size` is the measured body when expanded. */
    children: (expanded: boolean, size?: SpotlightSize) => ReactNode
}

/** Card chrome and focus view shared by every native model-generated visualization. */
export function SpotlightFrame({
    kind,
    title,
    description,
    dataAttribute,
    actions,
    toolbar,
    children
}: SpotlightFrameProps) {
    const [open, setOpen] = useState(false)
    const dataAttributes = { [dataAttribute]: "" }

    return (
        <Dialog open={open} onOpenChange={setOpen}>
            <figure
                {...dataAttributes}
                className={cn("not-prose my-5 w-full overflow-hidden", SPOTLIGHT_CARD_CLASS)}
            >
                <figcaption>
                    <SpotlightHeader
                        title={title}
                        description={description}
                        action={
                            <>
                                {actions}
                                <DialogTrigger asChild>
                                    <button
                                        type="button"
                                        aria-label={`Expand ${kind}`}
                                        className={cn("hidden md:flex", iconButtonClass)}
                                    >
                                        <Maximize2 className="size-4" />
                                    </button>
                                </DialogTrigger>
                            </>
                        }
                    />
                </figcaption>
                {toolbar}
                {children(false)}
            </figure>

            <DialogContent
                showCloseButton={false}
                overlayClassName="backdrop-blur-md"
                className="spotlight-surface flex max-w-none flex-col gap-0 overflow-hidden rounded-[var(--radius-lg)] bg-card p-0 text-card-foreground"
                style={{
                    width: "92vw",
                    height: "85vh",
                    maxWidth: "80rem",
                    maxHeight: "56rem"
                }}
            >
                <SpotlightHeader
                    title={title}
                    description={description}
                    action={
                        <>
                            {actions}
                            <DialogClose asChild>
                                <button
                                    type="button"
                                    aria-label={`Close expanded ${kind}`}
                                    className={cn("inline-flex", iconButtonClass)}
                                >
                                    <X className="size-4" />
                                </button>
                            </DialogClose>
                        </>
                    }
                />
                <DialogTitle className="sr-only">{title}</DialogTitle>
                <DialogDescription className="sr-only">
                    {description || `Expanded interactive ${kind}`}
                </DialogDescription>
                {toolbar}
                <MeasuredSurface>{(size) => children(true, size)}</MeasuredSurface>
            </DialogContent>
        </Dialog>
    )
}
