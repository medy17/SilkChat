import { AnimatedCollapsible } from "@/components/ui/animated-collapsible"
import { Card } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"
import { useCapAlignedIcon } from "@/hooks/use-cap-aligned-icon"
import { cn } from "@/lib/utils"
import { ChevronDown, type LucideIcon } from "lucide-react"
import { type ReactNode, useState } from "react"

export function ModerationRowList({ children }: { children: ReactNode }) {
    return (
        <Card className="gap-0 overflow-hidden py-0 shadow-none">
            <ul>{children}</ul>
        </Card>
    )
}

export function RowAccount({ name, email }: { name: string | null; email: string }) {
    if (!name) return email
    return (
        <>
            {name} <span className="font-normal text-muted-foreground">{email}</span>
        </>
    )
}

// One collapsed line per item: who, what, and anything that needs attention. The rest opens
// underneath.
export function ModerationRow({
    icon: Icon,
    iconClassName = "text-muted-foreground",
    title,
    meta,
    trailing,
    children
}: {
    icon: LucideIcon
    iconClassName?: string
    title: ReactNode
    meta: ReactNode
    trailing?: ReactNode
    children: ReactNode
}) {
    const [open, setOpen] = useState(false)
    // Mounted on first open, so a long list doesn't carry every row's details and forms.
    const [opened, setOpened] = useState(false)
    const { iconRef, textRef, marginTop } = useCapAlignedIcon<HTMLParagraphElement>(Icon)

    return (
        <li className="border-t first:border-t-0">
            <button
                type="button"
                aria-expanded={open}
                onClick={() => {
                    setOpened(true)
                    setOpen((current) => !current)
                }}
                className="flex w-full items-start gap-3 px-4 py-3 text-left outline-none transition-colors hover:bg-muted/40 focus-visible:bg-muted/40"
            >
                <Icon
                    ref={iconRef}
                    className={cn("size-4 shrink-0", iconClassName)}
                    style={{ marginTop }}
                />
                <div className="min-w-0 flex-1">
                    <p ref={textRef} className="truncate font-medium text-sm leading-5">
                        {title}
                    </p>
                    <p className="truncate text-muted-foreground text-xs">{meta}</p>
                </div>
                <div className="flex shrink-0 items-center gap-2 self-center">
                    {trailing}
                    <ChevronDown
                        className={cn(
                            "size-4 text-muted-foreground transition-transform",
                            open && "rotate-180"
                        )}
                    />
                </div>
            </button>
            <AnimatedCollapsible open={open}>
                {/* Lines up with the row's text on wide screens. */}
                <div inert={!open} className="space-y-4 px-4 pt-1 pb-4 sm:pl-11">
                    {opened ? children : null}
                </div>
            </AnimatedCollapsible>
        </li>
    )
}

export function ModerationRowDate({ children }: { children: ReactNode }) {
    return <span className="text-muted-foreground text-xs tabular-nums">{children}</span>
}

export function ModerationRowSkeleton({ rows = 3 }: { rows?: number }) {
    return (
        <div role="status" aria-busy="true">
            <span className="sr-only">Loading</span>
            <Card aria-hidden="true" className="gap-0 overflow-hidden py-0 shadow-none">
                {Array.from({ length: rows }, (_, index) => (
                    <div
                        key={index}
                        className="flex items-start gap-3 border-t px-4 py-3 first:border-t-0"
                    >
                        <Skeleton className="mt-0.5 size-4 shrink-0" />
                        <div className="min-w-0 flex-1 space-y-1.5 py-0.5">
                            <Skeleton className="h-4 w-48 max-w-full" />
                            <Skeleton className="h-3 w-64 max-w-full" />
                        </div>
                    </div>
                ))}
            </Card>
        </div>
    )
}
