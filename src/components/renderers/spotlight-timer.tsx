import { cn } from "@/lib/utils"
import type { ReactNode } from "react"

// Timer pieces shared by every generated surface that counts down: recipe timers and cook
// mode, and the persistent workspace card.

export const formatTimerClock = (seconds: number) => {
    const hours = Math.floor(seconds / 3600)
    const minutes = Math.floor((seconds % 3600) / 60)
    const remainder = seconds % 60
    if (hours > 0) {
        return `${hours}:${String(minutes).padStart(2, "0")}:${String(remainder).padStart(2, "0")}`
    }
    return `${minutes}:${String(remainder).padStart(2, "0")}`
}

/** The inline timer pill. Interactive uses add their own hover and focus styles. */
export const TIMER_CHIP_CLASS =
    "inline-flex h-6.5 items-center gap-1.5 rounded-[var(--radius-md)] bg-primary/10 px-2.5 font-medium text-primary text-xs tabular-nums"

export type TimerTone = "primary" | "warning" | "muted"

const READOUT_TONE: Record<TimerTone, string> = {
    primary: "text-primary",
    warning: "text-warning",
    muted: "text-muted-foreground"
}

/** The big clock from cook mode, with its caption underneath. */
export function TimerReadout({
    seconds,
    label,
    tone = "primary",
    className
}: {
    seconds: number
    label?: ReactNode
    tone?: TimerTone
    className?: string
}) {
    return (
        <div className={cn("text-center", className)}>
            <div
                className={cn(
                    "font-semibold text-4xl tabular-nums tracking-tight transition-colors sm:text-5xl",
                    READOUT_TONE[tone]
                )}
            >
                {formatTimerClock(seconds)}
            </div>
            {label && <div className="mt-1 text-muted-foreground text-xs">{label}</div>}
        </div>
    )
}
