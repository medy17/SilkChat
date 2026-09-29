import { createContext, useContext, useId, useState, useCallback, type ReactNode } from "react"

export type OverlayProps = {
    open?: boolean
    defaultOpen?: boolean
    onOpenChange?: (open: boolean) => void
    children?: ReactNode
    modal?: boolean
}
export function useOverlayControl({ open, defaultOpen = false, onOpenChange }: OverlayProps) {
    const [localOpen, setLocalOpen] = useState(defaultOpen)
    const setOpen = useCallback(
        (next: boolean) => {
            if (open === undefined) setLocalOpen(next)
            onOpenChange?.(next)
        },
        [open, onOpenChange]
    )
    return { open: open ?? localOpen, setOpen }
}
export const DialogDescriptionContext = createContext<{
    id: string
    register: (mounted: boolean) => void
} | null>(null)
export function useDescriptionState() {
    const id = useId()
    const [hasDescription, register] = useState(false)
    return { id, hasDescription, register }
}
export type OutsideEvent = {
    target: Element
    defaultPrevented: boolean
    preventDefault: () => void
}
export function allowOutsideInteraction(target: Element, handler?: (event: OutsideEvent) => void) {
    const event: OutsideEvent = {
        target,
        defaultPrevented: false,
        preventDefault() {
            this.defaultPrevented = true
        }
    }
    handler?.(event)
    return !event.defaultPrevented
}
export function useDialogDescription() {
    return useContext(DialogDescriptionContext)
}
