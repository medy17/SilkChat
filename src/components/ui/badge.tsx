import { Chip, chipVariants } from "@heroui/react"
import { Slot } from "@radix-ui/react-slot"
import type { ComponentProps } from "react"
import { cn } from "@/lib/utils"

type Variant = "default" | "secondary" | "warning" | "destructive" | "outline"
const colors = {
    default: "accent",
    secondary: "default",
    warning: "warning",
    destructive: "danger",
    outline: "default"
} as const
export function badgeVariants({
    variant = "default",
    className
}: {
    variant?: Variant | null
    className?: string
} = {}) {
    return cn(
        chipVariants({
            size: "sm",
            color: colors[variant ?? "default"],
            variant: variant === "outline" ? "soft" : "primary"
        }).base(),
        variant === "outline" && "border border-border bg-transparent",
        className
    )
}
export function Badge({
    className,
    variant = "default",
    asChild = false,
    children,
    ...props
}: ComponentProps<"span"> & { variant?: Variant | null; asChild?: boolean }) {
    if (asChild)
        return (
            <Slot
                children={children}
                {...props}
                className={badgeVariants({ variant, className })}
            />
        )
    return (
        <Chip
            children={children}
            {...props}
            size="sm"
            color={colors[variant ?? "default"]}
            variant={variant === "outline" ? "soft" : "primary"}
            className={cn(
                variant === "outline" && "border border-border bg-transparent",
                className
            )}
        />
    )
}
