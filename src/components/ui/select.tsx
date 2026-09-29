import { collectionText } from "./collection-text"
import { Header, ListBox, Select as HeroSelect, Separator } from "@heroui/react"
import { useContext, type ComponentProps, type ReactNode } from "react"
import { SelectStateContext } from "react-aria-components"
import { cn } from "@/lib/utils"

type Props = Omit<
    ComponentProps<typeof HeroSelect<object, "single">>,
    "value" | "defaultValue" | "onChange"
> & {
    value?: string
    defaultValue?: string
    onValueChange?: (value: string) => void
    disabled?: boolean
    required?: boolean
    open?: boolean
}
export function Select({
    value,
    defaultValue,
    onValueChange,
    disabled,
    required,
    open,
    ...props
}: Props) {
    return (
        <HeroSelect
            {...props}
            value={value === undefined ? undefined : value || null}
            defaultValue={defaultValue}
            onChange={(value) => {
                if (value !== null) onValueChange?.(String(value))
            }}
            isDisabled={disabled}
            isRequired={required}
            isOpen={open}
        />
    )
}
export function SelectTrigger({
    children,
    className,
    size = "default",
    ...props
}: Omit<ComponentProps<typeof HeroSelect.Trigger>, "children"> & {
    children?: ReactNode
    size?: "sm" | "default"
}) {
    return (
        <HeroSelect.Trigger
            {...props}
            className={cn(
                "min-h-0 items-center gap-2 pe-3",
                size === "sm" && "h-8",
                typeof className === "string" && className
            )}
        >
            {children}
            <HeroSelect.Indicator className="static ms-auto shrink-0" />
        </HeroSelect.Trigger>
    )
}
export function SelectValue({
    placeholder,
    ...props
}: ComponentProps<typeof HeroSelect.Value> & { placeholder?: string }) {
    return (
        <HeroSelect.Value {...props}>
            {({ isPlaceholder, defaultChildren }) =>
                isPlaceholder ? placeholder : defaultChildren
            }
        </HeroSelect.Value>
    )
}
export function SelectContent({
    children,
    footer,
    className,
    position: _position,
    ...props
}: Omit<ComponentProps<typeof HeroSelect.Popover>, "children"> & {
    children?: ReactNode
    footer?: ReactNode
    position?: "popper" | "item-aligned"
}) {
    // Select also renders this subtree to build its collection. Actions belong
    // only in the live popover, where the selection state is available.
    const state = useContext(SelectStateContext)
    return (
        <HeroSelect.Popover
            {...props}
            className={cn(
                "z-[100] max-h-80 min-w-[var(--trigger-width)]",
                typeof className === "string" && className
            )}
        >
            <ListBox>{children}</ListBox>
            {state && footer}
        </HeroSelect.Popover>
    )
}
export function SelectItem({
    value,
    disabled,
    children,
    textValue,
    ...props
}: Omit<ComponentProps<typeof ListBox.Item>, "id" | "children"> & {
    value: string
    disabled?: boolean
    children?: ReactNode
}) {
    return (
        <ListBox.Item
            {...props}
            id={value}
            textValue={textValue ?? collectionText(children)}
            isDisabled={disabled}
        >
            {children}
            <ListBox.ItemIndicator />
        </ListBox.Item>
    )
}
export const SelectGroup = ListBox.Section
export const SelectLabel = Header
export const SelectSeparator = Separator
