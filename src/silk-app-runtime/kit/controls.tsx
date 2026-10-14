import { Slider as BaseSlider } from "@/components/ui/slider"
import { Tabs, TabsList, TabsTrigger } from "./tabs"
import { cn } from "@/lib/utils"
import type { ComponentProps, ReactNode } from "react"

type BaseSliderProps = ComponentProps<typeof BaseSlider>

const toArray = (value: number | number[] | undefined) =>
    value === undefined ? undefined : Array.isArray(value) ? value : [value]

/**
 * shadcn's slider, also accepting a plain number. A number in gives a number back, so
 * `value={rate} onValueChange={setRate}` works alongside the array form.
 */
export function Slider({
    value,
    defaultValue,
    onValueChange,
    onValueCommit,
    ...props
}: Omit<BaseSliderProps, "value" | "defaultValue" | "onValueChange" | "onValueCommit"> & {
    value?: number | number[]
    defaultValue?: number | number[]
    onValueChange?: (value: never) => void
    onValueCommit?: (value: never) => void
}) {
    const scalar =
        typeof value === "number" || (value === undefined && typeof defaultValue === "number")
    const emit = (handler: ((value: never) => void) | undefined) =>
        handler ? (next: number[]) => handler((scalar ? next[0] : next) as never) : undefined

    return (
        <BaseSlider
            value={toArray(value)}
            defaultValue={toArray(defaultValue)}
            onValueChange={emit(onValueChange)}
            onValueCommit={emit(onValueCommit)}
            {...props}
        />
    )
}

/** A labelled control row: label on the left, the control and its readout on the right. */
export function Control({
    label,
    description,
    value,
    children,
    className
}: {
    label: ReactNode
    description?: ReactNode
    value?: ReactNode
    children: ReactNode
    className?: string
}) {
    return (
        // The control sizes from its content: a slider sits beside the label, while a wide
        // segmented control wraps under it rather than being squeezed.
        <div className={cn("flex flex-wrap items-center gap-x-6 gap-y-2 py-2", className)}>
            <div className="min-w-0 flex-[1_1_12rem]">
                <div className="font-medium text-sm">{label}</div>
                {description && (
                    <div className="mt-0.5 text-muted-foreground text-xs">{description}</div>
                )}
            </div>
            <div className="flex max-w-full flex-auto grow-[1.3] items-center justify-end gap-3">
                <div className="flex min-w-0 flex-1 items-center justify-end">{children}</div>
                {value !== undefined && (
                    <span className="min-w-12 shrink-0 text-right font-mono text-sm tabular-nums">
                        {value}
                    </span>
                )}
            </div>
        </div>
    )
}

type SegmentedOption = string | { value: string; label: ReactNode }

/** A single-choice pill switch. */
export function Segmented({
    options,
    value,
    defaultValue,
    onValueChange,
    className
}: {
    options: SegmentedOption[]
    value?: string
    defaultValue?: string
    onValueChange?: (value: string) => void
    className?: string
}) {
    const items = options.map((option) =>
        typeof option === "string" ? { value: option, label: option } : option
    )

    return (
        <Tabs
            value={value}
            defaultValue={value === undefined ? (defaultValue ?? items[0]?.value) : undefined}
            onValueChange={onValueChange}
            className="min-w-0 gap-0"
        >
            <TabsList className={className}>
                {items.map((item) => (
                    <TabsTrigger key={item.value} value={item.value}>
                        {item.label}
                    </TabsTrigger>
                ))}
            </TabsList>
        </Tabs>
    )
}
