import { Disclosure } from "@heroui/react"
import type { ComponentProps } from "react"
export function Collapsible({
    open,
    defaultOpen,
    onOpenChange,
    disabled,
    ...props
}: ComponentProps<typeof Disclosure> & {
    open?: boolean
    defaultOpen?: boolean
    onOpenChange?: (open: boolean) => void
    disabled?: boolean
}) {
    return (
        <Disclosure
            {...props}
            isExpanded={open}
            defaultExpanded={defaultOpen}
            onExpandedChange={onOpenChange}
            isDisabled={disabled}
        />
    )
}
export const CollapsibleTrigger = Disclosure.Trigger
export const CollapsibleContent = Disclosure.Content
