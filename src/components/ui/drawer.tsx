import { OverlayPortalContext } from "./overlay-portal"
import { Drawer as HeroDrawer, Modal } from "@heroui/react"
import { mergeRefs } from "react-aria"
import { Slot } from "@radix-ui/react-slot"
import { createContext, useContext, useState, type ComponentProps, type ReactNode } from "react"
import { useIsMobile } from "@/hooks/use-mobile"
import { useOverlayBackDismiss } from "@/hooks/use-overlay-back-dismiss"
import { cn } from "@/lib/utils"
import { Button } from "./button"
import { DialogDescription, OpenFocus } from "./dialog"
import {
    DialogDescriptionContext,
    useDescriptionState,
    useOverlayControl,
    allowOutsideInteraction,
    type OverlayProps,
    type OutsideEvent
} from "./overlay-state"
import * as Nonmodal from "./nonmodal-drawer"

const DrawerContext = createContext({
    nonmodal: false,
    direction: "bottom" as "top" | "bottom" | "left" | "right",
    setOpen: (_open: boolean) => {}
})
type Props = OverlayProps & {
    nested?: boolean
    direction?: "top" | "bottom" | "left" | "right"
    repositionInputs?: boolean
}
export function Drawer({
    children,
    modal = true,
    nested,
    direction = "bottom",
    repositionInputs,
    ...props
}: Props) {
    const control = useOverlayControl(props)
    const isMobile = useIsMobile()
    useOverlayBackDismiss({
        open: control.open,
        enabled: isMobile && modal,
        onClose: () => control.setOpen(false)
    })
    const value = { nonmodal: !modal, direction, setOpen: control.setOpen }
    return (
        <DrawerContext value={value}>
            {modal ? (
                <HeroDrawer isOpen={control.open} onOpenChange={control.setOpen}>
                    {children}
                </HeroDrawer>
            ) : (
                <Nonmodal.Drawer
                    {...props}
                    open={control.open}
                    onOpenChange={control.setOpen}
                    modal={false}
                    nested={nested}
                    direction={direction}
                    repositionInputs={repositionInputs}
                >
                    {children}
                </Nonmodal.Drawer>
            )}
        </DrawerContext>
    )
}
export function DrawerTrigger({
    asChild,
    children,
    ...props
}: ComponentProps<"button"> & { asChild?: boolean }) {
    const { nonmodal } = useContext(DrawerContext)
    if (nonmodal)
        return (
            <Nonmodal.DrawerTrigger asChild={asChild} {...props}>
                {children}
            </Nonmodal.DrawerTrigger>
        )
    return (
        <Modal.Trigger<"button">
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
export function DrawerClose({ onClick, ...props }: ComponentProps<typeof Button>) {
    const { setOpen } = useContext(DrawerContext)
    return (
        <Button
            {...props}
            onClick={(event) => {
                onClick?.(event)
                if (!event.defaultPrevented) setOpen(false)
            }}
        />
    )
}
type ContentProps = ComponentProps<"div"> & {
    children?: ReactNode
    className?: string
    placement?: "top" | "bottom" | "left" | "right"
    overlayClassName?: string
    onInteractOutside?: (event: OutsideEvent) => void
    onOpenAutoFocus?: (event: Event) => void
}
export function DrawerContent({
    className,
    overlayClassName,
    children,
    onInteractOutside,
    onOpenAutoFocus,
    placement,
    ref,
    ...props
}: ContentProps) {
    const { nonmodal, direction } = useContext(DrawerContext)
    const description = useDescriptionState()
    const [portalContainer, setPortalContainer] = useState<HTMLElement | null>(null)
    if (nonmodal)
        return (
            <Nonmodal.DrawerContent
                ref={ref}
                className={className}
                overlayClassName={overlayClassName}
                onInteractOutside={
                    onInteractOutside
                        ? (event) => {
                              if (
                                  !allowOutsideInteraction(
                                      event.target as Element,
                                      onInteractOutside
                                  )
                              )
                                  event.preventDefault()
                          }
                        : undefined
                }
                onOpenAutoFocus={onOpenAutoFocus}
                {...props}
            >
                {children}
            </Nonmodal.DrawerContent>
        )
    return (
        <OverlayPortalContext value={portalContainer}>
            <DialogDescriptionContext value={description}>
                <HeroDrawer.Backdrop
                    style={{ zIndex: "var(--z-index-overlay)" }}
                    className={overlayClassName}
                    shouldCloseOnInteractOutside={(target) =>
                        allowOutsideInteraction(target, onInteractOutside)
                    }
                >
                    <HeroDrawer.Content placement={placement ?? direction} className="z-[80]">
                        <HeroDrawer.Dialog
                            render={(dialogProps) => (
                                <div
                                    {...dialogProps}
                                    {...props}
                                    ref={(node) => {
                                        const merged = mergeRefs(dialogProps.ref, ref)
                                        if (typeof merged === "function") return merged(node)
                                        if (merged) merged.current = node
                                    }}
                                />
                            )}
                            aria-describedby={
                                description.hasDescription ? description.id : undefined
                            }
                            className={cn(
                                "flex min-h-0 flex-col bg-background p-0 font-sans",
                                className
                            )}
                        >
                            <OpenFocus onOpenAutoFocus={onOpenAutoFocus} />
                            {((placement ?? direction) === "bottom" ||
                                (placement ?? direction) === "top") && <HeroDrawer.Handle />}
                            {children}
                        </HeroDrawer.Dialog>
                        <div ref={setPortalContainer} className="pointer-events-auto contents" />
                    </HeroDrawer.Content>
                </HeroDrawer.Backdrop>
            </DialogDescriptionContext>
        </OverlayPortalContext>
    )
}
export function DrawerHeader(props: ComponentProps<"div">) {
    const { nonmodal } = useContext(DrawerContext)
    return nonmodal ? (
        <Nonmodal.DrawerHeader {...props} />
    ) : (
        <HeroDrawer.Header {...props} className={cn("p-4", props.className)} />
    )
}
export function DrawerFooter(props: ComponentProps<"div">) {
    const { nonmodal } = useContext(DrawerContext)
    return nonmodal ? (
        <Nonmodal.DrawerFooter {...props} />
    ) : (
        <HeroDrawer.Footer {...props} className={cn("p-4", props.className)} />
    )
}
export function DrawerTitle(props: ComponentProps<typeof HeroDrawer.Heading>) {
    const { nonmodal } = useContext(DrawerContext)
    return nonmodal ? <Nonmodal.DrawerTitle {...props} /> : <HeroDrawer.Heading {...props} />
}
export function DrawerDescription(props: ComponentProps<"p">) {
    const { nonmodal } = useContext(DrawerContext)
    return nonmodal ? <Nonmodal.DrawerDescription {...props} /> : <DialogDescription {...props} />
}
