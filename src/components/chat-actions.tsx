import {
    BranchIcon,
    ClaudeIcon,
    FalAIIcon,
    GeminiIcon,
    GroqIcon,
    OpenAIIcon,
    OpenRouterIcon,
    XAIIcon
} from "@/components/brand-icons"
import type { AssistantConfigOverride } from "@/lib/assistant-config"
import {
    type AssistantMessageMetadata,
    deriveMessageFooterStats,
    formatFooterCost,
    formatFooterCostBreakdown,
    formatFooterReasoningEffort,
    formatFooterSpeed,
    formatFooterTTFT,
    formatFooterTokenBreakdown,
    formatFooterTokenTotal,
    getMessageFooterBrandProvider,
    isMessageFooterMetadataReady,
    mergeMessageFooterMetadata
} from "@/lib/message-footer-stats"
import { useMessageFooterStore } from "@/lib/message-footer-store"
import { getPublicR2AssetUrl } from "@/lib/r2-public-url"
import { captureBrowserEvent } from "@/lib/telemetry/browser"
import { TELEMETRY_EVENTS } from "@/lib/telemetry/events"
import { cn, copyToClipboard } from "@/lib/utils"
import type { UIMessage } from "ai"
import {
    Check,
    Clock3,
    Copy,
    Cpu,
    DollarSign,
    Download,
    Edit3,
    Key,
    PenOff,
    RotateCcw,
    Zap
} from "lucide-react"
import {
    type CSSProperties,
    type ComponentType,
    memo,
    useEffect,
    useMemo,
    useRef,
    useState
} from "react"
import { RetryMenu } from "./retry-menu"
import { Badge } from "./ui/badge"
import { Button } from "./ui/button"
import { Tooltip, TooltipContent, TooltipTrigger } from "./ui/tooltip"

type FooterSegment = {
    key: string
    icon?: ComponentType<{ className?: string }>
    text?: string
    suffix?: string
}

type ImageGenerationAsset = {
    imageUrl?: string
}

const AssistantFooterMarquee = memo(({ segments }: { segments: FooterSegment[] }) => {
    const viewportRef = useRef<HTMLDivElement>(null)
    const contentRef = useRef<HTMLDivElement>(null)
    const [marqueeShift, setMarqueeShift] = useState(0)
    const isOverflowing = marqueeShift > 0

    useEffect(() => {
        const viewport = viewportRef.current
        const content = contentRef.current

        if (!viewport || !content) return

        const measure = () => {
            const contentWidth = Math.ceil(content.scrollWidth)
            const overflowPx = contentWidth - viewport.clientWidth
            const nextShift = overflowPx > 12 ? contentWidth + 12 : 0
            setMarqueeShift((currentShift) =>
                currentShift === nextShift ? currentShift : nextShift
            )
        }

        measure()

        if (typeof ResizeObserver === "undefined") return

        const resizeObserver = new ResizeObserver(measure)
        resizeObserver.observe(viewport)
        resizeObserver.observe(content)

        return () => {
            resizeObserver.disconnect()
        }
    }, [])

    const marqueeStyle = useMemo(() => {
        if (marqueeShift <= 0) return undefined

        const durationSeconds = Math.min(Math.max(marqueeShift / 28, 8), 22)

        return {
            "--footer-marquee-shift": `${marqueeShift}px`,
            "--footer-marquee-duration": `${durationSeconds}s`
        } as CSSProperties
    }, [marqueeShift])

    const renderSegments = (keyPrefix: string) => (
        <div className="inline-flex shrink-0 items-center gap-2.5 whitespace-nowrap">
            {segments.map((segment) => (
                <span
                    key={`${keyPrefix}-${segment.key}`}
                    className="inline-flex shrink-0 items-center gap-1.5"
                >
                    {segment.icon && <segment.icon className="size-3.5 shrink-0" />}
                    <span className="whitespace-nowrap">
                        {segment.text}
                        {segment.suffix ? ` (${segment.suffix})` : ""}
                    </span>
                </span>
            ))}
        </div>
    )

    return (
        <div className="ml-1 w-[clamp(12rem,58vw,22rem)] min-w-0 rounded-md border bg-background/80 px-2.5 py-1 text-muted-foreground text-xs shadow-sm backdrop-blur-sm sm:w-[clamp(13rem,50vw,24rem)] md:w-[clamp(14rem,38vw,26rem)]">
            <div ref={viewportRef} className="footer-marquee-mask overflow-hidden">
                <div
                    data-overflowing={isOverflowing}
                    style={marqueeStyle}
                    className="footer-marquee-track inline-flex min-w-max items-center gap-3 whitespace-nowrap"
                >
                    <div ref={contentRef}>{renderSegments("primary")}</div>
                    {isOverflowing && <div aria-hidden="true">{renderSegments("duplicate")}</div>}
                </div>
            </div>
        </div>
    )
})

AssistantFooterMarquee.displayName = "AssistantFooterMarquee"

export const ChatActions = memo(
    ({
        role,
        message,
        onRetry,
        onBranch,
        onEdit,
        editing = false,
        onCancelEdit,
        requiresVisionForModelSelection = false,
        requiresNativePdfForModelSelection = false,
        copyOnly = false
    }: {
        role: UIMessage["role"]
        message: UIMessage
        onRetry?: (message: UIMessage, configOverride?: AssistantConfigOverride) => void
        onBranch?: (message: UIMessage) => void
        onEdit?: (message: UIMessage) => void
        editing?: boolean
        onCancelEdit?: () => void
        requiresVisionForModelSelection?: boolean
        requiresNativePdfForModelSelection?: boolean
        copyOnly?: boolean
    }) => {
        const [copied, setCopied] = useState(false)
        const footerMode = useMessageFooterStore((state) => state.footerMode)
        const cachedMetadata = useMessageFooterStore((state) =>
            message.role === "assistant" ? state.footerMetadataByMessageId[message.id] : undefined
        )

        const metadata = useMemo((): AssistantMessageMetadata | undefined => {
            if (message.role !== "assistant") return undefined

            const messageMetadata =
                "metadata" in message && message.metadata
                    ? (message.metadata as AssistantMessageMetadata)
                    : undefined

            return mergeMessageFooterMetadata(cachedMetadata, messageMetadata)
        }, [cachedMetadata, message])
        const completedWithError = message.parts.some((part) => part.type === "data-context-error")

        const footerStats = useMemo(
            () =>
                isMessageFooterMetadataReady(metadata, { completedWithError })
                    ? deriveMessageFooterStats(metadata)
                    : null,
            [completedWithError, metadata]
        )

        const ProviderIcon = useMemo(() => {
            switch (getMessageFooterBrandProvider(footerStats)) {
                case "openai":
                    return OpenAIIcon
                case "anthropic":
                    return ClaudeIcon
                case "google":
                    return GeminiIcon
                case "xai":
                    return XAIIcon
                case "groq":
                    return GroqIcon
                case "fal":
                    return FalAIIcon
                case "openrouter":
                    return OpenRouterIcon
                default:
                    return undefined
            }
        }, [footerStats])

        const reasoningLabel = useMemo(
            () => formatFooterReasoningEffort(footerStats?.reasoningEffort),
            [footerStats?.reasoningEffort]
        )

        const isByokProviderSource =
            footerStats?.creditProviderSource === "byok" ||
            footerStats?.creditProviderSource === "openrouter" ||
            footerStats?.creditProviderSource === "custom"
        const providerSourceSuffix =
            isByokProviderSource && footerStats?.contextRouting?.mode === "byok_fallback"
                ? footerStats.contextRouting.reason === "message"
                    ? "large message"
                    : "large thread"
                : undefined

        const footerSegments = useMemo<FooterSegment[]>(() => {
            if (!footerStats) return []

            const tokenBreakdown =
                footerStats.totalTokens !== undefined
                    ? footerMode === "extra-nerdy"
                        ? [
                              formatFooterTokenBreakdown(
                                  "regular",
                                  footerStats.regularOutputTokens
                              ),
                              formatFooterTokenBreakdown("reasoning", footerStats.reasoningTokens),
                              formatFooterTokenBreakdown("in", footerStats.promptTokens),
                              formatFooterTokenBreakdown("out", footerStats.completionTokens)
                          ]
                        : [
                              formatFooterTokenBreakdown("in", footerStats.promptTokens),
                              formatFooterTokenBreakdown("out", footerStats.completionTokens)
                          ]
                    : []

            return [
                {
                    key: "model",
                    icon: ProviderIcon,
                    text: footerStats.modelName,
                    suffix: reasoningLabel
                },
                {
                    key: "provider-source",
                    icon: Key,
                    text: isByokProviderSource ? "BYOK" : undefined,
                    suffix: providerSourceSuffix
                },
                {
                    key: "speed",
                    icon: Zap,
                    text: formatFooterSpeed(footerStats.tokensPerSecond)
                },
                {
                    key: "tokens",
                    icon: Cpu,
                    text: formatFooterTokenTotal(footerStats.totalTokens),
                    suffix:
                        footerStats.totalTokens !== undefined
                            ? tokenBreakdown
                                  .filter((segment): segment is string => Boolean(segment))
                                  .join(", ")
                            : undefined
                },
                {
                    key: "ttft",
                    icon: Clock3,
                    text: formatFooterTTFT(footerStats.timeToFirstVisibleMs)
                },
                {
                    key: "cost",
                    icon: DollarSign,
                    text:
                        footerMode === "extra-nerdy"
                            ? formatFooterCost(footerStats.estimatedCostUsd)
                            : undefined,
                    suffix:
                        footerMode === "extra-nerdy" && footerStats.estimatedCostUsd !== undefined
                            ? [
                                  formatFooterCostBreakdown(
                                      "in",
                                      footerStats.estimatedPromptCostUsd
                                  ),
                                  formatFooterCostBreakdown(
                                      "out",
                                      footerStats.estimatedCompletionCostUsd
                                  )
                              ]
                                  .filter((segment): segment is string => Boolean(segment))
                                  .join(", ")
                            : undefined
                }
            ].filter((segment) => Boolean(segment.text))
        }, [
            ProviderIcon,
            footerMode,
            footerStats,
            isByokProviderSource,
            providerSourceSuffix,
            reasoningLabel
        ])

        const imageGenerationAssets = useMemo(() => {
            const assets: string[] = []
            message.parts.forEach((part) => {
                if (part.type !== "tool-image_generation") return
                if (!("state" in part) || part.state !== "output-available") return
                if (!("output" in part)) return

                const output = part.output
                if (!output || typeof output !== "object" || !("assets" in output)) return
                if (!Array.isArray(output.assets)) return

                output.assets.forEach((asset) => {
                    const imageAsset = asset as ImageGenerationAsset | null | undefined
                    if (imageAsset?.imageUrl) {
                        assets.push(imageAsset.imageUrl)
                    }
                })
            })
            return assets
        }, [message.parts])

        const hasImageGeneration = imageGenerationAssets.length > 0

        const handleCopy = async () => {
            const textContent = message.parts
                .filter((part) => part.type === "text")
                .map((part) => part.text)
                .join("\n")

            await copyToClipboard(textContent)
            if (role === "assistant") {
                captureBrowserEvent(TELEMETRY_EVENTS.responseActioned, {
                    message_id: message.id,
                    action: "copy",
                    asset_count: 0,
                    model_id: metadata?.modelId ?? null
                })
            }
            setCopied(true)
            setTimeout(() => setCopied(false), 1500)
        }

        const handleDownload = async () => {
            captureBrowserEvent(TELEMETRY_EVENTS.responseActioned, {
                message_id: message.id,
                action: "download",
                asset_count: imageGenerationAssets.length,
                model_id: metadata?.modelId ?? null
            })
            if (imageGenerationAssets.length === 1) {
                const url = getPublicR2AssetUrl(imageGenerationAssets[0])
                window.open(url, "_blank")
            } else {
                imageGenerationAssets.forEach((asset, index) => {
                    const url = getPublicR2AssetUrl(asset)
                    setTimeout(() => window.open(url, "_blank"), index * 200)
                })
            }
        }

        return (
            <div
                data-message-actions
                className={cn(
                    "absolute flex items-center gap-1 transition-opacity",
                    editing
                        ? "z-10 opacity-100"
                        : "opacity-100 md:opacity-0 md:group-focus:visible md:group-focus:z-10 md:group-focus:opacity-100 md:group-hover:visible md:group-hover:z-10 md:group-hover:opacity-100 md:group-focus-within:opacity-100",
                    role === "user" ? "right-0 mt-4" : "left-0 mt-3"
                )}
            >
                {!copyOnly && editing ? (
                    <Button
                        variant="ghost"
                        size="icon"
                        disabled
                        aria-label="Retry unavailable while editing"
                        className="h-7 w-7 border bg-background/80 text-foreground shadow-sm backdrop-blur-sm"
                    >
                        <RotateCcw className="h-3.5 w-3.5" />
                    </Button>
                ) : !copyOnly ? (
                    onRetry && (
                        <RetryMenu
                            onRetry={(configOverride) => onRetry(message, configOverride)}
                            requiresVision={requiresVisionForModelSelection}
                            requiresNativePdf={requiresNativePdfForModelSelection}
                        />
                    )
                ) : null}

                {!copyOnly && onBranch && (
                    <Tooltip delayDuration={150}>
                        <TooltipTrigger asChild>
                            <Button
                                variant="ghost"
                                size="icon"
                                className="h-7 w-7 border bg-background/80 text-foreground shadow-sm backdrop-blur-sm hover:bg-accent hover:text-primary"
                                aria-label="Branch chat"
                                onClick={() => onBranch(message)}
                            >
                                <BranchIcon className="h-3.5 w-3.5" />
                            </Button>
                        </TooltipTrigger>
                        <TooltipContent side="bottom">
                            <p>Branch</p>
                        </TooltipContent>
                    </Tooltip>
                )}

                {!copyOnly && editing ? (
                    <Tooltip delayDuration={150}>
                        <TooltipTrigger asChild>
                            <Button
                                variant="ghost"
                                size="icon"
                                className="h-7 w-7 border bg-background/80 text-foreground shadow-sm backdrop-blur-sm hover:bg-accent hover:text-destructive"
                                aria-label="Cancel edit"
                                onClick={onCancelEdit}
                            >
                                <PenOff className="h-3.5 w-3.5" />
                            </Button>
                        </TooltipTrigger>
                        <TooltipContent side="bottom">
                            <p>Cancel edit</p>
                        </TooltipContent>
                    </Tooltip>
                ) : !copyOnly ? (
                    onEdit && (
                        <Tooltip delayDuration={150}>
                            <TooltipTrigger asChild>
                                <Button
                                    variant="ghost"
                                    size="icon"
                                    className="h-7 w-7 border bg-background/80 text-foreground shadow-sm backdrop-blur-sm hover:bg-accent hover:text-primary"
                                    onClick={() => onEdit(message)}
                                >
                                    <Edit3 className="h-3.5 w-3.5" />
                                </Button>
                            </TooltipTrigger>
                            <TooltipContent side="bottom">
                                <p>Edit</p>
                            </TooltipContent>
                        </Tooltip>
                    )
                ) : null}

                {hasImageGeneration && !copyOnly ? (
                    <Tooltip delayDuration={150}>
                        <TooltipTrigger asChild>
                            <Button
                                variant="ghost"
                                size="icon"
                                disabled={editing}
                                aria-label={`Download ${imageGenerationAssets.length > 1 ? "images" : "image"}`}
                                className="h-7 w-7 border bg-background/80 text-foreground shadow-sm backdrop-blur-sm hover:bg-accent hover:text-primary"
                                onClick={handleDownload}
                            >
                                <Download className="h-3.5 w-3.5" />
                            </Button>
                        </TooltipTrigger>
                        <TooltipContent side="bottom">
                            <p>Download {imageGenerationAssets.length > 1 ? "Images" : "Image"}</p>
                        </TooltipContent>
                    </Tooltip>
                ) : (
                    <Tooltip delayDuration={150}>
                        <TooltipTrigger asChild>
                            <Button
                                variant="ghost"
                                size="icon"
                                disabled={editing}
                                aria-label={copied ? "Copied" : "Copy message"}
                                className="h-7 w-7 border bg-background/80 text-foreground shadow-sm backdrop-blur-sm hover:bg-accent hover:text-primary"
                                onClick={handleCopy}
                            >
                                <div className="relative">
                                    <Copy
                                        className={`h-3.5 w-3.5 transition-all duration-200 ${
                                            copied ? "scale-75 opacity-0" : "scale-100 opacity-100"
                                        }`}
                                    />
                                    <Check
                                        className={`absolute inset-0 h-3.5 w-3.5 transition-all duration-200 ${
                                            copied ? "scale-100 opacity-100" : "scale-75 opacity-0"
                                        }`}
                                    />
                                </div>
                            </Button>
                        </TooltipTrigger>
                        <TooltipContent side="bottom">{copied ? "Copied!" : "Copy"}</TooltipContent>
                    </Tooltip>
                )}

                {footerMode === "simple" && footerStats?.modelName && (
                    <Badge variant="secondary" className="ml-1 h-7">
                        <span className="inline-flex items-center gap-1.5">
                            {ProviderIcon && <ProviderIcon className="size-3.5" />}
                            <span>
                                {footerStats.modelName}
                                {reasoningLabel ? ` (${reasoningLabel})` : ""}
                            </span>
                            {isByokProviderSource && (
                                <span className="inline-flex items-center gap-1 text-muted-foreground">
                                    <Key className="size-3" />
                                    <span>BYOK</span>
                                </span>
                            )}
                        </span>
                    </Badge>
                )}

                {(footerMode === "nerd" || footerMode === "extra-nerdy") &&
                    footerSegments.length > 0 && (
                        <AssistantFooterMarquee segments={footerSegments} />
                    )}
            </div>
        )
    }
)

ChatActions.displayName = "ChatActions"
