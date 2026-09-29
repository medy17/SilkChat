import { Slider as HeroSlider } from "@heroui/react"
import type { ComponentProps } from "react"

type Props = Omit<
    ComponentProps<typeof HeroSlider>,
    "onChange" | "onChangeEnd" | "value" | "defaultValue"
> & {
    value?: number[]
    defaultValue?: number[]
    min?: number
    max?: number
    disabled?: boolean
    onValueChange?: (value: number[]) => void
    onValueCommit?: (value: number[]) => void
}
export function Slider({
    value,
    defaultValue,
    min = 0,
    max = 100,
    disabled,
    onValueChange,
    onValueCommit,
    ...props
}: Props) {
    const values = value ?? defaultValue ?? [min]
    return (
        <HeroSlider
            {...props}
            value={value}
            defaultValue={defaultValue}
            minValue={min}
            maxValue={max}
            isDisabled={disabled}
            onChange={(next) => onValueChange?.(Array.isArray(next) ? next : [next])}
            onChangeEnd={(next) => onValueCommit?.(Array.isArray(next) ? next : [next])}
        >
            <HeroSlider.Track>
                <HeroSlider.Fill />
                {values.map((_, index) => (
                    <HeroSlider.Thumb key={index} index={index} />
                ))}
            </HeroSlider.Track>
        </HeroSlider>
    )
}
