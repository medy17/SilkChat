import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip"
import type { SharedModel } from "@/convex/lib/models"
import { useMessageFooterStore } from "@/lib/message-footer-store"
import { getModelCostLevel } from "@/lib/model-cost"
import { cn } from "@/lib/utils"

const COST_LABELS = ["Very low", "Low", "Moderate", "High", "Very high"] as const

const formatPrice = (price: number) =>
    new Intl.NumberFormat("en-US", {
        style: "currency",
        currency: "USD",
        minimumFractionDigits: price < 1 ? 2 : 0,
        maximumFractionDigits: price < 1 ? 3 : 2
    }).format(price)

export function ModelCostIndicator({ model }: { model: SharedModel }) {
    const footerMode = useMessageFooterStore((state) => state.footerMode)
    const level = getModelCostLevel(model)
    if (level === null) return null

    const filledCount = Math.min(level, 3)
    const dollars = "$".repeat(filledCount)
    const dots = "·".repeat(3 - filledCount)
    const isExcessive = level === 4
    const showDetailedPricing = footerMode !== "simple"
    const inputPrice = model.inputUsdPer1MTokens as number
    const outputPrice = model.outputUsdPer1MTokens as number
    const ariaLabel = showDetailedPricing
        ? `${COST_LABELS[level]} model cost: ${formatPrice(inputPrice)} input and ${formatPrice(outputPrice)} output per million tokens`
        : `${COST_LABELS[level]} model cost`

    return (
        <Tooltip>
            <TooltipTrigger asChild>
                <span
                    className="inline-flex shrink-0 font-mono font-semibold text-[0.6875rem] tracking-tight"
                    aria-label={ariaLabel}
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
                    <p>{COST_LABELS[level]} model cost</p>
                    {showDetailedPricing && (
                        <p className="text-xs opacity-80">
                            {formatPrice(inputPrice)} input · {formatPrice(outputPrice)} output / 1M
                            tokens
                        </p>
                    )}
                </div>
            </TooltipContent>
        </Tooltip>
    )
}
