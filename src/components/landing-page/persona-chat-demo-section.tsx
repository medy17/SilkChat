"use client"

import { Link } from "@tanstack/react-router"
import { ArrowRight, ChevronRight } from "lucide-react"
import { AnimatePresence, motion } from "motion/react"
import { useCallback, useEffect, useMemo, useRef, useState } from "react"

import {
    getShowcaseAvatarUrl,
    personaDemos,
    showcasePersonas
} from "@/components/landing-page/persona-content"
import { SectionHead, useReducedMotion } from "@/components/landing-page/shared"
import { Button } from "@/components/ui/button"

const demoById = new Map(personaDemos.map((demo) => [demo.id, demo]))

function TypingDots() {
    return (
        <span className="flex items-center gap-1 py-1" aria-label="Typing">
            {[0, 1, 2].map((dot) => (
                <span
                    key={dot}
                    className="size-1.5 animate-bounce rounded-full [background:var(--landing-muted-soft)]"
                    style={{ animationDelay: `${dot * 0.15}s` }}
                />
            ))}
        </span>
    )
}

export function PersonaChatDemoSection() {
    const [activeId, setActiveId] = useState(showcasePersonas[0].id)
    const reducedMotion = useReducedMotion()
    const [phase, setPhase] = useState<"typing" | "done">("done")

    // Scroll hints for the mobile persona strip: fade the edges that have
    // off-screen content and bounce a chevron until the user reaches the end.
    const stripRef = useRef<HTMLDivElement>(null)
    const [canScrollLeft, setCanScrollLeft] = useState(false)
    const [canScrollRight, setCanScrollRight] = useState(false)

    const updateScrollHints = useCallback(() => {
        const el = stripRef.current
        if (!el) return
        setCanScrollLeft(el.scrollLeft > 4)
        setCanScrollRight(el.scrollLeft < el.scrollWidth - el.clientWidth - 4)
    }, [])

    useEffect(() => {
        updateScrollHints()
        window.addEventListener("resize", updateScrollHints)
        return () => window.removeEventListener("resize", updateScrollHints)
    }, [updateScrollHints])

    const active = useMemo(() => showcasePersonas.find((p) => p.id === activeId), [activeId])
    const demo = demoById.get(activeId)

    useEffect(() => {
        if (reducedMotion) {
            setPhase("done")
            return
        }
        setPhase("typing")
        const timeoutId = window.setTimeout(() => setPhase("done"), 750)
        return () => window.clearTimeout(timeoutId)
    }, [reducedMotion])

    const selectPersona = (id: string) => {
        if (id === activeId) return
        setActiveId(id)
    }

    if (!active || !demo) return null

    return (
        <section
            id="persona-catalog"
            className="border-t py-24 [border-color:var(--landing-border)]"
        >
            <div className="mx-auto w-full max-w-7xl px-5 md:px-8">
                <SectionHead centered title="Meet the characters." />

                <div className="mx-auto max-w-5xl overflow-hidden rounded-[var(--radius-xl)] border shadow-2xl [background:var(--landing-surface)] [border-color:var(--landing-border)]">
                    {/* Window chrome */}
                    <div className="flex items-center gap-2 border-b px-4 py-3 [border-color:var(--landing-border)]">
                        <span className="size-3 rounded-full bg-red-400/70" />
                        <span className="size-3 rounded-full bg-yellow-400/70" />
                        <span className="size-3 rounded-full bg-green-400/70" />
                        <span className="ml-3 font-mono text-xs [color:var(--landing-muted-soft)]">
                            silkchat — {active.name}
                        </span>
                    </div>

                    <div className="grid md:grid-cols-[13rem_1fr]">
                        {/* Sidebar (desktop) */}
                        <div className="hidden flex-col gap-1 border-r p-3 [border-color:var(--landing-border)] md:flex">
                            <p className="px-2 pt-1 pb-2 font-mono text-[10px] uppercase tracking-[0.12em] [color:var(--landing-muted-faint)]">
                                Personas
                            </p>
                            {showcasePersonas.map((persona) => {
                                const isActive = persona.id === activeId
                                return (
                                    <button
                                        key={persona.id}
                                        type="button"
                                        onClick={() => selectPersona(persona.id)}
                                        className={`flex items-center gap-2.5 rounded-[var(--radius-md)] px-2.5 py-2 text-left text-sm transition-colors ${
                                            isActive
                                                ? "[background:var(--landing-surface-contrast)] [color:var(--landing-fg)]"
                                                : "[color:var(--landing-muted)] hover:[background:var(--landing-surface-strong)]"
                                        }`}
                                    >
                                        <img
                                            src={getShowcaseAvatarUrl(persona.avatarPath)}
                                            alt=""
                                            loading="lazy"
                                            className="size-6 shrink-0 rounded-full object-cover"
                                        />
                                        <span className="truncate">{persona.name}</span>
                                    </button>
                                )
                            })}
                        </div>

                        {/* Sidebar (mobile): horizontal avatar strip. min-w-0 matters:
                            unlike the old bare scroll container, this wrapper would
                            otherwise contribute the strip's full content width as the
                            grid column's minimum, blowing the window out sideways. */}
                        <div className="relative min-w-0 border-b [border-color:var(--landing-border)] md:hidden">
                            <div
                                ref={stripRef}
                                onScroll={updateScrollHints}
                                className="scrollbar-hide flex gap-2 overflow-x-auto p-3"
                            >
                                {showcasePersonas.map((persona) => {
                                    const isActive = persona.id === activeId
                                    return (
                                        <button
                                            key={persona.id}
                                            type="button"
                                            onClick={() => selectPersona(persona.id)}
                                            title={persona.name}
                                            className={`flex shrink-0 flex-col items-center gap-1 rounded-[var(--radius-md)] px-2 py-1.5 transition-colors ${
                                                isActive
                                                    ? "[background:var(--landing-surface-contrast)]"
                                                    : "hover:[background:var(--landing-surface-strong)]"
                                            }`}
                                        >
                                            <img
                                                src={getShowcaseAvatarUrl(persona.avatarPath)}
                                                alt=""
                                                loading="lazy"
                                                className={`size-9 rounded-full object-cover ${
                                                    isActive ? "ring-2 ring-primary" : ""
                                                }`}
                                            />
                                            <span className="max-w-14 truncate text-[10px] [color:var(--landing-muted-soft)]">
                                                {persona.shortName}
                                            </span>
                                        </button>
                                    )
                                })}
                            </div>

                            {canScrollLeft && (
                                <div className="pointer-events-none absolute inset-y-0 left-0 w-10 bg-gradient-to-r from-[var(--landing-surface)] to-transparent" />
                            )}
                            {canScrollRight && (
                                <div className="pointer-events-none absolute inset-y-0 right-0 flex w-12 items-center justify-end bg-gradient-to-l from-[var(--landing-surface)] to-transparent pr-1">
                                    <ChevronRight className="size-4 animate-[hint-bounce-x_1.2s_ease-in-out_infinite] [color:var(--landing-muted-soft)]" />
                                </div>
                            )}
                        </div>

                        {/* Chat area */}
                        <div className="flex min-h-[22rem] flex-col md:min-h-[32rem]">
                            <div className="flex items-center gap-3 border-b px-5 py-3 [border-color:var(--landing-border)]">
                                <img
                                    src={getShowcaseAvatarUrl(active.avatarPath)}
                                    alt={active.name}
                                    className="size-8 rounded-full object-cover"
                                />
                                <div className="min-w-0">
                                    <p className="truncate font-medium text-sm [color:var(--landing-fg)]">
                                        {active.name}
                                    </p>
                                    <p className="truncate text-xs [color:var(--landing-muted-soft)]">
                                        {demo.modelLabel} · {active.category}
                                    </p>
                                </div>
                            </div>

                            <AnimatePresence mode="wait">
                                <motion.div
                                    key={activeId}
                                    initial={reducedMotion ? false : { opacity: 0, y: 8 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    exit={reducedMotion ? undefined : { opacity: 0, y: -8 }}
                                    transition={{ duration: 0.25, ease: [0.16, 1, 0.3, 1] }}
                                    className="flex flex-1 flex-col gap-4 p-5"
                                >
                                    {/* User message */}
                                    <div className="flex justify-end">
                                        <div className="max-w-[80%] rounded-[var(--radius-lg)] bg-primary px-3.5 py-2 text-primary-foreground text-sm leading-6">
                                            {demo.user}
                                        </div>
                                    </div>

                                    {/* Assistant message */}
                                    <div className="flex items-start gap-2.5">
                                        <img
                                            src={getShowcaseAvatarUrl(active.avatarPath)}
                                            alt=""
                                            className="mt-0.5 size-7 shrink-0 rounded-full object-cover"
                                        />
                                        <div className="max-w-[80%] rounded-[var(--radius-lg)] px-3.5 py-2 text-sm leading-6 [background:var(--landing-surface-strong)] [color:var(--landing-fg)]">
                                            {phase === "typing" ? <TypingDots /> : demo.reply}
                                        </div>
                                    </div>
                                </motion.div>
                            </AnimatePresence>

                            {/* Fake composer */}
                            <div className="border-t p-3 [border-color:var(--landing-border)]">
                                <div className="flex items-center justify-between rounded-[var(--radius-lg)] border px-4 py-2.5 text-sm [border-color:var(--landing-border)] [color:var(--landing-muted-faint)]">
                                    Message {active.shortName}…
                                    <ArrowRight className="size-4" />
                                </div>
                            </div>
                        </div>
                    </div>
                </div>

                <div className="mt-8 flex flex-col items-center gap-3">
                    <p className="text-sm [color:var(--landing-muted-soft)]">
                        This is a preview. The real thing remembers, switches models, and never
                        breaks character.
                    </p>
                    <Link to="/auth/$pathname" params={{ pathname: "login" }}>
                        <Button className="gap-2">
                            Chat with them for real
                            <ArrowRight className="size-4" />
                        </Button>
                    </Link>
                </div>
            </div>
        </section>
    )
}
