"use client"

import { Link } from "@tanstack/react-router"
import type { RefObject } from "react"
import { useEffect, useRef, useState } from "react"

import { LogoMark } from "@/components/logo"
import { ThemeSwitcher } from "@/components/themes/theme-switcher"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"

interface StickyNavProps {
    containerRef: RefObject<HTMLDivElement | null>
}

const navSections = [
    { id: "hero", label: "Hero" },
    { id: "providers", label: "Models" },
    { id: "model-selector", label: "Selector" },
    { id: "features", label: "Features" },
    { id: "artifacts", label: "Artifacts" },
    { id: "gallery", label: "Gallery" },
    { id: "workflows", label: "Workflows" },
    { id: "testimonials", label: "Testimonials" },
    { id: "pricing", label: "Pricing" },
    { id: "privacy", label: "Privacy" },
    { id: "start", label: "Get Started" }
]

export function StickyNav({ containerRef }: StickyNavProps) {
    const [activeSection, setActiveSection] = useState(0)
    const [isNavVisible, setIsNavVisible] = useState(true)
    const lastScrollY = useRef(0)
    const isHeroSection = navSections[activeSection]?.id === "hero"

    useEffect(() => {
        const container = containerRef.current
        if (!container) return

        let ticking = false

        const handleScroll = () => {
            if (ticking) return

            window.requestAnimationFrame(() => {
                const currentScrollY = container.scrollTop
                setIsNavVisible(currentScrollY <= lastScrollY.current || currentScrollY <= 100)
                lastScrollY.current = currentScrollY

                const scrollPosition = currentScrollY + container.clientHeight / 2
                const nextActiveIndex = navSections.findIndex((section) => {
                    const element = document.getElementById(section.id)
                    if (!element) return false

                    return (
                        scrollPosition >= element.offsetTop &&
                        scrollPosition < element.offsetTop + element.offsetHeight
                    )
                })

                if (nextActiveIndex >= 0) {
                    setActiveSection(nextActiveIndex)
                }

                ticking = false
            })
            ticking = true
        }

        container.addEventListener("scroll", handleScroll, { passive: true })
        handleScroll()

        return () => container.removeEventListener("scroll", handleScroll)
    }, [containerRef])

    return (
        <>
            <nav
                className={cn(
                    "fixed top-0 z-50 flex w-full items-center justify-between px-4 py-2 transition-[transform,background-color,backdrop-filter] duration-500 ease-in-out md:px-6",
                    isHeroSection
                        ? "bg-transparent backdrop-blur-none"
                        : "bg-background/40 backdrop-blur-md",
                    isNavVisible ? "translate-y-0" : "-translate-y-full"
                )}
            >
                <div className="flex items-center gap-2">
                    <LogoMark className="h-auto w-24 md:w-32" />
                </div>

                <div
                    className={cn(
                        "pointer-events-auto flex items-center space-x-1 rounded-[var(--radius-xl)] p-1 transition-[background-color,backdrop-filter] duration-500 md:space-x-2 md:p-2",
                        isHeroSection
                            ? "bg-transparent backdrop-blur-none"
                            : "bg-background/10 backdrop-blur-sm"
                    )}
                >
                    <ThemeSwitcher />
                    <div className="h-4 w-px bg-border" />
                    <Link to="/about" className="hidden sm:block">
                        <Button variant="ghost" size="sm">
                            About
                        </Button>
                    </Link>
                    <Link to="/auth/$pathname" params={{ pathname: "login" }}>
                        <Button size="sm" className="px-4 md:px-5">
                            Sign In
                        </Button>
                    </Link>
                </div>
            </nav>

            <div className="-translate-y-1/2 fixed top-1/2 right-6 z-50 hidden flex-col gap-4 md:flex">
                {navSections.map((section, index) => (
                    <button
                        key={section.id}
                        type="button"
                        onClick={() => {
                            const element = document.getElementById(section.id)
                            const container = containerRef.current

                            if (!element || !container) return

                            container.scrollTo({
                                top: element.offsetTop,
                                behavior: "smooth"
                            })
                        }}
                        className="group relative flex items-center justify-end"
                        aria-label={`Go to ${section.label}`}
                    >
                        <span className="absolute right-6 rounded-[var(--radius-md)] bg-background/80 px-2 py-1 font-medium text-xs opacity-0 backdrop-blur-sm transition-opacity group-hover:opacity-100">
                            {section.label}
                        </span>
                        <div
                            className={cn(
                                "h-2 w-2 rounded-full transition-all duration-300",
                                activeSection === index
                                    ? "h-8 bg-primary shadow-lg shadow-primary/50"
                                    : "bg-muted-foreground/30 shadow-sm hover:bg-muted-foreground/60"
                            )}
                        />
                    </button>
                ))}
            </div>
        </>
    )
}
