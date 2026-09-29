import { Checkbox as HeroCheckbox } from "@heroui/react"
import type { ComponentProps, MouseEventHandler } from "react"

type Props = Omit<ComponentProps<typeof HeroCheckbox>, "onChange" | "className" | "children"> & {
    checked?: boolean | "indeterminate"
    defaultChecked?: boolean
    onCheckedChange?: (checked: boolean) => void
    disabled?: boolean
    required?: boolean
    className?: string
    onClick?: MouseEventHandler<HTMLLabelElement>
}
export function Checkbox({
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
        <HeroCheckbox
            {...props}
            isSelected={checked === undefined ? undefined : checked === true}
            isIndeterminate={checked === "indeterminate"}
            defaultSelected={defaultChecked}
            onChange={onCheckedChange}
            isDisabled={disabled}
            isRequired={required}
            className={className}
        >
            <HeroCheckbox.Content onClick={onClick}>
                <HeroCheckbox.Control>
                    <HeroCheckbox.Indicator />
                </HeroCheckbox.Control>
            </HeroCheckbox.Content>
        </HeroCheckbox>
    )
}
