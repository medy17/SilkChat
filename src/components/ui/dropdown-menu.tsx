import { collectionText } from "./collection-text"
import { Dropdown, Header, Kbd, Separator } from "@heroui/react"
import { Pressable } from "react-aria-components"
import { Slot } from "@radix-ui/react-slot"
import {
    Children,
    createContext,
    useContext,
    type ComponentProps,
    type ReactElement,
    type ReactNode
} from "react"
import { cn } from "@/lib/utils"
import { useOverlayControl, type OverlayProps } from "./overlay-state"

const MenuControl = createContext({ setOpen: (_open: boolean) => {} })
export function DropdownMenu({ children, ...props }: OverlayProps) {
    const control = useOverlayControl(props)
    return (
        <MenuControl value={control}>
            <Dropdown isOpen={control.open} onOpenChange={control.setOpen}>
                {children}
            </Dropdown>
        </MenuControl>
    )
}
export function DropdownMenuTrigger({
    asChild,
    children,
    ...props
}: ComponentProps<"button"> & { asChild?: boolean }) {
    return (
        <Pressable>
            {asChild ? (
                <Slot {...props}>{children}</Slot>
            ) : (
                <button type="button" {...props}>
                    {children}
                </button>
            )}
        </Pressable>
    )
}
export function DropdownMenuPortal({ children }: { children?: ReactNode }) {
    return <>{children}</>
}
type ContentProps = Omit<ComponentProps<typeof Dropdown.Popover>, "children" | "placement"> & {
    children?: ReactNode
    side?: "top" | "bottom" | "left" | "right"
    align?: "start" | "center" | "end"
    sideOffset?: number
    alignOffset?: number
    collisionPadding?: number
    avoidCollisions?: boolean
    forceMount?: boolean
}
export function DropdownMenuContent({
    children,
    side = "bottom",
    align = "start",
    sideOffset = 4,
    alignOffset = 0,
    collisionPadding = 12,
    avoidCollisions = true,
    forceMount: _forceMount,
    className,
    ...props
}: ContentProps) {
    const placement =
        side === "left" || side === "right"
            ? align === "center"
                ? side
                : (`${side} ${align === "start" ? "top" : "bottom"}` as const)
            : align === "center"
              ? side
              : (`${side} ${align}` as const)
    return (
        <Dropdown.Popover
            {...props}
            placement={placement}
            offset={sideOffset}
            crossOffset={alignOffset}
            containerPadding={collisionPadding}
            shouldFlip={avoidCollisions}
            className={cn("z-[100] min-w-32", typeof className === "string" && className)}
        >
            <Dropdown.Menu shouldCloseOnSelect={false}>{children}</Dropdown.Menu>
        </Dropdown.Popover>
    )
}
type ItemProps = Omit<ComponentProps<typeof Dropdown.Item>, "onAction" | "children" | "variant"> & {
    children?: ReactNode
    disabled?: boolean
    inset?: boolean
    variant?: "default" | "destructive"
    onClick?: () => void
    onSelect?: (event: Event) => void
}
export function DropdownMenuItem({
    disabled,
    inset,
    variant = "default",
    onClick,
    onSelect,
    className,
    children,
    textValue,
    ...props
}: ItemProps) {
    const { setOpen } = useContext(MenuControl)
    return (
        <Dropdown.Item
            {...props}
            textValue={textValue ?? collectionText(children)}
            isDisabled={disabled}
            variant={variant === "destructive" ? "danger" : "default"}
            className={cn(inset && "pl-8", className)}
            onAction={() => {
                const event = new Event("select", { cancelable: true })
                onSelect?.(event)
                onClick?.()
                if (!event.defaultPrevented) setOpen(false)
            }}
        >
            {children}
        </Dropdown.Item>
    )
}
export const DropdownMenuGroup = Dropdown.Section
export function DropdownMenuLabel({ children, ...props }: ComponentProps<"header">) {
    return (
        <Dropdown.Section>
            <Header {...props}>{children}</Header>
        </Dropdown.Section>
    )
}
export const DropdownMenuSeparator = Separator
export function DropdownMenuShortcut({ children, ...props }: ComponentProps<"kbd">) {
    return <Kbd {...props}>{children}</Kbd>
}
export function DropdownMenuSub({ children }: { children?: ReactNode }) {
    return (
        <Dropdown.SubmenuTrigger>
            {Children.toArray(children) as ReactElement[]}
        </Dropdown.SubmenuTrigger>
    )
}
export function DropdownMenuSubTrigger({
    disabled,
    children,
    ...props
}: Omit<ComponentProps<typeof Dropdown.Item>, "children"> & {
    children?: ReactNode
    disabled?: boolean
}) {
    return (
        <Dropdown.Item {...props} isDisabled={disabled}>
            {children}
            <Dropdown.SubmenuIndicator />
        </Dropdown.Item>
    )
}
export function DropdownMenuSubContent(props: ContentProps) {
    return <DropdownMenuContent side="right" {...props} />
}
