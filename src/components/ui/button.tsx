import { Button as HeroButton, buttonVariants as heroButtonVariants } from "@heroui/react"
import { Slot } from "@radix-ui/react-slot"
import type { ComponentProps, ReactNode, CSSProperties } from "react"
import { cn } from "@/lib/utils"

type Variant = "default" | "destructive" | "outline" | "secondary" | "ghost" | "link"
type Size = "default" | "sm" | "lg" | "icon"
const variants = {
    default: "primary",
    destructive: "danger",
    outline: "outline",
    secondary: "secondary",
    ghost: "ghost",
    link: "ghost"
} as const

export function buttonVariants({
    variant = "default",
    size = "default",
    className
}: {
    variant?: Variant | null
    size?: Size | null
    className?: string
} = {}) {
    return cn(
        heroButtonVariants({
            variant: variants[variant ?? "default"],
            size: size === "sm" || size === "lg" ? size : "md",
            isIconOnly: size === "icon"
        }),
        variant === "link" && "h-auto p-0 text-primary underline-offset-4 hover:underline",
        className
    )
}

export function Button({
    className,
    variant = "default",
    size = "default",
    asChild = false,
    disabled,
    ...props
}: Omit<
    ComponentProps<typeof HeroButton>,
    "variant" | "size" | "children" | "className" | "style" | "slot"
> &
    Omit<ComponentProps<"button">, keyof ComponentProps<typeof HeroButton>> & {
        children?: ReactNode
        className?: string
        style?: CSSProperties
        slot?: string
        disabled?: boolean
        variant?: Variant | null
        size?: Size | null
        asChild?: boolean
    }) {
    if (asChild)
        return (
            <Slot
                {...props}
                data-slot="button"
                aria-disabled={disabled || undefined}
                className={buttonVariants({ variant, size, className })}
            />
        )
    return (
        <HeroButton
            {...props}
            isDisabled={disabled}
            variant={variants[variant ?? "default"]}
            size={size === "sm" || size === "lg" ? size : "md"}
            isIconOnly={size === "icon"}
            className={cn(
                variant === "link" && "h-auto p-0 text-primary underline-offset-4 hover:underline",
                className
            )}
        />
    )
}
