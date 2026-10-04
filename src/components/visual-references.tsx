"use client"

import { SPOTLIGHT_CARD_CLASS, SpotlightHeader } from "@/components/renderers/spotlight-frame"
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip"
import type { VisualReference } from "@/lib/visual-references"
import {
    visualRequestKey,
    getVisualSearchQueries,
    type VisualSelection
} from "@/lib/visual-selections"
import { cn } from "@/lib/utils"
import { api } from "@/convex/_generated/api"
import type { Id } from "@/convex/_generated/dataModel"
import { useMutation } from "convex/react"
import { Image, Loader2 } from "lucide-react"
import { Button } from "./ui/button"
import {
    solveVisualLayout,
    VISUAL_LAYOUT_FALLBACK_RATIO,
    VISUAL_LAYOUT_GAP
} from "@/lib/visual-layout"
import {
    type CSSProperties,
    type ReactNode,
    createContext,
    useContext,
    useLayoutEffect,
    useMemo,
    useRef,
    useState
} from "react"

export const VisualSelectionContext = createContext<{
    selections: VisualSelection[]
    pending: boolean
    legacy?: { threadId: string; messageId: string }
}>({ selections: [], pending: false })

const LoadLegacyVisuals = ({
    threadId,
    messageId,
    children
}: {
    threadId: string
    messageId: string
    children: ReactNode
}) => {
    const resolve = useMutation(api.visuals.resolveLegacy)
    const [busy, setBusy] = useState(false)
    const [error, setError] = useState<string>()
    return (
        <div className="not-prose" data-recipe-print-hide>
            <div className="relative" aria-busy={busy}>
                {children}
                <div className="absolute inset-0 flex items-center justify-center p-3">
                    <Button
                        variant="ghost"
                        size="sm"
                        className="spotlight-glass w-[calc((100%_-_1rem)*1.4/3)] min-w-fit max-w-full rounded-[var(--radius-md)]"
                        disabled={busy}
                        onClick={async () => {
                            setBusy(true)
                            setError(undefined)
                            try {
                                const result = await resolve({
                                    threadId: threadId as Id<"threads">,
                                    messageId
                                })
                                if (result === "busy")
                                    setError(
                                        "Wait for the current reply to finish, then try again."
                                    )
                                else if (result === "unavailable")
                                    setError("This message has no visuals available to load.")
                            } catch {
                                setError("Unable to load visuals. Try again.")
                            } finally {
                                setBusy(false)
                            }
                        }}
                    >
                        {busy ? (
                            <Loader2
                                className="size-4 animate-spin text-primary"
                                aria-hidden="true"
                            />
                        ) : (
                            <Image className="size-4 text-primary" aria-hidden="true" />
                        )}
                        {busy
                            ? "Loading visuals…"
                            : error
                              ? "Retry loading visuals"
                              : "Load visual references"}
                    </Button>
                </div>
            </div>
            {error && (
                <p role="alert" className="mt-2 text-destructive text-sm">
                    {error}
                </p>
            )}
        </div>
    )
}

const VisualTile = ({
    visual,
    caption,
    cue,
    className,
    imgClassName,
    style,
    onLoad,
    onError
}: {
    visual: VisualReference
    caption?: string
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
            alt={cue ? `${visual.title} — visual reference for ${cue}` : visual.title}
            className={cn("transition-transform duration-300", imgClassName)}
            loading="lazy"
            decoding="async"
            referrerPolicy="no-referrer"
            onLoad={(event) => onLoad?.(event.currentTarget)}
            onError={onError}
        />
        {caption && (
            <span className="pointer-events-none absolute top-1 left-1 max-w-[calc(100%_-_0.5rem)] truncate rounded-[var(--radius-sm)] bg-background/80 px-2 py-1 text-foreground text-xs backdrop-blur-md">
                {caption}
            </span>
        )}
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
    itemTitles,
    cue,
    onFailed
}: {
    visuals: VisualReference[]
    itemTitles?: Record<string, string>
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
            {width <= 0 && (
                <div aria-hidden="true" className="grid grid-cols-3 gap-2">
                    {visuals.map((visual) => (
                        <div
                            key={visual.id}
                            className="aspect-[4/3] animate-pulse rounded-[var(--radius-md)] bg-muted"
                        />
                    ))}
                </div>
            )}
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
                                caption={
                                    itemTitles && Object.hasOwn(itemTitles, visual.id)
                                        ? itemTitles[visual.id]
                                        : undefined
                                }
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
    title,
    limit,
    variant,
    refs,
    itemTitles,
    framed = false
}: {
    cue: string
    // Card heading for framed galleries; the search cue is the fallback.
    title?: string
    limit: number
    variant: "gallery" | "step"
    // Standalone galleries in chat get their own Spotlight card.
    refs?: string[]
    itemTitles?: Record<string, string>
    framed?: boolean
}) => {
    const context = useContext(VisualSelectionContext)
    const key = visualRequestKey({ cue, limit, variant, ...(refs !== undefined ? { refs } : {}) })
    const selection = context.selections.find((selection) => selection.key === key)
    const visuals = selection?.visuals ?? []
    const status = !selection && context.pending ? "loading" : "ready"
    const [failedIds, setFailedIds] = useState<Set<string>>(() => new Set())

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

    const searchQueries = getVisualSearchQueries({ cue, refs }, visuals)
    // A selected group can combine several searches. Keep their provenance visible
    // even after its heading and per-image labels have been rewritten by the model.
    const heading =
        searchQueries.length > 0 ? (
            <Tooltip>
                <TooltipTrigger asChild>
                    <span
                        // biome-ignore lint/a11y/noNoninteractiveTabindex: keyboard users reach the search cue through focus.
                        tabIndex={0}
                        className="inline-block max-w-full truncate align-top focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                    >
                        {title || cue || "Visual references"}
                    </span>
                </TooltipTrigger>
                <TooltipContent side="bottom">
                    Searched for {searchQueries.map((query) => `“${query}”`).join(", ")}
                </TooltipContent>
            </Tooltip>
        ) : (
            <span className="block truncate">{title || cue || "Visual references"}</span>
        )

    const frame = (body: ReactNode) =>
        framed ? (
            <section className={cn("not-prose", SPOTLIGHT_CARD_CLASS)}>
                {/* The font leaves ~2px more room above its ascenders than below its
                    baseline, so pt-3.5 over the gallery's pt-4 makes the visible gaps above
                    and below the title match the gallery's 20px side and bottom insets. */}
                <SpotlightHeader className="pt-3.5" title={heading} />
                <div className="p-5 pt-4">{body}</div>
            </section>
        ) : (
            body
        )

    const skeleton = (animate: boolean) => (
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
                        "aspect-[4/3] bg-muted",
                        animate && "animate-pulse",
                        framed && "rounded-[var(--radius-md)]"
                    )}
                />
            ))}
        </div>
    )

    if (status === "loading") return frame(skeleton(true))

    if (visibleVisuals.length === 0)
        return !selection && !context.pending && context.legacy
            ? frame(<LoadLegacyVisuals {...context.legacy}>{skeleton(false)}</LoadLegacyVisuals>)
            : null

    if (framed) {
        return frame(
            <ReferenceGallery
                visuals={visibleVisuals}
                itemTitles={itemTitles}
                cue={cue || title || "selected images"}
                onFailed={markFailed}
            />
        )
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
                        caption={
                            itemTitles && Object.hasOwn(itemTitles, visual.id)
                                ? itemTitles[visual.id]
                                : undefined
                        }
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
