import { SearchField as HeroSearchField } from "@heroui/react"
import type { ComponentProps } from "react"

export function SearchField({
    placeholder,
    groupClassName,
    ...props
}: ComponentProps<typeof HeroSearchField> & {
    placeholder?: string
    groupClassName?: string
}) {
    return (
        <HeroSearchField aria-label={placeholder} {...props}>
            <HeroSearchField.Group className={groupClassName}>
                <HeroSearchField.SearchIcon />
                <HeroSearchField.Input placeholder={placeholder} />
                <HeroSearchField.ClearButton />
            </HeroSearchField.Group>
        </HeroSearchField>
    )
}
