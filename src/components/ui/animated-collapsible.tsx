import { cn } from "@/lib/utils"
import type { ReactNode } from "react"

export function AnimatedCollapsible({
    open,
    children,
    className,
    contentClassName
}: {
    open: boolean
    children: ReactNode
    className?: string
    contentClassName?: string
}) {
    return (
        <div
            aria-hidden={!open}
            className={cn(
                "grid transition-[grid-template-rows] duration-150 ease-out",
                className
            )}
            style={{ gridTemplateRows: open ? "1fr" : "0fr" }}
        >
            <div className="min-h-0 overflow-hidden">
                <div className={contentClassName}>{children}</div>
            </div>
        </div>
    )
}
