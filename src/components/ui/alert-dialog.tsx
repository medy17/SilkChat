import { AlertDialog as HeroAlertDialog } from "@heroui/react"
import { createContext, useContext, type ComponentProps, type ReactNode } from "react"
import { Button } from "./button"
import { DialogDescription, OpenFocus } from "./dialog"
import {
    DialogDescriptionContext,
    useDescriptionState,
    useOverlayControl,
    type OverlayProps
} from "./overlay-state"
import { cn } from "@/lib/utils"

const AlertControl = createContext({ open: false, setOpen: (_open: boolean) => {} })
export function AlertDialog({ children, ...props }: OverlayProps) {
    const control = useOverlayControl(props)
    return (
        <AlertControl value={control}>
            <HeroAlertDialog isOpen={control.open} onOpenChange={control.setOpen}>
                {children}
            </HeroAlertDialog>
        </AlertControl>
    )
}
export function AlertDialogTrigger({ onClick, ...props }: ComponentProps<typeof Button>) {
    const { setOpen } = useContext(AlertControl)
    return (
        <Button
            {...props}
            onClick={(event) => {
                onClick?.(event)
                if (!event.defaultPrevented) setOpen(true)
            }}
        />
    )
}
export function AlertDialogContent({
    className,
    onOpenAutoFocus,
    children,
    ...props
}: Omit<ComponentProps<typeof HeroAlertDialog.Dialog>, "children" | "className"> & {
    children?: ReactNode
    className?: string
    onOpenAutoFocus?: (event: Event) => void
}) {
    const description = useDescriptionState()
    return (
        <DialogDescriptionContext value={description}>
            <HeroAlertDialog.Backdrop
                style={{ zIndex: "var(--z-index-overlay)" }}
                isKeyboardDismissDisabled={false}
            >
                <HeroAlertDialog.Container placement="center">
                    <HeroAlertDialog.Dialog
                        {...props}
                        aria-describedby={description.hasDescription ? description.id : undefined}
                        className={cn("grid gap-4 rounded-lg border bg-background p-6", className)}
                    >
                        <OpenFocus onOpenAutoFocus={onOpenAutoFocus} />
                        {children}
                    </HeroAlertDialog.Dialog>
                </HeroAlertDialog.Container>
            </HeroAlertDialog.Backdrop>
        </DialogDescriptionContext>
    )
}
export const AlertDialogHeader = HeroAlertDialog.Header
export const AlertDialogFooter = HeroAlertDialog.Footer
export const AlertDialogTitle = HeroAlertDialog.Heading
export const AlertDialogDescription = DialogDescription
export function AlertDialogAction({ onClick, ...props }: ComponentProps<typeof Button>) {
    const { setOpen } = useContext(AlertControl)
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
export function AlertDialogCancel(props: ComponentProps<typeof Button>) {
    return <AlertDialogAction variant="outline" autoFocus {...props} />
}
