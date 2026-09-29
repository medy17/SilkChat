import { OverlayPortalContext } from "./overlay-portal"
import { Modal } from "@heroui/react"
import { Slot } from "@radix-ui/react-slot"
import {
    createContext,
    useContext,
    useState,
    useEffect,
    useEffectEvent,
    type ComponentProps,
    type ReactNode
} from "react"
import { XIcon } from "lucide-react"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import {
    DialogDescriptionContext,
    useDescriptionState,
    useDialogDescription,
    useOverlayControl,
    allowOutsideInteraction,
    type OverlayProps,
    type OutsideEvent
} from "./overlay-state"

const DialogControl = createContext({ open: false, setOpen: (_open: boolean) => {} })
export function Dialog({ children, ...props }: OverlayProps) {
    const control = useOverlayControl(props)
    return (
        <DialogControl value={control}>
            <Modal isOpen={control.open} onOpenChange={control.setOpen}>
                {children}
            </Modal>
        </DialogControl>
    )
}
export function DialogTrigger({
    asChild,
    children,
    ...props
}: ComponentProps<"button"> & { asChild?: boolean }) {
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
export function DialogClose({ onClick, ...props }: ComponentProps<typeof Button>) {
    const { setOpen } = useContext(DialogControl)
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
export type DialogContentProps = Omit<
    ComponentProps<typeof Modal.Dialog>,
    "children" | "className"
> & { children?: ReactNode; className?: string } & {
    showCloseButton?: boolean
    overlayClassName?: string
    onOpenAutoFocus?: (event: Event) => void
    onInteractOutside?: (event: OutsideEvent) => void
    onEscapeKeyDown?: (event: KeyboardEvent) => void
}
export function DialogContent({
    className,
    overlayClassName,
    children,
    showCloseButton = true,
    onOpenAutoFocus,
    onInteractOutside,
    onEscapeKeyDown,
    ...props
}: DialogContentProps) {
    const description = useDescriptionState()
    const [portalContainer, setPortalContainer] = useState<HTMLElement | null>(null)
    return (
        <OverlayPortalContext value={portalContainer}>
            <DialogDescriptionContext value={description}>
                <Modal.Backdrop
                    data-slot="dialog-overlay"
                    style={{ zIndex: "var(--z-index-overlay)" }}
                    className={overlayClassName}
                    shouldCloseOnInteractOutside={(target) =>
                        allowOutsideInteraction(target, onInteractOutside)
                    }
                >
                    <Modal.Container
                        placement="center"
                        className="pointer-events-none w-full max-w-none p-0 sm:w-full sm:p-0"
                    >
                        <Modal.Dialog
                            {...props}
                            aria-describedby={
                                description.hasDescription ? description.id : undefined
                            }
                            className={cn(
                                "pointer-events-auto relative grid w-full max-w-[calc(100%-2rem)] gap-4 rounded-lg border bg-background p-6 shadow-lg sm:max-w-lg",
                                className
                            )}
                            render={(domProps) => (
                                <section
                                    {...domProps}
                                    onKeyDownCapture={(event) => {
                                        if (event.key !== "Escape") return
                                        onEscapeKeyDown?.(event.nativeEvent)
                                        if (event.nativeEvent.defaultPrevented) {
                                            event.preventDefault()
                                            event.stopPropagation()
                                        }
                                    }}
                                />
                            )}
                        >
                            <OpenFocus onOpenAutoFocus={onOpenAutoFocus} />
                            {children}
                            {showCloseButton && (
                                <DialogClose
                                    variant="ghost"
                                    size="icon"
                                    aria-label="Close"
                                    className="absolute top-2 right-2"
                                >
                                    <XIcon className="size-4" />
                                </DialogClose>
                            )}
                        </Modal.Dialog>
                        <div ref={setPortalContainer} className="pointer-events-auto contents" />
                    </Modal.Container>
                </Modal.Backdrop>
            </DialogDescriptionContext>
        </OverlayPortalContext>
    )
}
export function OpenFocus({ onOpenAutoFocus }: { onOpenAutoFocus?: (event: Event) => void }) {
    const handleOpen = useEffectEvent(() =>
        onOpenAutoFocus?.(new Event("openAutoFocus", { cancelable: true }))
    )
    useEffect(() => {
        handleOpen()
    }, [])
    return null
}
export function DialogHeader({ className, ...props }: ComponentProps<"div">) {
    return <Modal.Header {...props} className={cn("flex flex-col gap-2", className)} />
}
export function DialogFooter({ className, ...props }: ComponentProps<"div">) {
    return (
        <Modal.Footer
            {...props}
            className={cn("flex flex-col-reverse gap-2 sm:flex-row sm:justify-end", className)}
        />
    )
}
export const DialogTitle = Modal.Heading
export function DialogDescription({
    asChild,
    ...props
}: ComponentProps<"p"> & { asChild?: boolean }) {
    const description = useDialogDescription()
    useEffect(() => {
        description?.register(true)
        return () => description?.register(false)
    }, [description?.register])
    const Comp = asChild ? Slot : "p"
    return (
        <Comp
            {...props}
            id={description?.id}
            className={cn("text-muted-foreground text-sm", props.className)}
        />
    )
}
