"use client"

import { LogoMark } from "@/components/logo"
import { ThemeSwitcher } from "@/components/themes/theme-switcher"
import { Button } from "@/components/ui/button"
import { Link } from "@tanstack/react-router"
import type React from "react"
import { useEffect, useRef, useState } from "react"

interface StickyNavProps {
    containerRef: React.RefObject<HTMLDivElement | null>
}

export function StickyNav({ containerRef }: StickyNavProps) {
    const [activeSection, setActiveSection] = useState(0)
    const [isNavVisible, setIsNavVisible] = useState(true)
    const lastScrollY = useRef(0)

    const sections = [
        { id: "hero", label: "Hero" },
        { id: "showcase", label: "Interface" },
        { id: "features", label: "Features" },
        { id: "use-cases", label: "Use Cases" },
        { id: "artifacts", label: "Artifacts" },
        { id: "comparison", label: "Comparison" },
        { id: "social-proof", label: "Testimonials" },
        { id: "providers", label: "Models" },
        { id: "byok", label: "Pricing" },
        { id: "security", label: "Security" },
        { id: "faq", label: "FAQ" },
        { id: "cta", label: "Get Started" }
    ]

    useEffect(() => {
        const container = containerRef.current
        if (!container) return

        let ticking = false

        const handleScroll = () => {
            if (!ticking) {
                window.requestAnimationFrame(() => {
                    const currentScrollY = container.scrollTop

                    if (currentScrollY > lastScrollY.current && currentScrollY > 100) {
                        setIsNavVisible(false)
                    } else {
                        setIsNavVisible(true)
                    }
                    lastScrollY.current = currentScrollY

                    const sectionElements = container.querySelectorAll("section")
                    const scrollPosition = currentScrollY + container.clientHeight / 2

                    sectionElements.forEach((section, index) => {
                        const sectionTop = (section as HTMLElement).offsetTop
                        const sectionHeight = (section as HTMLElement).offsetHeight

                        if (
                            scrollPosition >= sectionTop &&
                            scrollPosition < sectionTop + sectionHeight
                        ) {
                            setActiveSection(index)
                        }
                    })
                    ticking = false
                })
                ticking = true
            }
        }

        container.addEventListener("scroll", handleScroll, { passive: true })
        // Initial check
        handleScroll()

        return () => container.removeEventListener("scroll", handleScroll)
    }, [containerRef])

    return (
        <>
            <nav
                className={`fixed top-0 z-50 flex w-full items-center justify-between bg-background/40 px-4 py-2 backdrop-blur-md transition-transform duration-500 ease-in-out md:px-6 ${
                    isNavVisible && sections[activeSection]?.id !== "showcase"
                        ? "translate-y-0"
                        : "-translate-y-full"
                }`}
            >
                <div className="flex items-center gap-2">
                    <LogoMark className="h-auto w-24 md:w-32" />
                </div>

                <div className="pointer-events-auto flex items-center space-x-1 rounded-xl bg-background/10 p-1 backdrop-blur-sm md:space-x-2 md:p-2">
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
                {sections.map((section, index) => (
                    <button
                        key={section.id}
                        type="button"
                        onClick={() => {
                            const el = document.getElementById(section.id)
                            if (el && containerRef.current) {
                                // Calculate position relative to container
                                containerRef.current.scrollTo({
                                    top: el.offsetTop,
                                    behavior: "smooth"
                                })
                            }
                        }}
                        className="group relative flex items-center justify-end"
                        aria-label={`Go to ${section.label}`}
                    >
                        <span className="absolute right-6 rounded-md bg-background/80 px-2 py-1 font-medium text-xs opacity-0 backdrop-blur-sm transition-opacity group-hover:opacity-100">
                            {section.label}
                        </span>
                        <div
                            className={`h-2 w-2 rounded-full transition-all duration-300 ${
                                activeSection === index
                                    ? "h-8 bg-primary shadow-lg shadow-primary/50"
                                    : "bg-muted-foreground/30 shadow-sm hover:bg-muted-foreground/60"
                            }`}
                        />
                    </button>
                ))}
            </div>
        </>
    )
}
