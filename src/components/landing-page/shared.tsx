"use client"

import { Link } from "@tanstack/react-router"
import type { ComponentPropsWithoutRef, ReactNode } from "react"
import { useEffect, useState } from "react"

import { Silk } from "@/components/react-bits/silk"
import { Button } from "@/components/ui/button"
import { useResolvedThemeMode } from "@/hooks/use-resolved-theme-mode"
import { useThemeStore } from "@/lib/theme-store"
import { cn } from "@/lib/utils"

export function useReducedMotion() {
    const [reduced, setReduced] = useState(false)

    useEffect(() => {
        const query = window.matchMedia("(prefers-reduced-motion: reduce)")
        setReduced(query.matches)

        const onChange = (event: MediaQueryListEvent) => setReduced(event.matches)
        query.addEventListener("change", onChange)
        return () => query.removeEventListener("change", onChange)
    }, [])

    return reduced
}

export function SilkBackdrop({
    className,
    silkClassName,
    overlayClassName = "bg-background/60",
    speed = 2.4
}: {
    className?: string
    silkClassName?: string
    overlayClassName?: string
    speed?: number
}) {
    const { themeState } = useThemeStore()
    const reducedMotion = useReducedMotion()
    const resolvedMode = useResolvedThemeMode(themeState.currentMode)
    const isDarkMode = resolvedMode === "dark"
    const themeSilkColor = themeState.cssVars[resolvedMode]["muted-foreground"] || "#7B7481"
    const silkColor = isDarkMode ? "#9b969e" : themeSilkColor

    if (reducedMotion) return null

    return (
        <div aria-hidden="true" className={cn("pointer-events-none absolute inset-0", className)}>
            <Silk
                className={cn("h-full w-full", silkClassName)}
                color={silkColor}
                contrast={isDarkMode ? 1 : 1.06}
                noiseIntensity={isDarkMode ? 1.5 : 0.35}
                rotation={0}
                scale={isDarkMode ? 1 : 0.92}
                speed={speed}
            />
            <div className={cn("absolute inset-0", overlayClassName)} />
        </div>
    )
}

export function SignInButton({
    children,
    className,
    variant = "default",
    redirect
}: {
    children: ReactNode
    className?: string
    variant?: "default" | "outline" | "secondary"
    redirect?: string
}) {
    return (
        <Link
            to="/auth/$pathname"
            params={{ pathname: "login" }}
            search={redirect ? { redirect } : undefined}
        >
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
    centered = false,
    className
}: {
    eyebrow?: string
    title: ReactNode
    children?: ReactNode
    centered?: boolean
    className?: string
}) {
    return (
        <div className={cn("mb-14 max-w-3xl", centered && "mx-auto text-center", className)}>
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
            {children ? (
                <p
                    className={cn(
                        "text-lg [color:var(--landing-muted)]",
                        centered && "mx-auto max-w-2xl"
                    )}
                >
                    {children}
                </p>
            ) : null}
        </div>
    )
}

export function Tile({ className, children, ...props }: ComponentPropsWithoutRef<"div">) {
    return (
        <div
            className={cn(
                "overflow-hidden rounded-[var(--radius-xl)] border shadow-2xl [background:var(--landing-surface)] [border-color:var(--landing-border)]",
                className
            )}
            {...props}
        >
            {children}
        </div>
    )
}
