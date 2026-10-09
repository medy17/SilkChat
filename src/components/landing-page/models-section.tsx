"use client"

import { ArrowRight, Check, Ellipsis, Search } from "lucide-react"
import { LayoutGroup, motion, useReducedMotion, useTransform } from "motion/react"
import { type ReactNode, type RefObject, useEffect, useId, useRef, useState } from "react"

import {
    MetaIcon,
    MiniMaxIcon,
    MoonshotLogo,
    OpenRouterIcon,
    QwenIcon,
    XiaomiIcon
} from "@/components/brand-icons"
import { providers } from "@/components/landing-page/content"
import { RevealedText, useSceneProgress } from "@/components/landing-page/scroll-scene"
import { SignInButton, Tile } from "@/components/landing-page/shared"
import { cn } from "@/lib/utils"

const CYCLE_MS = 2200

const providerCatalog: Record<
    string,
    { blurb: string; models: { name: string; description: string }[] }
> = {
    OpenAI: {
        blurb: "Text, vision, tools, and search",
        models: [
            {
                name: "GPT 6 Astra",
                description: "Flagship for complex coding, research, and multimodal work."
            },
            {
                name: "GPT 5.6 Sol",
                description: "Advanced reasoning, coding, and extended tool workflows."
            },
            {
                name: "GPT 5.6 Terra",
                description: "Balanced model for everyday coding, reasoning, and chat."
            }
        ]
    },
    Claude: {
        blurb: "Deep reasoning and careful writing",
        models: [
            {
                name: "Claude Fable 5.1",
                description: "Complex codebase work, scientific research, and polished documents."
            },
            {
                name: "Claude Opus 5",
                description: "Premium coding and knowledge work with planning and verification."
            },
            {
                name: "Claude Sonnet 5",
                description: "Balanced model for coding, analysis, and daily conversations."
            }
        ]
    },
    Gemini: {
        blurb: "Multimodal chat with long context",
        models: [
            {
                name: "Gemini 3.8 Flash",
                description: "Responsive multimodal coding and complex, multi-step reasoning."
            },
            {
                name: "Gemini 3.7 Flash",
                description: "Previous Flash checkpoint for multimodal coding and tool use."
            },
            {
                name: "Gemini 3.5 Flash Lite",
                description: "Fast, efficient model for extraction and high-volume workloads."
            }
        ]
    },
    xAI: {
        blurb: "Real-time knowledge with attitude",
        models: [
            {
                name: "Grok 4.6",
                description: "Multimodal reasoning flagship for coding, knowledge work, and STEM."
            },
            {
                name: "Grok 4.5",
                description: "Previous flagship for multimodal reasoning and complex tool use."
            },
            {
                name: "Grok 4.3",
                description: "Earlier reasoning model with vision and adjustable effort."
            }
        ]
    },
    DeepSeek: {
        blurb: "Open-weight reasoning powerhouses",
        models: [
            {
                name: "DeepSeek V4 Pro 0813",
                description: "Deep reasoning and repository-scale coding with long context."
            },
            {
                name: "DeepSeek V4 Flash 0731",
                description: "Fast coding and tool workflows with adjustable reasoning."
            },
            {
                name: "DeepSeek V4 Pro",
                description: "Original V4 Pro preview for deep reasoning and long coding tasks."
            }
        ]
    },
    "Z.ai": {
        blurb: "GLM models built for agents",
        models: [
            {
                name: "GLM 5.3",
                description: "Million-token reasoning for complex software engineering."
            },
            {
                name: "GLM 5.3 Flash",
                description: "Efficient multimodal coding and extended tool workflows."
            },
            {
                name: "GLM 5.2",
                description: "Long-context model for deep debugging and sustained coding work."
            }
        ]
    }
}

// The six featured providers aren't the whole catalog: the last rail slot
// covers the remaining built-ins and models users bring through OpenRouter.
const moreProviders = [
    { name: "Moonshot", model: "Kimi K3", Icon: MoonshotLogo },
    { name: "Qwen", model: "Qwen3.8 Max", Icon: QwenIcon },
    { name: "MiniMax", model: "MiniMax M3", Icon: MiniMaxIcon },
    { name: "Xiaomi", model: "MiMo V2.6 Pro", Icon: XiaomiIcon },
    { name: "Meta", model: "Muse Spark 1.3", Icon: MetaIcon }
]
const MORE_INDEX = providers.length
const SLOT_COUNT = providers.length + 1
const listRows = [
    ...providers,
    { name: "More", command: "Kimi, Qwen, MiMo + any OpenRouter model", Icon: Ellipsis }
]

const popIn = (reduced: boolean, delayMs = 0) =>
    reduced
        ? undefined
        : { animation: "landing-model-pop 0.4s ease both", animationDelay: `${delayMs}ms` }

function MorePanel({ reduced }: { reduced: boolean }) {
    return (
        <div className="p-4">
            <div className="mb-4" style={popIn(reduced)}>
                <h3 className="font-medium [color:var(--landing-fg)]">And more</h3>
                <p className="text-sm [color:var(--landing-muted-faint)]">
                    More providers, plus any model you bring
                </p>
            </div>
            <div className="mb-2 grid grid-cols-2 gap-1">
                {moreProviders.map(({ name, model, Icon }, index) => (
                    <div
                        key={name}
                        style={popIn(reduced, 80 + index * 50)}
                        className="flex min-w-0 items-center gap-2.5 rounded-[var(--radius-lg)] px-2.5 py-2 hover:[background:var(--landing-surface)]"
                    >
                        <Icon className="size-4 shrink-0 rounded-[var(--radius-sm)] [color:var(--landing-fg)]" />
                        <div className="min-w-0">
                            <p className="truncate font-medium text-sm [color:var(--landing-fg)]">
                                {model}
                            </p>
                            <p className="truncate text-xs [color:var(--landing-muted-faint)]">
                                {name}
                            </p>
                        </div>
                    </div>
                ))}
            </div>
            <div
                style={popIn(reduced, 80 + moreProviders.length * 50)}
                className="rounded-[var(--radius-xl)] border px-3 py-3 [background:var(--landing-surface-stronger)] [border-color:var(--landing-border)]"
            >
                <div className="flex items-center gap-2 font-medium [color:var(--landing-fg)]">
                    <OpenRouterIcon className="size-4" />
                    Any OpenRouter model
                </div>
                <p className="mt-1 line-clamp-3 text-sm [color:var(--landing-muted-faint)]">
                    Bring your OpenRouter key, pick from its full catalog, and tune context, output,
                    abilities, and reasoning effort.
                </p>
            </div>
        </div>
    )
}

function RailButton({
    label,
    isActive,
    onClick,
    reduced,
    children
}: {
    label: string
    isActive: boolean
    onClick: () => void
    reduced: boolean
    children: ReactNode
}) {
    return (
        <button
            type="button"
            aria-label={label}
            aria-pressed={isActive}
            onClick={onClick}
            className={cn(
                "relative isolate flex size-11 min-w-0 shrink-0 cursor-pointer items-center justify-center rounded-[var(--radius-md)] border border-transparent bg-transparent p-0 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                isActive ? "text-foreground" : "text-muted-foreground hover:bg-muted/50"
            )}
        >
            {isActive && (
                <motion.span
                    aria-hidden="true"
                    layoutId="landing-model-selector-provider-indicator"
                    className="pointer-events-none absolute inset-0 -z-10 rounded-[inherit] bg-background ring-1 ring-foreground/20 ring-inset md:bg-popover"
                    transition={{ duration: reduced ? 0 : 0.25, ease: [0.16, 1, 0.3, 1] }}
                />
            )}
            <span aria-hidden="true" className="relative flex size-7 items-center justify-center">
                {children}
            </span>
        </button>
    )
}

function ModelSelectorPreview({
    activeIndex,
    onSelect,
    reduced
}: {
    activeIndex: number
    onSelect: (index: number) => void
    reduced: boolean
}) {
    const providerRailLayoutGroupId = useId()
    const activeProvider = providers[activeIndex]
    const catalog = activeProvider
        ? (providerCatalog[activeProvider.name] ?? providerCatalog.OpenAI)
        : undefined

    return (
        <Tile className="mx-auto w-full max-w-2xl">
            <div className="border-b p-3 [background:var(--landing-surface-stronger)] [border-color:var(--landing-border)]">
                <div className="relative">
                    <Search className="absolute top-1/2 left-3 size-4 -translate-y-1/2 [color:var(--landing-muted-faint)]" />
                    <div className="flex h-10 items-center rounded-[var(--radius-lg)] pl-9 text-sm [background:var(--landing-surface-strong)] [color:var(--landing-muted-faint)]">
                        Search models...
                    </div>
                </div>
            </div>
            <div className="grid h-[380px] grid-cols-[3.5rem_minmax(0,1fr)] md:grid-cols-[4rem_minmax(0,1fr)]">
                <div className="flex min-w-0 flex-col rounded-tr-[var(--radius-md)] border-t border-r bg-muted/50">
                    <LayoutGroup id={providerRailLayoutGroupId}>
                        <div className="relative flex flex-col items-center gap-1 px-1 pt-3 pb-2 md:px-2">
                            {providers.map(({ name, Icon }, index) => (
                                <RailButton
                                    key={name}
                                    label={`Show ${name} models`}
                                    isActive={index === activeIndex}
                                    onClick={() => onSelect(index)}
                                    reduced={reduced}
                                >
                                    <Icon className="size-5" />
                                </RailButton>
                            ))}
                            <RailButton
                                label="Show more providers"
                                isActive={activeIndex === MORE_INDEX}
                                onClick={() => onSelect(MORE_INDEX)}
                                reduced={reduced}
                            >
                                <Ellipsis className="size-5" />
                            </RailButton>
                        </div>
                    </LayoutGroup>
                </div>
                {!activeProvider || !catalog ? (
                    <MorePanel reduced={reduced} />
                ) : (
                    <div key={activeProvider.name} className="p-4">
                        <div
                            className="mb-4"
                            style={
                                reduced
                                    ? undefined
                                    : { animation: "landing-model-pop 0.4s ease both" }
                            }
                        >
                            <h3 className="font-medium [color:var(--landing-fg)]">
                                {activeProvider.name}
                            </h3>
                            <p className="text-sm [color:var(--landing-muted-faint)]">
                                {catalog.blurb}
                            </p>
                        </div>
                        <div className="space-y-2">
                            {catalog.models.map(({ name, description }, index) => (
                                <div
                                    key={name}
                                    style={
                                        reduced
                                            ? undefined
                                            : {
                                                  animation: "landing-model-pop 0.4s ease both",
                                                  animationDelay: `${80 + index * 70}ms`
                                              }
                                    }
                                    className={cn(
                                        "rounded-[var(--radius-xl)] border px-3 py-3",
                                        index === 0
                                            ? "[background:var(--landing-surface-stronger)] [border-color:var(--landing-border)]"
                                            : "border-transparent hover:[background:var(--landing-surface)]"
                                    )}
                                >
                                    <div className="flex items-center gap-2 font-medium [color:var(--landing-fg)]">
                                        {name}
                                        {index === 0 ? <Check className="size-4" /> : null}
                                    </div>
                                    <p className="mt-1 line-clamp-2 text-sm [color:var(--landing-muted-faint)]">
                                        {description}
                                    </p>
                                </div>
                            ))}
                        </div>
                    </div>
                )}
            </div>
        </Tile>
    )
}

// The selector cycles on its own while on screen; the active provider's bar
// fills over each beat so the timing reads at a glance. Any click hands
// control to the reader for good.
export function ModelsSection({
    containerRef
}: {
    containerRef: RefObject<HTMLDivElement | null>
}) {
    const sceneRef = useRef<HTMLElement>(null)
    const reduced = useReducedMotion() === true
    const progress = useSceneProgress({ containerRef, sceneRef })
    const [activeIndex, setActiveIndex] = useState(0)
    const [inView, setInView] = useState(false)
    const [isHovered, setIsHovered] = useState(false)
    const [hasInteracted, setHasInteracted] = useState(false)
    // Bumped when the pointer leaves so the paused bar restarts in step with
    // the fresh timeout instead of resuming mid-fill.
    const [beat, setBeat] = useState(0)
    const cycling = inView && !hasInteracted && !reduced

    const tilt = useTransform(progress, [-0.45, 0.1], [16, 0])
    const lift = useTransform(progress, [-0.45, 0.1], [90, 0])
    const visualOpacity = useTransform(progress, [-0.45, -0.05], [0.35, 1])

    useEffect(() => {
        const scene = sceneRef.current
        if (!scene) return
        const observer = new IntersectionObserver(
            ([observed]) => setInView(observed?.isIntersecting ?? false),
            { threshold: 0.35 }
        )
        observer.observe(scene)
        return () => observer.disconnect()
    }, [])

    // A timeout per beat (rather than an interval) restarts cleanly whenever
    // the active provider changes, keeping it in step with the fill bar.
    // biome-ignore lint/correctness/useExhaustiveDependencies: activeIndex restarts the beat
    useEffect(() => {
        if (!cycling || isHovered) return
        const timeoutId = window.setTimeout(() => {
            setActiveIndex((current) => (current + 1) % SLOT_COUNT)
        }, CYCLE_MS)
        return () => window.clearTimeout(timeoutId)
    }, [cycling, isHovered, activeIndex])

    const select = (index: number) => {
        setHasInteracted(true)
        setActiveIndex(index)
    }

    return (
        <section
            id="models"
            ref={sceneRef}
            className="border-t py-20 [border-color:var(--landing-border)] md:py-32"
            onMouseEnter={() => setIsHovered(true)}
            onMouseLeave={() => {
                setIsHovered(false)
                setBeat((current) => current + 1)
            }}
        >
            <style>
                {`
                    @keyframes landing-model-pop {
                        from { opacity: 0; transform: translateY(6px); }
                        to { opacity: 1; transform: none; }
                    }
                    @keyframes landing-provider-beat {
                        from { transform: scaleY(0); }
                        to { transform: scaleY(1); }
                    }
                `}
            </style>

            <div className="mx-auto grid w-full max-w-7xl items-center gap-12 px-5 md:grid-cols-2 md:px-8 lg:gap-20">
                <motion.div
                    style={
                        reduced
                            ? undefined
                            : {
                                  rotateX: tilt,
                                  y: lift,
                                  opacity: visualOpacity,
                                  transformPerspective: 1600
                              }
                    }
                    className="order-2 min-w-0 md:order-1"
                >
                    <ModelSelectorPreview
                        activeIndex={activeIndex}
                        onSelect={select}
                        reduced={reduced}
                    />
                </motion.div>

                <div className="order-1 md:order-2">
                    <h2 className="mb-5 text-balance font-medium text-3xl leading-[1.05] [color:var(--landing-fg)] md:text-5xl">
                        Every model.
                        <br />
                        <span className="[color:var(--landing-muted)]">One thread.</span>
                    </h2>
                    <p className="mb-8 max-w-md text-base leading-relaxed [color:var(--landing-muted)] md:text-lg">
                        <RevealedText
                            text="Switch providers from message to message without starting a new chat. The right model for every turn, all on SilkChat."
                            progress={progress}
                            reduced={reduced}
                        />
                    </p>

                    <ul aria-label="Featured AI models" className="mb-8 hidden md:block">
                        {listRows.map(({ name, command, Icon }, index) => {
                            const isActive = index === activeIndex
                            return (
                                <li key={name}>
                                    <button
                                        type="button"
                                        onClick={() => select(index)}
                                        className={cn(
                                            "relative flex w-full items-center gap-4 rounded-[var(--radius-md)] py-1.5 pr-3 pl-4 text-left transition-opacity duration-300",
                                            isActive ? "opacity-100" : "opacity-40 hover:opacity-70"
                                        )}
                                    >
                                        {isActive && (
                                            <motion.span
                                                aria-hidden="true"
                                                layoutId="landing-models-active-bar"
                                                className="absolute inset-y-1.5 left-0 w-0.5 overflow-hidden rounded-full [background:var(--landing-border-strong)]"
                                                transition={{
                                                    duration: reduced ? 0 : 0.35,
                                                    ease: [0.16, 1, 0.3, 1]
                                                }}
                                            >
                                                <span
                                                    key={`${activeIndex}-${beat}`}
                                                    className="absolute inset-0 origin-top [background:var(--landing-fg)]"
                                                    style={
                                                        cycling
                                                            ? {
                                                                  animation: `landing-provider-beat ${CYCLE_MS}ms linear both`,
                                                                  animationPlayState: isHovered
                                                                      ? "paused"
                                                                      : "running"
                                                              }
                                                            : undefined
                                                    }
                                                />
                                            </motion.span>
                                        )}
                                        <Icon className="size-5 shrink-0 [color:var(--landing-fg)]" />
                                        <span className="w-20 shrink-0 text-sm [color:var(--landing-muted)]">
                                            {name}
                                        </span>
                                        <span className="truncate font-medium [color:var(--landing-fg)]">
                                            {command}
                                        </span>
                                    </button>
                                </li>
                            )
                        })}
                    </ul>

                    <SignInButton className="gap-2">
                        Start using them today
                        <ArrowRight className="size-4" />
                    </SignInButton>
                </div>
            </div>
        </section>
    )
}
