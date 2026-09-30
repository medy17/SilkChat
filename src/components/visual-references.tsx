"use client"

import { SPOTLIGHT_CARD_CLASS, SpotlightHeader } from "@/components/renderers/spotlight-frame"
import { type VisualReference, searchVisualReferences } from "@/lib/visual-references"
import { cn } from "@/lib/utils"
import {
    solveVisualLayout,
    VISUAL_LAYOUT_FALLBACK_RATIO,
    VISUAL_LAYOUT_GAP
} from "@/lib/visual-layout"
import {
    type CSSProperties,
    type ReactNode,
    useEffect,
    useLayoutEffect,
    useMemo,
    useRef,
    useState
} from "react"

const VisualTile = ({
    visual,
    cue,
    className,
    imgClassName,
    style,
    onLoad,
    onError
}: {
    visual: VisualReference
    cue: string
    className: string
    imgClassName: string
    style?: CSSProperties
    onLoad?: (image: HTMLImageElement) => void
    onError: () => void
}) => (
    <a
        href={visual.sourceUrl}
        target="_blank"
        rel="noreferrer"
        className={cn(
            "group relative isolate block overflow-hidden focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
            className
        )}
        style={style}
        title={`View source on ${visual.source}`}
    >
        <img
            src={visual.thumbnailUrl}
            alt={`${visual.title} — visual reference for ${cue}`}
            className={cn("transition-transform duration-300", imgClassName)}
            loading="lazy"
            decoding="async"
            referrerPolicy="no-referrer"
            onLoad={(event) => onLoad?.(event.currentTarget)}
            onError={onError}
        />
        <span
            data-visual-attribution
            className="pointer-events-none absolute right-1 bottom-1 z-20 flex max-w-[calc(100%_-_0.5rem)] truncate rounded-[var(--radius-sm)] bg-background/40 px-1.5 py-px text-[9px] text-foreground/65 leading-none shadow-sm backdrop-blur-md transition-colors group-hover:bg-background/55 group-hover:text-foreground/85"
        >
            {visual.source}
        </span>
    </a>
)

// Reference images are information, not decoration: every tile keeps its image's own
// shape and the rows adapt around them (see solveVisualLayout).
const ReferenceGallery = ({
    visuals,
    cue,
    onFailed
}: {
    visuals: VisualReference[]
    cue: string
    onFailed: (id: string) => void
}) => {
    const containerRef = useRef<HTMLDivElement>(null)
    const [width, setWidth] = useState(0)
    const [measuredRatios, setMeasuredRatios] = useState<Record<string, number>>({})
    const [loadedIds, setLoadedIds] = useState<ReadonlySet<string>>(() => new Set())

    useLayoutEffect(() => {
        const container = containerRef.current
        if (!container) return
        setWidth(container.getBoundingClientRect().width)
        const observer = new ResizeObserver(([entry]) => {
            if (entry) setWidth(entry.contentRect.width)
        })
        observer.observe(container)
        return () => observer.disconnect()
    }, [])

    // Brave usually reports dimensions, so placeholders start at their final geometry.
    // The loaded image's real shape wins, which also covers results without dimensions.
    const ratios = visuals.map(
        (visual) =>
            measuredRatios[visual.id] ??
            (visual.width && visual.height
                ? visual.width / visual.height
                : VISUAL_LAYOUT_FALLBACK_RATIO)
    )
    const rows = solveVisualLayout(ratios, width)

    const handleLoad = (visual: VisualReference, index: number, image: HTMLImageElement) => {
        setLoadedIds((current) => new Set(current).add(visual.id))
        const ratio = image.naturalWidth / image.naturalHeight
        if (Number.isFinite(ratio) && ratio > 0 && Math.abs(ratio / ratios[index] - 1) > 0.01) {
            setMeasuredRatios((current) => ({ ...current, [visual.id]: ratio }))
        }
    }

    return (
        <div
            ref={containerRef}
            aria-label={`Visual references for ${cue}`}
            className="flex flex-col"
            style={{ gap: VISUAL_LAYOUT_GAP }}
        >
            {rows.map((row) => (
                <div
                    key={row.map((tile) => visuals[tile.index].id).join("\u0000")}
                    className="flex justify-center"
                    style={{ gap: VISUAL_LAYOUT_GAP }}
                >
                    {row.map((tile) => {
                        const visual = visuals[tile.index]
                        const loaded = loadedIds.has(visual.id)
                        return (
                            <VisualTile
                                key={visual.id}
                                visual={visual}
                                cue={cue}
                                className={cn(
                                    "min-w-0 rounded-[var(--radius-md)] bg-muted",
                                    !loaded && "animate-pulse"
                                )}
                                imgClassName={cn(
                                    "size-full object-cover transition-[opacity,transform] group-hover:scale-[1.03]",
                                    loaded ? "opacity-100" : "opacity-0"
                                )}
                                style={{ width: tile.width, height: tile.height }}
                                onLoad={(image) => handleLoad(visual, tile.index, image)}
                                onError={() => onFailed(visual.id)}
                            />
                        )
                    })}
                </div>
            ))}
        </div>
    )
}

export const VisualReferences = ({
    cue,
    limit,
    variant,
    framed = false
}: {
    cue: string
    limit: number
    variant: "gallery" | "step"
    // Standalone galleries in chat get their own Spotlight card titled by the search cue.
    framed?: boolean
}) => {
    const [visuals, setVisuals] = useState<VisualReference[]>([])
    const [failedIds, setFailedIds] = useState<Set<string>>(() => new Set())
    const [status, setStatus] = useState<"loading" | "ready">("loading")

    useEffect(() => {
        const controller = new AbortController()
        setVisuals([])
        setFailedIds(new Set())
        setStatus("loading")

        searchVisualReferences(cue, limit, variant, controller.signal)
            .then(setVisuals)
            .catch((error: unknown) => {
                if (!(error instanceof DOMException && error.name === "AbortError")) setVisuals([])
            })
            .finally(() => {
                if (!controller.signal.aborted) setStatus("ready")
            })

        return () => controller.abort()
    }, [cue, limit, variant])

    const visibleVisuals = useMemo(
        () => visuals.filter((visual) => !failedIds.has(visual.id)),
        [failedIds, visuals]
    )
    const markFailed = (id: string) => setFailedIds((current) => new Set(current).add(id))
    const isGallery = variant === "gallery"
    const galleryColumns =
        visibleVisuals.length === 1
            ? "grid-cols-1"
            : visibleVisuals.length === 2
              ? "grid-cols-2"
              : "grid-cols-3"

    const frame = (body: ReactNode) =>
        framed ? (
            <section className={cn("not-prose", SPOTLIGHT_CARD_CLASS)}>
                {/* The font leaves ~2px more room above its ascenders than below its
                    baseline, so pt-3.5 over the gallery's pt-4 makes the visible gaps above
                    and below the title match the gallery's 20px side and bottom insets. */}
                <SpotlightHeader
                    className="pt-3.5"
                    title={<span className="block truncate">{cue}</span>}
                />
                <div className="p-5 pt-4">{body}</div>
            </section>
        ) : (
            body
        )

    if (status === "loading") {
        return frame(
            <div
                // Recipe galleries sit inside printable recipe cards; chat cards never print.
                data-recipe-print-hide={framed ? undefined : true}
                aria-hidden="true"
                className={
                    framed
                        ? "grid grid-cols-3 gap-2"
                        : isGallery
                          ? "grid grid-cols-3 gap-2 overflow-hidden rounded-[var(--radius-xl)]"
                          : "overflow-hidden rounded-[var(--radius-lg)]"
                }
            >
                {Array.from({ length: isGallery ? limit : 1 }, (_, index) => (
                    <div
                        key={index}
                        className={cn(
                            "aspect-[4/3] animate-pulse bg-muted",
                            framed && "rounded-[var(--radius-md)]"
                        )}
                    />
                ))}
            </div>
        )
    }

    if (visibleVisuals.length === 0) return null

    if (framed) {
        return frame(<ReferenceGallery visuals={visibleVisuals} cue={cue} onFailed={markFailed} />)
    }

    return (
        <div data-recipe-print-hide aria-label={`Visual references for ${cue}`}>
            <div
                className={
                    isGallery
                        ? `grid ${galleryColumns} gap-2 overflow-hidden rounded-[var(--radius-xl)]`
                        : "overflow-hidden rounded-[var(--radius-lg)]"
                }
            >
                {visibleVisuals.map((visual) => (
                    <VisualTile
                        key={visual.id}
                        visual={visual}
                        cue={cue}
                        className={isGallery ? "aspect-[5/4] bg-muted/60" : "bg-transparent"}
                        imgClassName={
                            isGallery
                                ? "size-full object-cover group-hover:scale-[1.03]"
                                : "block h-auto w-full"
                        }
                        onError={() => markFailed(visual.id)}
                    />
                ))}
            </div>
        </div>
    )
}
