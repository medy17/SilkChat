import type { ComponentProps } from "react"
import { XIcon } from "lucide-react"
import {
    Drawer,
    DrawerTrigger,
    DrawerClose,
    DrawerContent,
    DrawerHeader,
    DrawerFooter,
    DrawerTitle,
    DrawerDescription
} from "./drawer"
import { cn } from "@/lib/utils"
export const Sheet = Drawer
export const SheetTrigger = DrawerTrigger
export const SheetClose = DrawerClose
export const SheetHeader = DrawerHeader
export const SheetFooter = DrawerFooter
export const SheetTitle = DrawerTitle
export const SheetDescription = DrawerDescription
export function SheetContent({
    side = "right",
    showCloseButton = true,
    children,
    className,
    ...props
}: ComponentProps<typeof DrawerContent> & {
    side?: "top" | "bottom" | "left" | "right"
    showCloseButton?: boolean
}) {
    return (
        <DrawerContent
            {...props}
            placement={side}
            className={cn("h-full max-h-none w-3/4 gap-4 border-l sm:max-w-sm", className)}
        >
            {children}
            {showCloseButton && (
                <DrawerClose
                    variant="ghost"
                    size="icon"
                    aria-label="Close"
                    className="absolute top-2 right-2"
                >
                    <XIcon className="size-4" />
                </DrawerClose>
            )}
        </DrawerContent>
    )
}
