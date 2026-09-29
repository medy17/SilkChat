import { ToggleButton, toggleButtonVariants } from "@heroui/react"
import type { ComponentProps } from "react"
export const toggleVariants = toggleButtonVariants
export function Toggle({
    pressed,
    defaultPressed,
    onPressedChange,
    disabled,
    variant = "default",
    size = "default",
    ...props
}: Omit<ComponentProps<typeof ToggleButton>, "variant" | "size"> & {
    pressed?: boolean
    defaultPressed?: boolean
    onPressedChange?: (value: boolean) => void
    disabled?: boolean
    variant?: "default" | "outline"
    size?: "default" | "sm" | "lg"
}) {
    return (
        <ToggleButton
            {...props}
            isSelected={pressed}
            defaultSelected={defaultPressed}
            onChange={onPressedChange}
            isDisabled={disabled}
            variant={variant === "outline" ? "default" : "ghost"}
            size={size === "default" ? "md" : size}
        />
    )
}
