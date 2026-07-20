import { cn } from "@/lib/utils"
import type { ReactNode } from "react"
import { useEffect, useRef } from "react"

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
    const contentRef = useRef<HTMLDivElement>(null)
    const innerRef = useRef<HTMLDivElement>(null)

    useEffect(() => {
        if (!contentRef.current || !innerRef.current) return

        const observer = new ResizeObserver(() => {
            if (contentRef.current && innerRef.current && open) {
                contentRef.current.style.maxHeight = `${innerRef.current.scrollHeight}px`
            }
        })

        observer.observe(innerRef.current)

        if (open) {
            contentRef.current.style.maxHeight = `${innerRef.current.scrollHeight}px`
        }

        return () => observer.disconnect()
    }, [open])

    return (
        <div
            ref={contentRef}
            aria-hidden={!open}
            className={cn(
                "overflow-hidden transition-[max-height] duration-150 ease-out",
                className
            )}
            style={{
                maxHeight: open ? contentRef.current?.scrollHeight : "0px"
            }}
        >
            <div ref={innerRef} className={contentClassName}>
                {children}
            </div>
        </div>
    )
}
