import { Button } from "@/components/ui/button"
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip"
import {
    type ContextRingLevel,
    type ContextRingTone,
    DEFAULT_CONTEXT_RING_LEVELS,
    resolveContextRingTone
} from "@/lib/composer-context"
import { cn } from "@/lib/utils"
import { useRef, useState } from "react"

// Theme tones only; hover keeps the tone, except the quiet one, which brightens.
export const RING_TONE_CLASSES: Record<ContextRingTone, string> = {
    muted: "text-muted-foreground hover:text-foreground",
    foreground: "text-foreground hover:text-foreground",
    primary: "text-primary hover:text-primary",
    warning: "text-warning hover:text-warning",
    destructive: "text-destructive hover:text-destructive"
}

const RADIUS = 6.5
const CIRCUMFERENCE = 2 * Math.PI * RADIUS

const formatTokens = (tokens: number) => Math.round(tokens).toLocaleString("en-US")

/**
 * A fill ring for how much of the context window the next send would use. Hover shows the
 * numbers; touch has no hover, so a tap toggles them and a tap elsewhere closes them.
 */
export function ContextUsageRing({
    usedTokens,
    limitTokens,
    levels = DEFAULT_CONTEXT_RING_LEVELS,
    className
}: {
    usedTokens: number
    limitTokens: number
    /** Which tone applies from which percentage. */
    levels?: readonly ContextRingLevel[]
    className?: string
}) {
    const fraction = limitTokens > 0 ? usedTokens / limitTokens : 0
    const clamped = Math.min(Math.max(fraction, 0), 1)
    const percent = Math.round(fraction * 100)
    const [open, setOpen] = useState(false)
    const buttonRef = useRef<HTMLButtonElement>(null)
    const pressedByTouchRef = useRef(false)

    return (
        <Tooltip open={open} onOpenChange={setOpen}>
            <TooltipTrigger asChild>
                <Button
                    ref={buttonRef}
                    type="button"
                    variant="ghost"
                    size="icon"
                    aria-label={`Context ${percent}% full`}
                    // Radix closes on press and click; skip that for touch, which toggles instead.
                    onPointerDown={(event) => {
                        pressedByTouchRef.current = event.pointerType !== "mouse"
                        if (pressedByTouchRef.current) event.preventDefault()
                    }}
                    onClick={(event) => {
                        event.preventDefault()
                        // detail 0 is a keyboard press.
                        if (pressedByTouchRef.current || event.detail === 0) {
                            setOpen((current) => !current)
                        }
                    }}
                    className={cn(
                        "size-8 shrink-0 transition-colors duration-300 hover:bg-glass-control-hover",
                        RING_TONE_CLASSES[resolveContextRingTone(fraction * 100, levels)],
                        className
                    )}
                    style={{ borderRadius: "var(--radius-md)" }}
                >
                    <svg viewBox="0 0 16 16" className="size-4 -rotate-90" aria-hidden="true">
                        <circle
                            cx="8"
                            cy="8"
                            r={RADIUS}
                            fill="none"
                            stroke="currentColor"
                            strokeOpacity={0.25}
                            strokeWidth={2}
                        />
                        <circle
                            cx="8"
                            cy="8"
                            r={RADIUS}
                            fill="none"
                            stroke="currentColor"
                            strokeWidth={2}
                            strokeLinecap="round"
                            strokeDasharray={CIRCUMFERENCE}
                            strokeDashoffset={CIRCUMFERENCE * (1 - clamped)}
                            className="transition-[stroke-dashoffset] duration-300 ease-out"
                        />
                    </svg>
                </Button>
            </TooltipTrigger>
            <TooltipContent
                // A tap on the ring itself toggles; don't let it count as "outside" first.
                onPointerDownOutside={(event) => {
                    if (buttonRef.current?.contains(event.target as Node)) event.preventDefault()
                }}
            >
                <div className="space-y-0.5">
                    <p>{percent}% of the context window</p>
                    <p className="text-xs opacity-80">
                        {formatTokens(usedTokens)} / {formatTokens(limitTokens)} tokens
                    </p>
                </div>
            </TooltipContent>
        </Tooltip>
    )
}
