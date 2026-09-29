import { Radio, RadioGroup as HeroRadioGroup } from "@heroui/react"
import type { ComponentProps } from "react"
import { cn } from "@/lib/utils"

type GroupProps = Omit<ComponentProps<typeof HeroRadioGroup>, "onChange"> & {
    onValueChange?: (value: string) => void
    disabled?: boolean
}
export function RadioGroup({ onValueChange, disabled, className, ...props }: GroupProps) {
    return (
        <HeroRadioGroup
            {...props}
            onChange={onValueChange}
            isDisabled={disabled}
            className={cn("grid gap-3", typeof className === "string" && className)}
        />
    )
}
export function RadioGroupItem({
    disabled,
    ...props
}: ComponentProps<typeof Radio> & { disabled?: boolean }) {
    return (
        <Radio {...props} isDisabled={disabled}>
            <Radio.Content>
                <Radio.Control>
                    <Radio.Indicator />
                </Radio.Control>
            </Radio.Content>
        </Radio>
    )
}
