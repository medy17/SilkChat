import * as React from "react"
import { useIsMobile } from "@/hooks/use-mobile"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import {
    Drawer,
    DrawerContent,
    DrawerDescription,
    DrawerTitle,
    DrawerTrigger
} from "@/components/ui/drawer"
import { cn } from "@/lib/utils"

interface ResponsivePopoverProps {
    open?: boolean
    onOpenChange?: (open: boolean) => void
    children: React.ReactNode
    // Desktop popover only. On mobile the drawer is always modal: it sits on the scrim and a
    // tap outside closes it.
    modal?: boolean
    nested?: boolean
}

interface ResponsivePopoverTriggerProps {
    children: React.ReactNode
    asChild?: boolean
}

interface ResponsivePopoverContentProps
    extends Omit<React.ComponentPropsWithoutRef<typeof PopoverContent>, "children"> {
    children: React.ReactNode
    className?: string
    // Names the mobile drawer for assistive tech. Neither is shown: like the popover it
    // replaces, the drawer opens straight into its content.
    title?: string
    description?: string
    side?: "top" | "right" | "bottom" | "left"
    showCloseButton?: boolean
    overlayClassName?: string
}

const ResponsivePopoverContext = React.createContext<{
    isMobile: boolean
}>({
    isMobile: false
})

export function ResponsivePopover({
    open,
    onOpenChange,
    children,
    modal = true,
    nested = false
}: ResponsivePopoverProps) {
    const isMobile = useIsMobile()

    const contextValue = React.useMemo(() => ({ isMobile }), [isMobile])

    if (isMobile) {
        return (
            <ResponsivePopoverContext.Provider value={contextValue}>
                <Drawer open={open} onOpenChange={onOpenChange} nested={nested}>
                    {children}
                </Drawer>
            </ResponsivePopoverContext.Provider>
        )
    }

    return (
        <ResponsivePopoverContext.Provider value={contextValue}>
            <Popover open={open} onOpenChange={onOpenChange} modal={modal}>
                {children}
            </Popover>
        </ResponsivePopoverContext.Provider>
    )
}

export function ResponsivePopoverTrigger({
    children,
    asChild = false
}: ResponsivePopoverTriggerProps) {
    const { isMobile } = React.useContext(ResponsivePopoverContext)

    if (isMobile) {
        return <DrawerTrigger asChild={asChild}>{children}</DrawerTrigger>
    }

    return <PopoverTrigger asChild={asChild}>{children}</PopoverTrigger>
}

export function ResponsivePopoverContent({
    children,
    className,
    title,
    description,
    side = "bottom",
    showCloseButton: _showCloseButton = false,
    overlayClassName,
    align,
    alignOffset,
    sideOffset,
    ...props
}: ResponsivePopoverContentProps) {
    const { isMobile } = React.useContext(ResponsivePopoverContext)

    if (isMobile) {
        return (
            <DrawerContent
                overlayClassName={overlayClassName}
                className={cn("max-h-[85dvh] w-full max-w-full overflow-hidden", className)}
                {...(description ? {} : { "aria-describedby": undefined })}
            >
                {title && <DrawerTitle className="sr-only">{title}</DrawerTitle>}
                {description && <DrawerDescription>{description}</DrawerDescription>}
                {/* The content scrolls here, not on the drawer: vaul hangs a tall filler
                    under the drawer, which a scrolling drawer would scroll into. */}
                <div
                    className={cn(
                        "flex min-h-0 flex-1 flex-col overflow-y-auto overflow-x-hidden",
                        !className?.includes("p-0") && "mt-4"
                    )}
                >
                    {children}
                </div>
            </DrawerContent>
        )
    }

    return (
        <PopoverContent
            side={side}
            align={align}
            alignOffset={alignOffset}
            sideOffset={sideOffset}
            className={cn("rounded-none md:rounded-md", className)}
            {...props}
        >
            {children}
        </PopoverContent>
    )
}
