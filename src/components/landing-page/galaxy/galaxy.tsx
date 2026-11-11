"use client"

import { AudioLines, ImageIcon, Type } from "lucide-react"
import { useReducedMotion } from "motion/react"
import { type ComponentType, type RefObject, useEffect, useMemo, useRef, useState } from "react"

import {
    BlackForestLabsIcon,
    ClaudeIcon,
    DeepSeekIcon,
    GeminiIcon,
    MetaIcon,
    MiniMaxIcon,
    MistralIcon,
    MoonshotLogo,
    OpenAIIcon,
    QwenIcon,
    XAIIcon,
    XiaomiIcon,
    ZAIIcon
} from "@/components/brand-icons"
import { api } from "@/convex/_generated/api"
import type { GalaxyCatalogEntry } from "@/convex/lib/openrouter_catalog"
import { useDiskCachedQuery } from "@/lib/convex-cached-query"
import { useSharedModels } from "@/lib/shared-models"
import { cn } from "@/lib/utils"

import {
    buildGalaxyCatalog,
    type GalaxyCatalog,
    type GalaxyLab,
    type GalaxyLabKey,
    type GalaxyModel,
    type GalaxyOutput
} from "./catalog"
import { type GalaxyHover, type GalaxyIntro, startGalaxy } from "./engine"
import { buildGalaxyField } from "./field"

const LAB_ICONS: Record<GalaxyLabKey, ComponentType<{ className?: string }>> = {
    openai: OpenAIIcon,
    anthropic: ClaudeIcon,
    google: GeminiIcon,
    xai: XAIIcon,
    deepseek: DeepSeekIcon,
    zai: ZAIIcon,
    moonshot: MoonshotLogo,
    qwen: QwenIcon,
    xiaomi: XiaomiIcon,
    minimax: MiniMaxIcon,
    meta: MetaIcon,
    mistral: MistralIcon,
    bfl: BlackForestLabsIcon
}

const OUTPUT_ICONS: Record<GalaxyOutput, { icon: typeof Type; label: string }> = {
    text: { icon: Type, label: "Text" },
    image: { icon: ImageIcon, label: "Image" },
    audio: { icon: AudioLines, label: "Audio" }
}

const NO_ENTRIES: GalaxyCatalogEntry[] = []

const compactNumber = new Intl.NumberFormat("en-US", { notation: "compact" })

function LabIcon({ lab, className }: { lab: GalaxyLabKey; className?: string }) {
    const Icon = LAB_ICONS[lab]
    return <Icon className={className} />
}

function GalaxyCard({
    cardRef,
    lab,
    model,
    isOpen
}: {
    cardRef: RefObject<HTMLDivElement | null>
    lab: GalaxyLab
    model: GalaxyModel | null
    isOpen: boolean
}) {
    const outputs = model?.outputs ?? lab.outputs
    return (
        <div
            ref={cardRef}
            aria-hidden
            className={cn(
                "glass-popover pointer-events-none invisible absolute top-0 left-0 z-3 w-max max-w-72 rounded-lg border px-3 py-2 text-left",
                "transition-opacity duration-150 motion-reduce:transition-none",
                isOpen ? "opacity-100" : "opacity-0"
            )}
        >
            <div className="flex items-center gap-1.5 whitespace-nowrap text-muted-foreground text-xs">
                <LabIcon lab={lab.key} className="size-3.5" />
                {lab.name}
            </div>
            <div className="mt-0.5 truncate font-medium text-foreground text-sm">
                {model ? model.name : `${lab.count} ${lab.count === 1 ? "model" : "models"}`}
                {model?.legacy && (
                    <span className="font-normal text-muted-foreground"> (Legacy)</span>
                )}
            </div>
            <dl className="mt-1.5 grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 border-border/50 border-t pt-1.5 text-xs">
                {model?.contextLength ? (
                    <>
                        <dt className="text-muted-foreground">Context window</dt>
                        <dd className="text-foreground tabular-nums">
                            {compactNumber.format(model.contextLength)} tokens
                        </dd>
                    </>
                ) : null}
                <dt className="text-muted-foreground">Outputs</dt>
                <dd className="flex items-center gap-1.5 text-foreground">
                    {outputs.map((output) => {
                        const { icon: Icon, label } = OUTPUT_ICONS[output]
                        return (
                            <Icon key={output} role="img" aria-label={label} className="size-3.5" />
                        )
                    })}
                </dd>
            </dl>
        </div>
    )
}

export function Galaxy({
    className,
    copyRef
}: {
    className?: string
    copyRef: RefObject<HTMLElement | null>
}) {
    const { models } = useSharedModels()
    const openRouterResult = useDiskCachedQuery(
        api.model_provider_metadata.listGalaxyCatalog,
        { key: "galaxy-catalog", default: [] as GalaxyCatalogEntry[] },
        {}
    )
    const openRouter = Array.isArray(openRouterResult) ? openRouterResult : NO_ENTRIES
    const reducedMotion = useReducedMotion() ?? false
    // Keyed on content: a new field restarts the engine, so identity churn must not.
    const catalogKey = useMemo(
        () => JSON.stringify(buildGalaxyCatalog(models, openRouter, new Date())),
        [models, openRouter]
    )
    const catalog = useMemo(() => JSON.parse(catalogKey) as GalaxyCatalog, [catalogKey])
    const field = useMemo(() => buildGalaxyField(catalog, Date.now() / 1000), [catalog])

    const wrapRef = useRef<HTMLDivElement>(null)
    const backRef = useRef<HTMLCanvasElement>(null)
    const frontRef = useRef<HTMLCanvasElement>(null)
    const labelRefs = useRef<(HTMLDivElement | null)[]>([])
    const cardRef = useRef<HTMLDivElement>(null)
    // Survives engine restarts so a catalog refresh doesn't replay the intro.
    const introRef = useRef<GalaxyIntro>({ boot: 0, labs: 0 })
    const [hover, setHover] = useState<GalaxyHover | null>(null)
    const [isOpen, setIsOpen] = useState(false)

    useEffect(() => {
        const wrap = wrapRef.current
        const back = backRef.current
        const front = frontRef.current
        if (!wrap || !back || !front) return
        labelRefs.current.length = field.clusters.length
        const stop = startGalaxy({
            wrap,
            back,
            front,
            field,
            labels: () => labelRefs.current,
            card: () => cardRef.current,
            copy: () => copyRef.current,
            intro: introRef.current,
            reducedMotion,
            onHoverChange: (next) => {
                if (next) setHover(next)
                setIsOpen(next !== null)
            },
            loadMark: () => import("./glass-mark").then(({ createGlassMark }) => createGlassMark())
        })
        return () => {
            stop()
            setHover(null)
            setIsOpen(false)
        }
    }, [field, reducedMotion, copyRef])

    const hoveredLab = hover ? field.clusters[hover.cluster] : undefined
    const labSummary = catalog.labs
        .slice(0, 8)
        .map((lab) => `${lab.name} (${lab.count})`)
        .join(", ")

    return (
        <div
            ref={wrapRef}
            role="img"
            aria-label={`Every model in SilkChat as a point, grouped by the lab that makes it: ${labSummary}.`}
            className={className}
        >
            <canvas
                ref={backRef}
                className="absolute inset-0 z-0 size-full cursor-default touch-pan-y select-none"
            />
            <canvas
                ref={frontRef}
                aria-hidden
                className="pointer-events-none absolute inset-0 z-2 size-full"
            />
            {field.clusters.map((lab, i) => (
                <div
                    key={lab.key}
                    ref={(element) => {
                        labelRefs.current[i] = element
                    }}
                    aria-hidden
                    className="pointer-events-none absolute top-0 left-0 flex size-7 items-center justify-center rounded-full border border-border/60 bg-background opacity-0 will-change-transform"
                >
                    <LabIcon lab={lab.key} className="size-4" />
                </div>
            ))}
            {hoveredLab && (
                <GalaxyCard
                    cardRef={cardRef}
                    lab={hoveredLab}
                    model={hover?.point?.model ?? null}
                    isOpen={isOpen}
                />
            )}
        </div>
    )
}
