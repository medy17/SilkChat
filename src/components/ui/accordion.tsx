import { Accordion as HeroAccordion } from "@heroui/react"
import { useState, type ComponentProps, type ReactNode } from "react"

type SelectionProps =
    | {
          type?: "single"
          value?: string
          defaultValue?: string
          onValueChange?: (value: string) => void
      }
    | {
          type: "multiple"
          value?: string[]
          defaultValue?: string[]
          onValueChange?: (value: string[]) => void
      }
type Props = Omit<ComponentProps<typeof HeroAccordion>, "onExpandedChange"> &
    SelectionProps & {
        collapsible?: boolean
    }
export function Accordion(props: Props) {
    const {
        type = "single",
        value,
        defaultValue,
        onValueChange: _onValueChange,
        collapsible = false,
        ...rest
    } = props
    const keys = (value: string | string[]) =>
        typeof value === "string" ? (value ? [value] : []) : value
    const [localKeys, setLocalKeys] = useState(() => keys(defaultValue ?? []))
    return (
        <HeroAccordion
            {...rest}
            allowsMultipleExpanded={type === "multiple"}
            expandedKeys={value === undefined ? localKeys : keys(value)}
            onExpandedChange={(next) => {
                if (!collapsible && type === "single" && next.size === 0) return
                const values = [...next].map(String)
                if (value === undefined) setLocalKeys(values)
                if (props.type === "multiple") props.onValueChange?.(values)
                else props.onValueChange?.(values[0] ?? "")
            }}
        />
    )
}
export function AccordionItem({
    value,
    ...props
}: ComponentProps<typeof HeroAccordion.Item> & { value: string }) {
    return <HeroAccordion.Item {...props} id={value} />
}
export function AccordionTrigger({
    children,
    ...props
}: Omit<ComponentProps<typeof HeroAccordion.Trigger>, "children"> & { children?: ReactNode }) {
    return (
        <HeroAccordion.Heading>
            <HeroAccordion.Trigger {...props}>
                {children}
                <HeroAccordion.Indicator />
            </HeroAccordion.Trigger>
        </HeroAccordion.Heading>
    )
}
export function AccordionContent({
    children,
    ...props
}: ComponentProps<typeof HeroAccordion.Panel>) {
    return (
        <HeroAccordion.Panel {...props}>
            <HeroAccordion.Body>{children}</HeroAccordion.Body>
        </HeroAccordion.Panel>
    )
}
