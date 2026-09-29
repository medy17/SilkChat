import { Switch as HeroSwitch } from "@heroui/react"
import type { ComponentProps, MouseEventHandler } from "react"

type Props = Omit<ComponentProps<typeof HeroSwitch>, "onChange" | "className" | "children"> & {
    checked?: boolean
    defaultChecked?: boolean
    onCheckedChange?: (checked: boolean) => void
    disabled?: boolean
    required?: boolean
    className?: string
    onClick?: MouseEventHandler<HTMLLabelElement>
}
export function Switch({
    checked,
    defaultChecked,
    onCheckedChange,
    disabled,
    required,
    className,
    onClick,
    ...props
}: Props) {
    return (
        <HeroSwitch
            {...props}
            isSelected={checked}
            defaultSelected={defaultChecked}
            onChange={onCheckedChange}
            isDisabled={disabled}
            isRequired={required}
            className={className}
            size="sm"
        >
            <HeroSwitch.Content onClick={onClick}>
                <HeroSwitch.Control>
                    <HeroSwitch.Thumb />
                </HeroSwitch.Control>
            </HeroSwitch.Content>
        </HeroSwitch>
    )
}
