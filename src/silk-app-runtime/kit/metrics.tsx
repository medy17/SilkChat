import { cn } from "@/lib/utils"
import { animate, useReducedMotion } from "motion/react"
import { type ComponentProps, type ReactNode, useEffect, useRef, useState } from "react"
import { TONE_TEXT, type Tone } from "./surfaces"

/** Decimal places a value was written with, capped so float noise never shows. */
export const inferDigits = (value: number) => {
    if (!Number.isFinite(value) || Number.isInteger(value)) return 0
    const [, decimals = ""] = value.toString().split(".")
    return Math.min(decimals.replace(/e.*$/, "").length, 3)
}

export const formatNumber = (value: number, digits: number) =>
    Number.isFinite(value)
        ? value.toLocaleString(undefined, {
              minimumFractionDigits: digits,
              maximumFractionDigits: digits
          })
        : "–"

/** A number that eases to each new value instead of jumping. */
export function AnimatedNumber({
    value,
    digits,
    format
}: {
    value: number
    digits?: number
    format?: (value: number) => string
}) {
    const reduceMotion = useReducedMotion()
    const [display, setDisplay] = useState(value)
    const current = useRef(value)

    useEffect(() => {
        if (reduceMotion || !Number.isFinite(value) || !Number.isFinite(current.current)) {
            current.current = value
            setDisplay(value)
            return
        }
        const controls = animate(current.current, value, {
            duration: 0.45,
            ease: [0.16, 1, 0.3, 1],
            onUpdate: (latest) => {
                current.current = latest
                setDisplay(latest)
            }
        })
        return () => controls.stop()
    }, [value, reduceMotion])

    return <>{format ? format(display) : formatNumber(display, digits ?? inferDigits(value))}</>
}

export function Stat({
    label,
    value,
    unit,
    hint,
    tone = "neutral",
    digits,
    format,
    className
}: {
    label: ReactNode
    value: ReactNode
    unit?: ReactNode
    hint?: ReactNode
    tone?: Tone
    digits?: number
    format?: (value: number) => string
    className?: string
}) {
    return (
        <div
            className={cn(
                "flex min-w-0 flex-col gap-1 rounded-[var(--radius-lg)] border bg-card px-4 py-3 shadow-xs transition-colors duration-300",
                tone === "critical" && "border-destructive/40",
                tone === "warning" && "border-warning/40",
                className
            )}
        >
            <span className="text-muted-foreground text-xs leading-snug">{label}</span>
            <span
                className={cn(
                    "font-mono font-semibold text-lg tabular-nums leading-tight tracking-tight transition-colors duration-300",
                    TONE_TEXT[tone]
                )}
            >
                {typeof value === "number" ? (
                    <AnimatedNumber value={value} digits={digits} format={format} />
                ) : (
                    value
                )}
                {unit && (
                    <span className="ml-1 font-normal text-muted-foreground text-sm">{unit}</span>
                )}
            </span>
            {hint && <span className="text-muted-foreground text-xs">{hint}</span>}
        </div>
    )
}

export function StatGrid({ className, ...props }: ComponentProps<"div">) {
    return (
        <div
            className={cn(
                "grid grid-cols-2 gap-3 sm:grid-cols-[repeat(auto-fit,minmax(10rem,1fr))]",
                className
            )}
            {...props}
        />
    )
}
