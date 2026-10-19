import type { SelectionToolbarPosition } from "@/lib/selection-toolbar-position"
import { cn } from "@/lib/utils"
import type React from "react"
import { createPortal } from "react-dom"

// Portaled so transformed or backdrop-filtered ancestors (the composer is both) cannot
// become the containing block of the fixed position.
export function FloatingSelectionToolbar({
    position,
    className,
    children
}: {
    position: SelectionToolbarPosition
    className?: string
    children: React.ReactNode
}) {
    return createPortal(
        <div
            className={cn("pointer-events-none fixed z-[60]", className)}
            style={{
                left: position.x,
                top: position.y,
                transform:
                    position.placement === "above" ? "translate(-50%, -100%)" : "translate(-50%, 0)"
            }}
        >
            {children}
        </div>,
        document.body
    )
}
