import { OverlayPortalContext } from "./overlay-portal"
import { Popover as HeroPopover } from "@heroui/react"
import { Slot } from "@radix-ui/react-slot"
import { createContext, useContext, useRef, useState, type ComponentProps } from "react"
import { mergeProps, mergeRefs, useOverlay } from "react-aria"
import { OverlayTriggerStateContext } from "react-aria-components"
import { cn } from "@/lib/utils"
import { OpenFocus } from "./dialog"
import type { OverlayProps } from "./overlay-state"

const ModalContext = createContext(false)
export function Popover({
    open,
    defaultOpen,
    onOpenChange,
    modal = false,
    children
}: OverlayProps) {
    return (
        <ModalContext value={modal}>
            <HeroPopover isOpen={open} defaultOpen={defaultOpen} onOpenChange={onOpenChange}>
                {children}
            </HeroPopover>
        </ModalContext>
    )
}
export function PopoverTrigger({
    asChild,
    children,
    ...props
}: ComponentProps<"button"> & { asChild?: boolean }) {
    return (
        <HeroPopover.Trigger<"button">
            {...props}
            render={(triggerProps) =>
                asChild ? (
                    <Slot {...triggerProps}>{children}</Slot>
                ) : (
                    <button type="button" {...triggerProps}>
                        {children}
                    </button>
                )
            }
        />
    )
}
export function PopoverContent({
    side = "bottom",
    align = "center",
    sideOffset = 4,
    alignOffset = 0,
    collisionPadding = 12,
    className,
    style,
    children,
    onOpenAutoFocus,
    ref,
    "aria-label": ariaLabel,
    "aria-labelledby": ariaLabelledBy,
    ...props
}: Omit<ComponentProps<typeof HeroPopover.Content>, "placement" | "style"> & {
    style?: ComponentProps<typeof HeroPopover.Dialog>["style"]
    side?: "top" | "bottom" | "left" | "right"
    align?: "start" | "center" | "end"
    sideOffset?: number
    alignOffset?: number
    collisionPadding?: number
    onOpenAutoFocus?: (event: Event) => void
}) {
    const modal = useContext(ModalContext)
    const state = useContext(OverlayTriggerStateContext)
    const contentRef = useRef<HTMLDivElement>(null)
    // HeroUI's nonmodal popover only closes on blur. Register pointer dismissal
    // with React Aria's overlay stack so nested menus still close one at a time.
    const { overlayProps } = useOverlay(
        {
            isOpen: !modal && !!state?.isOpen,
            onClose: state?.close,
            isDismissable: true,
            shouldCloseOnBlur: true,
            isKeyboardDismissDisabled: props.isKeyboardDismissDisabled,
            shouldCloseOnInteractOutside: props.shouldCloseOnInteractOutside
        },
        contentRef
    )
    const [portalContainer, setPortalContainer] = useState<HTMLDivElement | null>(null)
    const placement =
        side === "left" || side === "right"
            ? align === "center"
                ? side
                : (`${side} ${align === "start" ? "top" : "bottom"}` as const)
            : align === "center"
              ? side
              : (`${side} ${align}` as const)
    return (
        <OverlayPortalContext value={portalContainer}>
            <HeroPopover.Content
                {...props}
                ref={mergeRefs(contentRef, ref)}
                containerPadding={collisionPadding}
                isNonModal={!modal}
                placement={placement}
                offset={sideOffset}
                crossOffset={alignOffset}
                className="flex flex-col bg-transparent p-0 shadow-none"
            >
                <HeroPopover.Dialog
                    render={(dialogProps) => (
                        <section {...mergeProps(dialogProps, modal ? {} : overlayProps)} />
                    )}
                    aria-label={ariaLabel}
                    aria-labelledby={ariaLabelledBy}
                    style={style}
                    className={cn(
                        "min-h-0 w-72 overflow-y-auto rounded-md border bg-popover p-4 text-popover-foreground shadow-md outline-none",
                        typeof className === "string" && className
                    )}
                >
                    <OpenFocus onOpenAutoFocus={onOpenAutoFocus} />
                    {children}
                </HeroPopover.Dialog>
                <div ref={setPortalContainer} className="contents" />
            </HeroPopover.Content>
        </OverlayPortalContext>
    )
}
