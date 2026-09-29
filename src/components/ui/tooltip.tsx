import { Tooltip as HeroTooltip } from "@heroui/react"
import { Slot } from "@radix-ui/react-slot"
import { createContext, useContext, type ComponentProps, type ReactNode } from "react"
import { cn } from "@/lib/utils"

const Delay = createContext(0)
export function TooltipProvider({
    children,
    delayDuration = 0
}: {
    children?: ReactNode
    delayDuration?: number
    skipDelayDuration?: number
    disableHoverableContent?: boolean
}) {
    return <Delay value={delayDuration}>{children}</Delay>
}
export function Tooltip({
    open,
    defaultOpen,
    onOpenChange,
    delayDuration,
    children
}: {
    open?: boolean
    defaultOpen?: boolean
    onOpenChange?: (open: boolean) => void
    delayDuration?: number
    children?: ReactNode
}) {
    const delay = useContext(Delay)
    return (
        <HeroTooltip
            isOpen={open}
            defaultOpen={defaultOpen}
            onOpenChange={onOpenChange}
            delay={delayDuration ?? delay}
        >
            {children}
        </HeroTooltip>
    )
}
export function TooltipTrigger({
    asChild,
    children,
    ...props
}: ComponentProps<"button"> & { asChild?: boolean }) {
    return (
        <HeroTooltip.Trigger<"button">
            {...props}
            render={(triggerProps) =>
                asChild ? (
                    <Slot {...triggerProps}>{children}</Slot>
                ) : (
                    <button type="button" {...triggerProps}>
                        {children}
                    </button>
                )
            }
        />
    )
}
export function TooltipContent({
    side = "top",
    align = "center",
    sideOffset = 4,
    className,
    children,
    ...props
}: Omit<ComponentProps<typeof HeroTooltip.Content>, "placement"> & {
    side?: "top" | "bottom" | "left" | "right"
    align?: "start" | "center" | "end"
    sideOffset?: number
}) {
    const placement =
        side === "left" || side === "right"
            ? align === "center"
                ? side
                : (`${side} ${align === "start" ? "top" : "bottom"}` as const)
            : align === "center"
              ? side
              : (`${side} ${align}` as const)
    return (
        <HeroTooltip.Content
            {...props}
            placement={placement}
            offset={sideOffset}
            className={cn("z-[100]", typeof className === "string" && className)}
        >
            {children}
        </HeroTooltip.Content>
    )
}
