import * as React from "react"
import { useIsMobile } from "@/hooks/use-mobile"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import {
    Drawer,
    DrawerContent,
    DrawerDescription,
    DrawerHeader,
    DrawerTitle,
    DrawerTrigger
} from "@/components/ui/drawer"
import { cn } from "@/lib/utils"

interface ResponsivePopoverProps {
    open?: boolean
    onOpenChange?: (open: boolean) => void
    children: React.ReactNode
    modal?: boolean
    nested?: boolean
}

interface ResponsivePopoverTriggerProps {
    children: React.ReactNode
    asChild?: boolean
}

interface ResponsivePopoverContentProps extends Omit<React.ComponentPropsWithoutRef<typeof PopoverContent>, "children"> {
    children: React.ReactNode
    className?: string
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

    const contextValue = React.useMemo(
        () => ({ isMobile }),
        [isMobile]
    )

    if (isMobile) {
        return (
            <ResponsivePopoverContext.Provider value={contextValue}>
                <Drawer open={open} onOpenChange={onOpenChange} modal={modal} nested={nested}>
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
                className={cn(
                    "max-h-[85dvh] w-full max-w-full overflow-x-hidden overflow-y-auto bg-popover",
                    className
                )}
            >
                {(title || description) && (
                    <DrawerHeader className="pb-0 text-left">
                        {title && <DrawerTitle>{title}</DrawerTitle>}
                        {description && <DrawerDescription>{description}</DrawerDescription>}
                    </DrawerHeader>
                )}
                <div
                    className={cn(
                        "flex min-h-0 flex-1 flex-col",
                        !title && !description && !className?.includes("p-0") && "mt-4"
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
            className={cn("bg-popover rounded-none md:rounded-md", className)}
            {...props}
        >
            {children}
        </PopoverContent>
    )
} 
