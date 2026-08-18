"use client"

import { type RecipeVisual, searchRecipeVisuals } from "@/lib/recipe-visuals"
import { useEffect, useMemo, useState } from "react"

export const RecipeVisuals = ({
    cue,
    limit,
    variant
}: {
    cue: string
    limit: number
    variant: "gallery" | "step"
}) => {
    const [visuals, setVisuals] = useState<RecipeVisual[]>([])
    const [failedIds, setFailedIds] = useState<Set<string>>(() => new Set())
    const [status, setStatus] = useState<"loading" | "ready">("loading")

    useEffect(() => {
        const controller = new AbortController()
        setVisuals([])
        setFailedIds(new Set())
        setStatus("loading")

        searchRecipeVisuals(cue, limit, variant, controller.signal)
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
    const isGallery = variant === "gallery"
    const galleryColumns =
        visibleVisuals.length === 1
            ? "grid-cols-1"
            : visibleVisuals.length === 2
              ? "grid-cols-2"
              : "grid-cols-3"

    if (status === "loading") {
        return (
            <div
                data-recipe-print-hide
                aria-hidden="true"
                className={
                    isGallery
                        ? "grid grid-cols-3 gap-2 overflow-hidden rounded-[var(--radius-xl)]"
                        : "overflow-hidden rounded-[var(--radius-lg)]"
                }
            >
                {Array.from({ length: isGallery ? limit : 1 }, (_, index) => (
                    <div key={index} className="aspect-[4/3] animate-pulse bg-muted" />
                ))}
            </div>
        )
    }

    if (visibleVisuals.length === 0) return null

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
                    <a
                        key={visual.id}
                        href={visual.sourceUrl}
                        target="_blank"
                        rel="noreferrer"
                        className={`group relative isolate block overflow-hidden focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${
                            isGallery ? "aspect-[5/4] bg-muted/60" : "bg-transparent"
                        }`}
                        title={`View source on ${visual.source}`}
                    >
                        <img
                            src={visual.thumbnailUrl}
                            alt={`${visual.title} — visual reference for ${cue}`}
                            className={`transition-transform duration-300 ${
                                isGallery
                                    ? "size-full object-cover group-hover:scale-[1.03]"
                                    : "block h-auto w-full"
                            }`}
                            loading="lazy"
                            decoding="async"
                            referrerPolicy="no-referrer"
                            onError={() =>
                                setFailedIds((current) => new Set(current).add(visual.id))
                            }
                        />
                        <span
                            data-recipe-visual-attribution
                            className="pointer-events-none absolute right-1 bottom-1 z-20 flex max-w-[calc(100%_-_0.5rem)] truncate rounded-[var(--radius-sm)] bg-background/40 px-1.5 py-px text-[9px] text-foreground/65 leading-none shadow-sm backdrop-blur-md transition-colors group-hover:bg-background/55 group-hover:text-foreground/85"
                        >
                            {visual.source}
                        </span>
                    </a>
                ))}
            </div>
        </div>
    )
}
