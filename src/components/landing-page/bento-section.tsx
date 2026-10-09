"use client"

import { Link } from "@tanstack/react-router"
import { ArrowRight, Ellipsis, MousePointerClick } from "lucide-react"
import { AnimatePresence, motion, useReducedMotion } from "motion/react"
import { type ReactNode, type RefObject, useEffect, useState } from "react"

import { GithubIcon } from "@/components/brand-icons"
import {
    features,
    galleryImages,
    pricingOptions,
    providers,
    testimonials,
    useCases
} from "@/components/landing-page/content"
import { scrollToSection } from "@/components/landing-page/shared"
import { LibraryLogo } from "@/components/logo"
import { cn } from "@/lib/utils"

const workflowProps = ["cube", "ribbon", "prism", "mask"]
const firstQuoteIndex = Math.max(
    0,
    testimonials.findIndex(({ name }) => name === "Nadia K.")
)
const modelSlots = [
    ...providers.map(({ name, command, Icon }) => ({ name, model: command, Icon })),
    { name: "More", model: "Any OpenRouter model", Icon: Ellipsis }
]
const libraryShots = galleryImages.slice(0, 4)
const cloneCommand = "gh repo clone medy17/silkchat"
const [freePlan, proPlan] = pricingOptions

const settle = "ease-[cubic-bezier(0.16,1,0.3,1)]"
const swap = {
    initial: { opacity: 0, y: 6 },
    animate: { opacity: 1, y: 0 },
    exit: { opacity: 0, y: -6 },
    transition: { duration: 0.2 }
}

const tileMotion = {
    hidden: { opacity: 0, y: 24, filter: "blur(6px)" },
    shown: { opacity: 1, y: 0, filter: "blur(0px)" }
}

const tileSurface =
    "group relative flex h-full w-full flex-col justify-between overflow-hidden rounded-[var(--radius-xl)] border p-5 text-left backdrop-blur-md transition-colors [border-color:var(--landing-border)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"

// Steps through `length` items while active and rests on the first otherwise.
function useCycle(active: boolean, length: number, ms: number) {
    const [index, setIndex] = useState(0)
    useEffect(() => {
        if (!active) {
            setIndex(0)
            return
        }
        const intervalId = window.setInterval(
            () => setIndex((current) => (current + 1) % length),
            ms
        )
        return () => window.clearInterval(intervalId)
    }, [active, length, ms])
    return index
}

type DemoProps = { active: boolean; reduced: boolean }

function SectionTile({
    target,
    title,
    className,
    containerRef,
    reduced,
    children
}: {
    target: string
    title: ReactNode | ((demo: DemoProps) => ReactNode)
    className?: string
    containerRef: RefObject<HTMLDivElement | null>
    reduced: boolean
    children?: (demo: DemoProps) => ReactNode
}) {
    // Hover and keyboard focus both play the tile's demo.
    const [active, setActive] = useState(false)
    const demo = { active, reduced }
    return (
        <motion.li variants={tileMotion} className={className}>
            <button
                type="button"
                onClick={() => scrollToSection(containerRef.current, target)}
                onPointerEnter={() => setActive(true)}
                onPointerLeave={() => setActive(false)}
                onFocus={() => setActive(true)}
                onBlur={() => setActive(false)}
                className={cn(tileSurface, "bg-background/55 hover:bg-background/75")}
            >
                {children?.(demo)}
                <h3 className="mt-auto text-balance pt-4 font-medium text-lg leading-snug [color:var(--landing-fg)]">
                    {typeof title === "function" ? title(demo) : title}
                </h3>
            </button>
        </motion.li>
    )
}

// A selection ring hops provider to provider while the flagship model swaps
// beside it: switching models mid-thread.
function ModelsDemo({ active, reduced }: DemoProps) {
    const index = useCycle(active && !reduced, modelSlots.length, 650)
    return (
        <div className="flex items-center gap-4">
            <div className="flex items-center gap-1 [color:var(--landing-muted)]">
                {modelSlots.map(({ name, Icon }, slotIndex) => {
                    const isActive = active && slotIndex === index
                    return (
                        <span
                            key={name}
                            className={cn(
                                "relative grid size-8 place-items-center transition-colors duration-300",
                                isActive && "[color:var(--landing-fg)]"
                            )}
                        >
                            {isActive && (
                                <motion.span
                                    layoutId="bento-model-ring"
                                    transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
                                    className="absolute inset-0 rounded-[var(--radius-md)] ring-1 ring-inset [--tw-ring-color:var(--landing-border-strong)] [background:var(--landing-surface-strong)]"
                                />
                            )}
                            <Icon className="relative size-5" />
                        </span>
                    )
                })}
            </div>
            <AnimatePresence mode="wait">
                {active && (
                    <motion.span
                        key={index}
                        {...swap}
                        className="hidden truncate font-mono text-xs [color:var(--landing-fg)] lg:block"
                    >
                        {modelSlots[index].model}
                    </motion.span>
                )}
            </AnimatePresence>
        </div>
    )
}

// The source compiles into the component it describes, which then gets used.
function ArtifactsDemo({ active, reduced }: DemoProps) {
    const count = useCycle(active && !reduced, 100, 550)
    return (
        <div className="flex flex-wrap items-center gap-2">
            <code
                className={cn(
                    "font-mono text-[11px] transition-opacity duration-500 [color:var(--landing-muted-soft)]",
                    active && "opacity-40"
                )}
            >
                {"<Counter />"}
            </code>
            <span
                className={cn(
                    "inline-flex items-center gap-1.5 rounded-[var(--radius-md)] bg-primary px-2.5 py-1 font-medium text-primary-foreground text-xs transition-[opacity,translate] duration-500",
                    settle,
                    active ? "translate-x-0 opacity-100" : "-translate-x-3 opacity-0"
                )}
            >
                <MousePointerClick className="size-3" />
                Increment
                <motion.span
                    key={count}
                    initial={reduced || count === 0 ? false : { y: -6, opacity: 0 }}
                    animate={{ y: 0, opacity: 1 }}
                    className="inline-block min-w-3 tabular-nums"
                >
                    {count}
                </motion.span>
            </span>
        </div>
    )
}

// A loose stack of prints sorts itself into the Library's grid.
const stackTurns = ["-rotate-6", "rotate-4", "-rotate-2", "rotate-0"]
const gridCells = [
    "-translate-x-[26%] -translate-y-[26%]",
    "translate-x-[26%] -translate-y-[26%]",
    "-translate-x-[26%] translate-y-[26%]",
    "translate-x-[26%] translate-y-[26%]"
]

function LibraryDemo({ active }: DemoProps) {
    return (
        <>
            {/* Mobile: the tile spans the full width, so the prints sit in a row. */}
            <div className="flex justify-center gap-2 md:hidden">
                {libraryShots.map((image) => (
                    <img
                        key={image.id}
                        src={image.img}
                        alt=""
                        loading="lazy"
                        decoding="async"
                        className="size-14 shrink-0 rounded-[var(--radius-lg)] border object-cover shadow-xl [border-color:var(--landing-border)]"
                    />
                ))}
            </div>
            <LibraryStack active={active} />
        </>
    )
}

function LibraryStack({ active }: { active: boolean }) {
    return (
        <div className="relative mx-auto mt-2 hidden aspect-square w-3/4 md:block">
            {libraryShots.map((image, index) => (
                <img
                    key={image.id}
                    src={image.img}
                    alt=""
                    loading="lazy"
                    decoding="async"
                    style={{ transitionDelay: `${index * 40}ms` }}
                    className={cn(
                        "absolute inset-0 size-full rounded-[var(--radius-lg)] border object-cover shadow-xl transition-[translate,rotate,scale] duration-700 [border-color:var(--landing-border)]",
                        settle,
                        active ? cn(gridCells[index], "rotate-0 scale-[0.48]") : stackTurns[index]
                    )}
                />
            ))}
        </div>
    )
}

// Each object steps aside to name the workflow it stands for.
function WorkflowsDemo({ active }: DemoProps) {
    return (
        <div className="flex items-center gap-2">
            {workflowProps.map((name, index) => (
                <div key={name} className="flex items-center">
                    <img
                        src={`/images/workflows/${name}.webp`}
                        alt=""
                        loading="lazy"
                        decoding="async"
                        style={{ transitionDelay: `${index * 50}ms` }}
                        className={cn(
                            "object-contain transition-[width,height] duration-500",
                            settle,
                            active ? "size-10" : "size-14"
                        )}
                    />
                    <span
                        style={{ transitionDelay: `${index * 50}ms` }}
                        className={cn(
                            "hidden overflow-hidden whitespace-nowrap text-xs transition-[max-width,opacity,margin] duration-500 [color:var(--landing-muted)] md:block",
                            settle,
                            active ? "ml-1 max-w-24 opacity-100" : "max-w-0 opacity-0"
                        )}
                    >
                        {useCases[index]?.title}
                    </span>
                </div>
            ))}
        </div>
    )
}

// A spotlight walks the feature icons and names each one.
function FeaturesDemo({ active, reduced }: DemoProps) {
    const index = useCycle(active && !reduced, features.length, 900)
    return (
        <div className="flex items-center gap-4">
            <div className="grid w-fit shrink-0 grid-cols-3 gap-2.5">
                {features.map(({ title, Icon }, featureIndex) => (
                    <span
                        key={title}
                        className={cn(
                            "inline-flex transition-[opacity,scale,color] duration-300 [color:var(--landing-muted)]",
                            active &&
                                (featureIndex === index
                                    ? "scale-125 [color:var(--landing-fg)]"
                                    : "opacity-30")
                        )}
                    >
                        <Icon className="size-4" />
                    </span>
                ))}
            </div>
            <AnimatePresence mode="wait">
                {active && (
                    <motion.span
                        key={index}
                        {...swap}
                        className="line-clamp-2 text-xs [color:var(--landing-fg)]"
                    >
                        {features[index].title}
                    </motion.span>
                )}
            </AnimatePresence>
        </div>
    )
}

function TestimonialQuote({ active, reduced }: DemoProps) {
    const step = useCycle(active && !reduced, testimonials.length, 2600)
    const testimonial = testimonials[(firstQuoteIndex + step) % testimonials.length]
    return (
        <AnimatePresence mode="wait" initial={false}>
            <motion.span
                key={testimonial.name}
                initial={{ opacity: 0, y: 8, filter: "blur(4px)" }}
                animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
                exit={{ opacity: 0, y: -8, filter: "blur(4px)" }}
                transition={{ duration: 0.3 }}
                className="block"
            >
                <span className="line-clamp-2">“{testimonial.quote}”</span>
                <span className="mt-1 block font-normal text-sm [color:var(--landing-muted-faint)]">
                    {testimonial.name} · {testimonial.role}
                </span>
            </motion.span>
        </AnimatePresence>
    )
}

// Free rolls over to Pro, with what the upgrade buys.
function PricingDemo({ active }: DemoProps) {
    return (
        <div className="h-9 overflow-hidden">
            <div
                className={cn(
                    "transition-transform duration-500",
                    settle,
                    active && "-translate-y-9"
                )}
            >
                <p className="flex h-9 items-baseline gap-1.5 font-medium text-3xl [color:var(--landing-fg)]">
                    {freePlan.price}
                    <span className="font-normal text-sm [color:var(--landing-muted-soft)]">
                        {freePlan.cadence}
                    </span>
                </p>
                <p className="flex h-9 items-baseline gap-1.5 font-medium text-3xl [color:var(--landing-fg)]">
                    {proPlan.price}
                    <span className="truncate font-normal text-sm [color:var(--landing-muted-soft)]">
                        {proPlan.cadence} · 25x usage
                    </span>
                </p>
            </div>
        </div>
    )
}

// The clone command types itself out: it really is one line away.
function PrivacyDemo({ active, reduced }: DemoProps) {
    return (
        <div className="min-w-0 space-y-2">
            <GithubIcon
                className={cn(
                    "size-6 transition-transform duration-500 [color:var(--landing-fg)]",
                    active && "-rotate-12 scale-110"
                )}
            />
            <p className="flex min-w-0 items-center overflow-hidden font-mono text-[11px] [color:var(--landing-muted)]">
                <span
                    className={cn(
                        "shrink-0 transition-opacity duration-200 [color:var(--landing-fg)]",
                        !active && "opacity-0"
                    )}
                >
                    ${" "}
                </span>
                <span
                    className="overflow-hidden whitespace-nowrap"
                    style={{
                        width: active ? `${cloneCommand.length}ch` : "0ch",
                        transition: reduced
                            ? "none"
                            : active
                              ? `width 1.1s steps(${cloneCommand.length})`
                              : "width 0.15s"
                    }}
                >
                    {cloneCommand}
                </span>
                {active && (
                    <span className="ml-px inline-block h-3 w-1.5 shrink-0 animate-pulse [background:var(--landing-fg)]" />
                )}
            </p>
        </div>
    )
}

// The page's closing act: a map of every chapter that, with the footer,
// fills the last screen. Each tile jumps back to its section and previews it
// on hover; only the large tile leaves the page, for sign-in, and it carries
// the closing headline.
export function BentoSection({ containerRef }: { containerRef: RefObject<HTMLDivElement | null> }) {
    const reduced = useReducedMotion() === true
    const tile = { containerRef, reduced }

    return (
        <section
            id="start"
            className="relative flex flex-1 flex-col justify-center border-t pt-24 pb-4 [border-color:var(--landing-border)]"
        >
            <div className="relative z-10 mx-auto w-full max-w-7xl px-5 md:px-8">
                <motion.ul
                    initial={reduced ? false : "hidden"}
                    whileInView="shown"
                    viewport={{ once: true, amount: 0.2 }}
                    variants={{ hidden: {}, shown: { transition: { staggerChildren: 0.06 } } }}
                    className="grid grid-flow-dense auto-rows-[9rem] grid-cols-2 gap-3 md:auto-rows-[8.5rem] md:grid-cols-4"
                >
                    <motion.li variants={tileMotion} className="col-span-2 row-span-2">
                        <Link
                            to="/auth/$pathname"
                            params={{ pathname: "login" }}
                            className={cn(
                                tileSurface,
                                "border-transparent bg-primary p-7 text-primary-foreground"
                            )}
                        >
                            <ArrowRight className="size-8 self-end transition-transform duration-500 group-hover:translate-x-1 group-hover:-rotate-45" />
                            <div>
                                <h2 className="mb-3 max-w-md text-balance font-medium text-3xl leading-[1.05] lg:text-5xl">
                                    One interface for every model you trust.
                                </h2>
                                <p className="font-medium text-lg">Get started free</p>
                            </div>
                        </Link>
                    </motion.li>

                    <SectionTile
                        target="models"
                        title="Every model. One thread."
                        className="col-span-2"
                        {...tile}
                    >
                        {(demo) => <ModelsDemo {...demo} />}
                    </SectionTile>

                    <SectionTile target="artifacts" title="Run code in the chat." {...tile}>
                        {(demo) => <ArtifactsDemo {...demo} />}
                    </SectionTile>

                    <SectionTile
                        target="gallery"
                        title={
                            <>
                                <span className="sr-only">SilkScreen</span>
                                <span aria-hidden="true">
                                    <LibraryLogo className="mx-auto block h-auto w-full max-w-48" />
                                </span>
                            </>
                        }
                        className="col-span-2 md:col-span-1 md:row-span-2"
                        {...tile}
                    >
                        {(demo) => <LibraryDemo {...demo} />}
                    </SectionTile>

                    <SectionTile
                        target="workflows"
                        title="Built for every workflow."
                        className="col-span-2"
                        {...tile}
                    >
                        {(demo) => <WorkflowsDemo {...demo} />}
                    </SectionTile>

                    <SectionTile target="features" title="Everything in one chat." {...tile}>
                        {(demo) => <FeaturesDemo {...demo} />}
                    </SectionTile>

                    <SectionTile
                        target="testimonials"
                        title={(demo) => <TestimonialQuote {...demo} />}
                        className="col-span-2"
                        {...tile}
                    />

                    <SectionTile target="pricing" title="Start free, go Pro anytime." {...tile}>
                        {(demo) => <PricingDemo {...demo} />}
                    </SectionTile>

                    <SectionTile target="privacy" title="Audit it. Host it. Fork it." {...tile}>
                        {(demo) => <PrivacyDemo {...demo} />}
                    </SectionTile>
                </motion.ul>
            </div>
        </section>
    )
}
