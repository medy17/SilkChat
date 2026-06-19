import { Link } from "@tanstack/react-router"
import type { ReactNode } from "react"

import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"

export function SignInButton({
    children,
    className,
    variant = "default"
}: {
    children: ReactNode
    className?: string
    variant?: "default" | "outline" | "secondary"
}) {
    return (
        <Link to="/auth/$pathname" params={{ pathname: "login" }}>
            <Button
                size="lg"
                variant={variant}
                className={cn("h-12 rounded-[var(--radius-lg)] px-5 font-semibold", className)}
            >
                {children}
            </Button>
        </Link>
    )
}

export function SectionHead({
    eyebrow,
    title,
    children,
    centered = false
}: {
    eyebrow?: string
    title: ReactNode
    children: ReactNode
    centered?: boolean
}) {
    return (
        <div className={cn("mb-14 max-w-3xl", centered && "mx-auto text-center")}>
            {eyebrow ? (
                <div
                    className={cn(
                        "mb-4 flex items-center gap-2.5 font-mono text-[11px] uppercase tracking-[0.14em] [color:var(--landing-muted-soft)]",
                        centered && "justify-center"
                    )}
                >
                    <span className="h-px w-6 [background:var(--landing-border-strong)]" />
                    {eyebrow}
                </div>
            ) : null}
            <h2 className="mb-4 text-balance font-medium text-3xl leading-[1.05] tracking-normal [color:var(--landing-fg)] md:text-5xl">
                {title}
            </h2>
            <p
                className={cn(
                    "text-lg [color:var(--landing-muted)]",
                    centered && "mx-auto max-w-2xl"
                )}
            >
                {children}
            </p>
        </div>
    )
}

export function Tile({ className, children }: { className?: string; children: ReactNode }) {
    return (
        <div
            className={cn(
                "overflow-hidden rounded-[var(--radius-xl)] border shadow-2xl [background:var(--landing-surface)] [border-color:var(--landing-border)]",
                className
            )}
        >
            {children}
        </div>
    )
}
