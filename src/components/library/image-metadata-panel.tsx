import type { Doc } from "@/convex/_generated/dataModel"
import { getReferenceImageSources } from "@/lib/generated-image-urls"
import { TRANSPARENT_BACKDROP_OPTIONS, type TransparentBackdrop } from "@/lib/transparent-backdrop"
import { cn } from "@/lib/utils"
import type { CSSProperties, ReactNode } from "react"

export function ReferenceImageThumbnails({
    referenceImageKeys,
    className
}: {
    referenceImageKeys?: string[]
    className?: string
}) {
    if (!referenceImageKeys?.length) return null

    return (
        <div className={cn("border-border/60 border-t pt-5", className)}>
            <h4 className="mb-2 font-medium text-muted-foreground text-xs uppercase tracking-[0.18em]">
                References
            </h4>
            <div className="flex gap-2 overflow-x-auto pb-1">
                {referenceImageKeys.map((storageKey, index) => {
                    const thumbnailSources = getReferenceImageSources(storageKey)

                    return (
                        <a
                            key={`${storageKey}-${index}`}
                            href={thumbnailSources.fullResolutionUrl}
                            target="_blank"
                            rel="noreferrer"
                            className="block size-12 shrink-0 overflow-hidden rounded-[var(--radius-md)] border border-border/70 bg-muted outline-none transition-colors hover:border-foreground/40 focus-visible:ring-2 focus-visible:ring-primary"
                            aria-label={`Open reference image ${index + 1}`}
                        >
                            <img
                                src={thumbnailSources.src}
                                srcSet={thumbnailSources.srcSet}
                                sizes={thumbnailSources.sizes}
                                alt={`Reference ${index + 1}`}
                                className="h-full w-full object-cover"
                                loading="lazy"
                                decoding="async"
                            />
                        </a>
                    )
                })}
            </div>
        </div>
    )
}

/**
 * The floating metadata card used by the library lightboxes: prompt, model
 * details grid, reference thumbnails, and an optional action footer.
 */
export function ImageMetadataPanel({
    image,
    modelName,
    footer,
    className,
    style,
    transparentBackdrop = "checker",
    onTransparentBackdropChange
}: {
    image: Doc<"generatedImages">
    modelName: string
    footer?: ReactNode
    className?: string
    style?: CSSProperties
    transparentBackdrop?: TransparentBackdrop
    onTransparentBackdropChange?: (backdrop: TransparentBackdrop) => void
}) {
    const formattedDate = new Date(image.createdAt).toLocaleDateString()
    const resolutionLabel = image.resolution || "1K"

    return (
        <div
            className={cn(
                "flex shrink-0 flex-col overflow-hidden rounded-xl border border-border/60 bg-background/95 shadow-2xl backdrop-blur-md",
                className
            )}
            style={style}
        >
            <div className="flex-1 overflow-y-auto p-6">
                <div className="mb-6">
                    <h3 className="mb-3 font-semibold text-2xl">Prompt</h3>
                    <p className="whitespace-pre-wrap text-base text-muted-foreground leading-7">
                        {image.prompt || "No prompt available."}
                    </p>
                </div>

                <div className="grid grid-cols-2 gap-x-6 gap-y-5 border-border/60 border-t pt-6">
                    <div>
                        <h4 className="mb-1 font-medium text-muted-foreground text-xs uppercase tracking-[0.18em]">
                            Model
                        </h4>
                        <p className="text-sm">{modelName}</p>
                    </div>
                    <div>
                        <h4 className="mb-1 font-medium text-muted-foreground text-xs uppercase tracking-[0.18em]">
                            Aspect Ratio
                        </h4>
                        <p className="text-sm">{image.aspectRatio || "Unknown"}</p>
                    </div>
                    <div>
                        <h4 className="mb-1 font-medium text-muted-foreground text-xs uppercase tracking-[0.18em]">
                            Resolution
                        </h4>
                        <p className="text-sm">{resolutionLabel}</p>
                    </div>
                    {image.transparentBackground && onTransparentBackdropChange && (
                        <div>
                            <h4 className="mb-1.5 font-medium text-muted-foreground text-xs uppercase tracking-[0.18em]">
                                Background
                            </h4>
                            <div
                                className="flex items-center gap-2"
                                role="radiogroup"
                                aria-label="Transparent image backdrop"
                            >
                                {TRANSPARENT_BACKDROP_OPTIONS.map((option) => {
                                    const isSelected = transparentBackdrop === option.value
                                    return (
                                        <button
                                            key={option.value}
                                            type="button"
                                            role="radio"
                                            aria-checked={isSelected}
                                            aria-label={`${option.label} backdrop`}
                                            className={cn(
                                                "size-5 rounded-[var(--radius-sm)] outline-none ring-offset-2 ring-offset-background transition-shadow focus-visible:ring-2 focus-visible:ring-primary",
                                                option.className,
                                                isSelected
                                                    ? "ring-2 ring-primary"
                                                    : "ring-1 ring-border hover:ring-foreground/40"
                                            )}
                                            onClick={() =>
                                                onTransparentBackdropChange(option.value)
                                            }
                                        />
                                    )
                                })}
                            </div>
                        </div>
                    )}
                    <div>
                        <h4 className="mb-1 font-medium text-muted-foreground text-xs uppercase tracking-[0.18em]">
                            Date
                        </h4>
                        <p className="text-sm">{formattedDate}</p>
                    </div>
                </div>
                <ReferenceImageThumbnails
                    referenceImageKeys={image.referenceImageKeys}
                    className="mt-6"
                />
            </div>

            {footer && <div className="border-border/60 border-t p-4">{footer}</div>}
        </div>
    )
}
