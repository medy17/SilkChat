import { Meter as HeroMeter, ProgressBar } from "@heroui/react"
import type { ComponentProps } from "react"
import { cn } from "@/lib/utils"

type Props = Omit<ComponentProps<typeof ProgressBar>, "value"> & {
    value?: number | null
    max?: number
}
export function Progress({ value, max, className, ...props }: Props) {
    return (
        <ProgressBar
            {...props}
            value={value ?? undefined}
            maxValue={max}
            isIndeterminate={value == null}
            className={cn(
                "h-2 gap-0 [grid-template-areas:'track'] [grid-template-columns:1fr]",
                className
            )}
        >
            <ProgressBar.Track className="h-full rounded-md">
                <ProgressBar.Fill className="rounded-none" />
            </ProgressBar.Track>
        </ProgressBar>
    )
}
export function Meter({
    value,
    max,
    className,
    ...props
}: Omit<ComponentProps<typeof HeroMeter>, "value"> & { value: number; max?: number }) {
    return (
        <HeroMeter
            {...props}
            value={value}
            maxValue={max}
            className={cn(
                "h-2 gap-0 [grid-template-areas:'track'] [grid-template-columns:1fr]",
                className
            )}
        >
            <HeroMeter.Track className="h-full rounded-md">
                <HeroMeter.Fill className="rounded-none" />
            </HeroMeter.Track>
        </HeroMeter>
    )
}
