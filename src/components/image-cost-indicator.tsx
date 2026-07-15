import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip"
import {
    type ImageCostEstimate,
    estimateImageCost,
    getImageCostLevel
} from "@/convex/lib/image_generation/cost"
import type { ImageQuality, ImageResolution, ImageSize, SharedModel } from "@/convex/lib/models"
import { cn } from "@/lib/utils"

const COST_LABELS = ["Very low", "Low", "Moderate", "High", "Very high"] as const

export const formatEstimatedImageCost = (usd: number) =>
    new Intl.NumberFormat("en-US", {
        style: "currency",
        currency: "USD",
        minimumFractionDigits: usd < 0.1 ? 3 : 2,
        maximumFractionDigits: usd < 0.1 ? 3 : 2
    }).format(usd)

function CostGlyph({ estimate }: { estimate: ImageCostEstimate }) {
    const level = getImageCostLevel(estimate.totalUsd)
    if (level === null) return null

    const filledCount = Math.min(level, 3)
    const dollars = "$".repeat(filledCount)
    const dots = "·".repeat(3 - filledCount)
    const isExcessive = level === 4
    const formattedTotal = formatEstimatedImageCost(estimate.totalUsd)

    return (
        <Tooltip>
            <TooltipTrigger asChild>
                <span
                    className="inline-flex shrink-0 font-mono font-semibold text-[0.6875rem] tracking-tight"
                    aria-label={`${COST_LABELS[level]} image cost: ${formattedTotal} estimated total`}
                    role="img"
                >
                    {dollars && (
                        <span
                            className={cn(
                                isExcessive
                                    ? "text-model-cost-expensive"
                                    : "text-model-cost-affordable"
                            )}
                        >
                            {dollars}
                        </span>
                    )}
                    {dots && <span className="text-muted-foreground/60">{dots}</span>}
                    {isExcessive && <span className="text-model-cost-expensive">+</span>}
                </span>
            </TooltipTrigger>
            <TooltipContent>
                <div className="space-y-0.5">
                    <p>{formattedTotal} estimated total</p>
                    <p className="text-xs opacity-80">
                        {formatEstimatedImageCost(estimate.usdPerImage)} × {estimate.variants}{" "}
                        {estimate.variants === 1 ? "image" : "images"}
                        {estimate.referenceCount > 0
                            ? ` · ${estimate.referenceCount} reference${estimate.referenceCount === 1 ? "" : "s"}`
                            : ""}
                    </p>
                </div>
            </TooltipContent>
        </Tooltip>
    )
}

export function ImageCostIndicator({
    model,
    aspectRatio,
    resolution,
    quality,
    variants,
    referenceCount
}: {
    model: SharedModel
    aspectRatio?: ImageSize | string
    resolution?: ImageResolution | string
    quality?: ImageQuality
    variants?: number
    referenceCount?: number
}) {
    const estimate = estimateImageCost({
        model,
        aspectRatio: aspectRatio as ImageSize | undefined,
        resolution: resolution as ImageResolution | undefined,
        quality,
        variants,
        referenceCount
    })
    return estimate ? <CostGlyph estimate={estimate} /> : null
}
