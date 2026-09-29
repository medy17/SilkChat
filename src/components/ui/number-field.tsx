import { NumberField as HeroNumberField } from "@heroui/react"
import type { ComponentProps } from "react"

/** Numeric values stay numeric across keyboard, typing and stepper interaction. */
export function NumberField({
    className,
    placeholder,
    ...props
}: ComponentProps<typeof HeroNumberField> & { placeholder?: string }) {
    const name = props["aria-label"]?.toLocaleLowerCase()
    return (
        <HeroNumberField {...props} className={className}>
            <HeroNumberField.Group>
                <HeroNumberField.DecrementButton
                    aria-label={name ? `Decrease ${name}` : "Decrease"}
                />
                <HeroNumberField.Input placeholder={placeholder} />
                <HeroNumberField.IncrementButton
                    aria-label={name ? `Increase ${name}` : "Increase"}
                />
            </HeroNumberField.Group>
        </HeroNumberField>
    )
}
