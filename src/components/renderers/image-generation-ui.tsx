import { ImageDetailsModal } from "@/components/library/image-details-modal"
import { ImageLoadIndicator } from "@/components/library/image-load-indicator"
import { Button } from "@/components/ui/button"
import { ImageSkeleton } from "@/components/ui/image-skeleton"
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip"
import { api } from "@/convex/_generated/api"
import type { Doc, Id } from "@/convex/_generated/dataModel"
import { getChatImageCardSources } from "@/lib/generated-image-urls"
import { matchesNextImageShortcut, matchesPreviousImageShortcut } from "@/lib/keyboard-shortcuts"
import { getPublicR2AssetUrl } from "@/lib/r2-public-url"
import { useSharedModels } from "@/lib/shared-models"
import { cn } from "@/lib/utils"
import { useNavigate } from "@tanstack/react-router"
import type { UIToolInvocation } from "ai"
import { useAction, useQuery } from "convex/react"
import { ConvexError } from "convex/values"
import {
    AlertCircle,
    ChevronDown,
    ChevronLeft,
    ChevronRight,
    Coins,
    Image as ImageIcon,
    Loader2,
    RotateCcw,
    Sparkles,
    X
} from "lucide-react"
import { type ReactNode, memo, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react"
import { toast } from "sonner"

type ImageGenerationAsset = {
    imageUrl: string
    generatedImageId?: Id<"generatedImages">
    storageKey?: string
    variantIndex?: number
}

type ImageGenerationToolInvocation = UIToolInvocation<{
    input: unknown
    output: unknown | undefined
}>

type PreparedImageGenerationOutput = {
    success?: boolean
    kind?: "prepared_image_generation"
    status?:
        | "pending_confirmation"
        | "submitting"
        | "submitted"
        | "processing"
        | "completed"
        | "partial"
        | "failed"
        | "refunded"
        | "storing_failed"
    cardId?: string
    title?: string
    prompt?: string
    modelId?: string
    modelName?: string
    aspectRatio?: string
    resolution?: string
    variants?: number
    references?: Array<{ id: string; label: string; source?: string }>
    estimatedCredits?: {
        bucket: "basic" | "pro" | "none"
        units: number
        counted: boolean
        requiredPlan: "free" | "pro"
    }
    jobIds?: Id<"imageGenerationJobs">[]
    generatedImageIds?: Id<"generatedImages">[]
    assets?: Array<{
        generatedImageId: Id<"generatedImages">
        storageKey?: string
        imageUrl?: string
        variantIndex?: number
    }>
    error?: string
}

const DEFAULT_ASPECT_RATIO = {
    cssAspectRatio: "1/1",
    displayAspectRatio: "1:1"
}

const isFinitePositiveNumber = (value: number) => Number.isFinite(value) && value > 0

const getGreatestCommonDivisor = (a: number, b: number): number =>
    b === 0 ? Math.abs(a) : getGreatestCommonDivisor(b, a % b)

const parseAspectRatioForDisplay = (value: unknown) => {
    if (typeof value !== "string") return DEFAULT_ASPECT_RATIO

    const aspectRatio = value.trim()
    if (!aspectRatio) return DEFAULT_ASPECT_RATIO

    if (aspectRatio.includes("x")) {
        const [width, height] = aspectRatio.split("x").map(Number)
        if (!isFinitePositiveNumber(width) || !isFinitePositiveNumber(height)) {
            return DEFAULT_ASPECT_RATIO
        }

        const divisor = getGreatestCommonDivisor(width, height)
        return {
            cssAspectRatio: `${width}/${height}`,
            displayAspectRatio: `${width / divisor}:${height / divisor}`
        }
    }

    if (aspectRatio.includes(":")) {
        const baseRatio = aspectRatio.replace("-hd", "")
        const [width, height] = baseRatio.split(":").map(Number)
        if (!isFinitePositiveNumber(width) || !isFinitePositiveNumber(height)) {
            return DEFAULT_ASPECT_RATIO
        }

        return {
            cssAspectRatio: `${width}/${height}`,
            displayAspectRatio: aspectRatio.replace("-hd", " (HD)")
        }
    }

    return DEFAULT_ASPECT_RATIO
}

const clampGridDimension = (value: number) => {
    if (!Number.isFinite(value)) return 20
    return Math.min(80, Math.max(1, Math.round(value)))
}

const MAX_IMAGE_LOAD_RETRIES = 3

// ConvexError carries the clean, user-facing message in `data`; plain action
// errors arrive wrapped in Convex's "[CONVEX A(...)] Server Error ..." banner.
const getActionErrorMessage = (error: unknown, fallback: string) => {
    if (error instanceof ConvexError && typeof error.data === "string") {
        return error.data
    }
    return fallback
}

const resolveImageAssetUrl = (value: string) => {
    if (value.startsWith("http://") || value.startsWith("https://") || value.startsWith("data:")) {
        return value
    }

    return getPublicR2AssetUrl(value)
}

const getCreditLabel = (credits?: PreparedImageGenerationOutput["estimatedCredits"]) => {
    if (!credits || credits.bucket === "none" || credits.units <= 0) return null
    return "Included usage"
}

function RevealBlock({
    show,
    children
}: {
    show: boolean
    children: ReactNode
}) {
    return (
        <div
            className={
                show
                    ? "grid grid-rows-[1fr] opacity-100 transition-[grid-template-rows,opacity] duration-500 ease-out"
                    : "grid grid-rows-[0fr] opacity-0 transition-[grid-template-rows,opacity] duration-500 ease-out"
            }
        >
            <div className="min-h-0 overflow-hidden">{children}</div>
        </div>
    )
}

const getPromptTextId = (toolCallId: string) => `image-generation-prompt-${toolCallId}`
const getImagePreviewId = (toolCallId: string) => `image-generation-preview-${toolCallId}`

function PromptText({
    text,
    clampLines = 3,
    className,
    id
}: {
    text: string
    clampLines?: 2 | 3
    className?: string
    id?: string
}) {
    const ref = useRef<HTMLParagraphElement>(null)
    const [expanded, setExpanded] = useState(false)
    const [metrics, setMetrics] = useState({
        collapsedHeight: 0,
        expandedHeight: 0,
        overflowing: false
    })

    useLayoutEffect(() => {
        const element = ref.current
        if (!element) return

        const styles = window.getComputedStyle(element)
        const parsedLineHeight = Number.parseFloat(styles.lineHeight)
        const parsedFontSize = Number.parseFloat(styles.fontSize)
        const lineHeight = Number.isFinite(parsedLineHeight)
            ? parsedLineHeight
            : parsedFontSize * 1.5
        const collapsedHeight = Math.ceil(lineHeight * clampLines)
        const expandedHeight = Math.ceil(element.scrollHeight)
        const overflowing = expandedHeight - collapsedHeight > 1

        setMetrics((current) => {
            if (
                current.collapsedHeight === collapsedHeight &&
                current.expandedHeight === expandedHeight &&
                current.overflowing === overflowing
            ) {
                return current
            }

            return { collapsedHeight, expandedHeight, overflowing }
        })
    })

    const maxHeight = metrics.overflowing
        ? expanded
            ? metrics.expandedHeight
            : metrics.collapsedHeight
        : undefined

    return (
        <div className="space-y-1">
            <div
                className="overflow-hidden transition-[max-height] duration-300 ease-out"
                style={maxHeight ? { maxHeight } : undefined}
            >
                <p ref={ref} id={id} className={cn("whitespace-pre-wrap", className)}>
                    {text}
                </p>
            </div>
            {(metrics.overflowing || expanded) && (
                <button
                    type="button"
                    className="inline-flex items-center gap-0.5 font-medium text-primary text-xs transition-colors hover:text-primary/80"
                    aria-expanded={expanded}
                    aria-controls={id}
                    aria-label={expanded ? "Collapse image prompt" : "Expand image prompt"}
                    onClick={() => setExpanded((value) => !value)}
                >
                    {expanded ? "Show less" : "Show more"}
                    <ChevronDown
                        className={cn("size-3 transition-transform", expanded && "rotate-180")}
                    />
                </button>
            )}
        </div>
    )
}

function FrostedChip({
    icon,
    label,
    ariaLabel,
    tooltip,
    tooltipSide = "top"
}: {
    icon?: ReactNode
    label: string
    ariaLabel?: string
    tooltip?: string
    tooltipSide?: "top" | "right" | "bottom" | "left"
}) {
    const chip = (
        <span
            className="inline-flex items-center gap-1 rounded-[var(--radius-md)] bg-background/75 px-2 py-0.5 font-medium text-foreground/90 text-xs shadow-sm outline-none backdrop-blur-md focus-visible:ring-2 focus-visible:ring-primary"
            aria-label={ariaLabel}
            tabIndex={tooltip ? 0 : undefined}
        >
            {icon}
            {label}
        </span>
    )

    if (!tooltip) return chip

    return (
        <Tooltip>
            <TooltipTrigger asChild>{chip}</TooltipTrigger>
            <TooltipContent side={tooltipSide} sideOffset={6}>
                {tooltip}
            </TooltipContent>
        </Tooltip>
    )
}

function TooltipIconPill({
    children,
    tooltip,
    ariaLabel,
    className
}: {
    children: ReactNode
    tooltip: string
    ariaLabel?: string
    className?: string
}) {
    return (
        <Tooltip>
            <TooltipTrigger asChild>
                <span
                    className={cn(
                        "inline-flex outline-none focus-visible:ring-2 focus-visible:ring-primary",
                        className
                    )}
                    aria-label={ariaLabel ?? tooltip}
                >
                    {children}
                </span>
            </TooltipTrigger>
            <TooltipContent>{tooltip}</TooltipContent>
        </Tooltip>
    )
}

function SidebarModelsIcon({ className }: { className?: string }) {
    return (
        <svg
            className={className}
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            aria-hidden="true"
        >
            <path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z" />
        </svg>
    )
}

function SidebarAspectRatioIcon({ className }: { className?: string }) {
    return (
        <svg
            className={className}
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            aria-hidden="true"
        >
            <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
        </svg>
    )
}

function SidebarResolutionIcon({ className }: { className?: string }) {
    return (
        <svg
            className={className}
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            aria-hidden="true"
        >
            <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z" />
            <polyline points="3.27 6.96 12 12.01 20.73 6.96" />
            <line x1="12" y1="22.08" x2="12" y2="12" />
        </svg>
    )
}

export const ImageGenerationToolRenderer = memo(
    ({
        toolInvocation,
        threadId,
        messageId
    }: {
        toolInvocation: ImageGenerationToolInvocation
        threadId?: string
        messageId?: string
    }) => {
        const navigate = useNavigate()
        const { models: sharedModels } = useSharedModels()
        const confirmPreparedImageGeneration = useAction(
            api.images_node.confirmPreparedChatImageGeneration
        )
        const reprocessImageGenerationJobAsset = useAction(
            api.image_generation_jobs.reprocessImageGenerationJobAsset
        )
        const [isConfirming, setIsConfirming] = useState(false)
        const [retryingAssetJobIds, setRetryingAssetJobIds] = useState<Set<string>>(new Set())
        const [activeAssetIndex, setActiveAssetIndex] = useState(0)
        const generatedImageIds = useMemo(() => {
            const output =
                toolInvocation.state === "output-available" &&
                typeof toolInvocation.output === "object" &&
                toolInvocation.output !== null
                    ? (toolInvocation.output as PreparedImageGenerationOutput)
                    : undefined

            const ids = new Set<Id<"generatedImages">>()
            for (const id of output?.generatedImageIds ?? []) {
                ids.add(id)
            }
            for (const asset of output?.assets ?? []) {
                if (asset.generatedImageId) ids.add(asset.generatedImageId)
            }
            return Array.from(ids)
        }, [toolInvocation.output, toolInvocation.state])
        const generatedImages = useQuery(
            api.images.listGeneratedImagesByIds,
            generatedImageIds.length > 0 ? { ids: generatedImageIds } : "skip"
        ) as Doc<"generatedImages">[] | undefined
        const creditSummary = useQuery(api.credits.getMyCreditSummary)
        // Accumulate images so a transient `undefined` (which the query returns while it
        // re-subscribes as new variant ids stream in) doesn't drop the currently-viewed
        // image, which would otherwise flash a reload and unmount the open details modal.
        const generatedImageByIdRef = useRef(
            new Map<Id<"generatedImages">, Doc<"generatedImages">>()
        )
        const generatedImageById = useMemo(() => {
            if (!generatedImages) return generatedImageByIdRef.current
            const next = new Map(generatedImageByIdRef.current)
            for (const image of generatedImages) {
                next.set(image._id, image)
            }
            generatedImageByIdRef.current = next
            return next
        }, [generatedImages])
        const isLoading =
            toolInvocation.state === "input-streaming" || toolInvocation.state === "input-available"
        const hasResult =
            toolInvocation.state === "output-available" && toolInvocation.output !== undefined
        const preparedOutput =
            hasResult &&
            typeof toolInvocation.output === "object" &&
            toolInvocation.output !== null &&
            (toolInvocation.output as PreparedImageGenerationOutput).kind ===
                "prepared_image_generation"
                ? (toolInvocation.output as PreparedImageGenerationOutput)
                : undefined
        const hasError =
            hasResult &&
            typeof toolInvocation.output === "object" &&
            toolInvocation.output !== null &&
            "error" in toolInvocation.output &&
            !preparedOutput
        const preparedAssetCount = preparedOutput?.assets?.length ?? 0
        // Total navigable slots: while more variants are still generating we expose a slot
        // per expected variant (ready assets + pending placeholders) so the carousel index
        // survives an image becoming ready instead of snapping back to the ready range.
        const preparedStatus = preparedOutput?.status ?? "pending_confirmation"
        const preparedVariantCount = Math.max(preparedOutput?.variants ?? 1, preparedAssetCount, 1)
        const preparedIsAwaitingVariants =
            preparedAssetCount > 0 &&
            preparedAssetCount < preparedVariantCount &&
            preparedStatus !== "failed" &&
            preparedStatus !== "partial" &&
            preparedStatus !== "refunded" &&
            preparedStatus !== "storing_failed" &&
            !preparedOutput?.error
        const navigableSlotCount = preparedIsAwaitingVariants
            ? preparedVariantCount
            : Math.max(preparedAssetCount, 1)

        useEffect(() => {
            setActiveAssetIndex((current) => Math.min(Math.max(current, 0), navigableSlotCount - 1))
        }, [navigableSlotCount])

        // Extract aspect ratio from args to determine container dimensions
        const aspectRatio =
            (toolInvocation.output as PreparedImageGenerationOutput | undefined)?.aspectRatio ??
            (toolInvocation.input as { imageSize?: string; aspectRatio?: string } | undefined)
                ?.imageSize ??
            (toolInvocation.input as { aspectRatio?: string } | undefined)?.aspectRatio ??
            "1:1"

        const { cssAspectRatio, displayAspectRatio } = useMemo(
            () => parseAspectRatioForDisplay(aspectRatio),
            [aspectRatio]
        )

        // Calculate optimal rows and cols based on aspect ratio
        const { rows, cols } = useMemo(() => {
            const [widthRatio, heightRatio] = cssAspectRatio.split("/").map(Number)
            const baseSize = 20 // Base number of dots for smaller dimension
            if (!isFinitePositiveNumber(widthRatio) || !isFinitePositiveNumber(heightRatio)) {
                return { rows: baseSize, cols: baseSize }
            }

            if (widthRatio >= heightRatio) {
                // Landscape or square
                const calculatedCols = Math.round(baseSize * (widthRatio / heightRatio))
                return { rows: baseSize, cols: clampGridDimension(calculatedCols) }
            }
            // Portrait
            const calculatedRows = Math.round(baseSize * (heightRatio / widthRatio))
            return { rows: clampGridDimension(calculatedRows), cols: baseSize }
        }, [cssAspectRatio])

        if (isLoading) {
            return (
                <div
                    className="w-full max-w-md overflow-hidden rounded-[var(--radius-xl)] border bg-muted/5"
                    style={{ aspectRatio: cssAspectRatio }}
                >
                    <ImageSkeleton
                        rows={rows}
                        cols={cols}
                        dotSize={3}
                        gap={4}
                        loadingDuration={99999}
                        autoLoop={false}
                        className="h-full w-full rounded-[var(--radius-xl)] border-0 bg-transparent"
                    />
                </div>
            )
        }

        if (hasError) {
            return (
                <div
                    className="flex w-full max-w-md flex-col items-center justify-center rounded-[var(--radius-xl)] border border-destructive/50 bg-destructive/10"
                    style={{ aspectRatio: cssAspectRatio }}
                    role="alert"
                >
                    <AlertCircle
                        className="mx-auto mb-2 size-8 text-destructive/70"
                        aria-hidden="true"
                    />
                    <p className="text-destructive text-sm">
                        {String(
                            (toolInvocation.output as { error?: string }).error ||
                                "Failed to generate image"
                        )}
                    </p>
                </div>
            )
        }

        if (preparedOutput) {
            const output = preparedOutput
            const assets = output.assets ?? []
            const status = output.status ?? "pending_confirmation"
            const variantCount = Math.max(output.variants ?? 1, assets.length, 1)
            // Slot-based: ready assets plus pending placeholders while variants generate.
            const totalSlots = navigableSlotCount
            const visibleSlotIndex = Math.min(Math.max(activeAssetIndex, 0), totalSlots - 1)
            const visibleAsset = assets[visibleSlotIndex]
            const canNavigateSlots = totalSlots > 1
            const goToPreviousVariant = () =>
                setActiveAssetIndex((current) => Math.max(0, current - 1))
            const goToNextVariant = () =>
                setActiveAssetIndex((current) => Math.min(totalSlots - 1, current + 1))
            const retryableJobIds = status === "storing_failed" ? (output.jobIds ?? []) : []
            const isRetryingAsset = retryableJobIds.some((jobId) => retryingAssetJobIds.has(jobId))
            const isWorking =
                status === "submitting" ||
                status === "submitted" ||
                status === "processing" ||
                isConfirming ||
                isRetryingAsset
            const isComplete = assets.length > 0
            const isTerminalError =
                Boolean(output.error) &&
                (status === "failed" || status === "partial" || status === "refunded")
            const isAwaitingVariants =
                isComplete &&
                assets.length < variantCount &&
                status !== "failed" &&
                status !== "partial" &&
                status !== "refunded" &&
                status !== "storing_failed" &&
                !output.error
            // The active slot points past the ready assets at a still-generating variant.
            const isPendingSlot = !visibleAsset && isAwaitingVariants
            const canConfirm =
                status === "pending_confirmation" &&
                output.cardId &&
                threadId &&
                messageId &&
                !isConfirming
            const needsPlanUpgrade =
                output.estimatedCredits?.requiredPlan === "pro" && creditSummary?.plan === "free"
            const isPlanLoading =
                output.estimatedCredits?.requiredPlan === "pro" && creditSummary === undefined
            const handleConfirm = async () => {
                if (!output.cardId || !threadId || !messageId) return
                setIsConfirming(true)
                try {
                    await confirmPreparedImageGeneration({
                        threadId: threadId as Id<"threads">,
                        assistantMessageId: messageId,
                        toolCallId: toolInvocation.toolCallId,
                        cardId: output.cardId
                    })
                } catch (error) {
                    toast.error(getActionErrorMessage(error, "Failed to start image generation"))
                } finally {
                    setIsConfirming(false)
                }
            }
            const handleRefetch = async () => {
                if (retryableJobIds.length === 0) return

                setRetryingAssetJobIds((current) => {
                    const next = new Set(current)
                    for (const jobId of retryableJobIds) {
                        next.add(jobId)
                    }
                    return next
                })

                try {
                    const results = await Promise.allSettled(
                        retryableJobIds.map((jobId) =>
                            reprocessImageGenerationJobAsset({
                                jobId
                            })
                        )
                    )
                    const rejected = results.find(
                        (result): result is PromiseRejectedResult => result.status === "rejected"
                    )
                    if (rejected) {
                        throw rejected.reason
                    }
                    toast.success("Image refetched")
                } catch (error) {
                    toast.error(getActionErrorMessage(error, "Failed to refetch image"))
                } finally {
                    setRetryingAssetJobIds((current) => {
                        const next = new Set(current)
                        for (const jobId of retryableJobIds) {
                            next.delete(jobId)
                        }
                        return next
                    })
                }
            }
            const credits = getCreditLabel(output.estimatedCredits)
            const title = output.title?.trim() || "SilkScreen"
            const prompt = output.prompt ?? ""
            const modelLabel = output.modelName ?? output.modelId ?? "Image model"
            const isPending = status === "pending_confirmation" && !isConfirming
            const showCanvas = !isPending || Boolean(visibleAsset)
            const promptId = getPromptTextId(toolInvocation.toolCallId)
            const previewId = getImagePreviewId(toolInvocation.toolCallId)

            return (
                <section
                    className="not-prose relative my-3 w-full max-w-md overflow-hidden rounded-[var(--radius-xl)] border bg-card shadow-sm"
                    aria-label={`Image generation card: ${title}`}
                    aria-describedby={prompt ? promptId : undefined}
                >
                    <div className="pointer-events-none absolute inset-x-0 top-0 z-20 flex items-start justify-between gap-2 p-2.5">
                        <TooltipIconPill tooltip={title} className="pointer-events-auto min-w-0">
                            <span className="flex min-w-0 items-center gap-1.5 rounded-[var(--radius-md)] bg-background/75 px-2 py-1 font-medium text-foreground text-xs shadow-sm backdrop-blur-md">
                                <Sparkles
                                    className="size-3 shrink-0 text-primary"
                                    aria-hidden="true"
                                />
                                <span className="truncate">{title}</span>
                            </span>
                        </TooltipIconPill>
                        {credits && (
                            <TooltipIconPill
                                tooltip="Counts toward included usage"
                                className="pointer-events-auto shrink-0"
                            >
                                <span className="flex items-center gap-1 rounded-[var(--radius-md)] bg-background/75 px-2 py-1 font-medium text-foreground text-xs shadow-sm backdrop-blur-md">
                                    <Coins className="size-3" aria-hidden="true" />
                                    {credits}
                                </span>
                            </TooltipIconPill>
                        )}
                    </div>

                    <RevealBlock show={showCanvas}>
                        <div
                            id={showCanvas ? previewId : undefined}
                            className="relative overflow-hidden border-b bg-muted/30"
                            style={{ aspectRatio: cssAspectRatio }}
                            role={canNavigateSlots ? "group" : undefined}
                            aria-roledescription={canNavigateSlots ? "carousel" : undefined}
                            aria-label={
                                visibleAsset
                                    ? `Generated image preview ${visibleSlotIndex + 1} of ${totalSlots}`
                                    : isPendingSlot
                                      ? `Generating variant ${visibleSlotIndex + 1} of ${totalSlots}`
                                      : isWorking
                                        ? "Image generation in progress"
                                        : undefined
                            }
                            onKeyDown={
                                canNavigateSlots
                                    ? (event) => {
                                          // Portal children (e.g. the details modal) bubble
                                          // keydowns through the React tree; ignore anything that
                                          // didn't originate from this card's own DOM subtree.
                                          if (
                                              !(event.target instanceof Node) ||
                                              !event.currentTarget.contains(event.target)
                                          ) {
                                              return
                                          }
                                          if (
                                              matchesPreviousImageShortcut(event) &&
                                              visibleSlotIndex > 0
                                          ) {
                                              event.preventDefault()
                                              goToPreviousVariant()
                                          } else if (
                                              matchesNextImageShortcut(event) &&
                                              visibleSlotIndex < totalSlots - 1
                                          ) {
                                              event.preventDefault()
                                              goToNextVariant()
                                          }
                                      }
                                    : undefined
                            }
                        >
                            {visibleAsset ? (
                                (() => {
                                    const key = visibleAsset.storageKey ?? visibleAsset.imageUrl
                                    if (!key) return null
                                    return (
                                        <ImageWithErrorHandler
                                            // Stable key so the instance (and its open details
                                            // modal) persists while cycling variants, letting the
                                            // expanded view navigate instead of unmounting/closing.
                                            key="variant-carousel-image"
                                            asset={{
                                                imageUrl: key,
                                                generatedImageId: visibleAsset.generatedImageId,
                                                storageKey: visibleAsset.storageKey,
                                                variantIndex: visibleAsset.variantIndex
                                            }}
                                            prompt={prompt || "Generated image"}
                                            modelName={output.modelName}
                                            cssAspectRatio={cssAspectRatio}
                                            image={
                                                visibleAsset.generatedImageId
                                                    ? generatedImageById.get(
                                                          visibleAsset.generatedImageId
                                                      )
                                                    : undefined
                                            }
                                            className="h-full max-w-none rounded-none border-0"
                                            ariaLabel={`Open generated image ${visibleSlotIndex + 1} of ${totalSlots}`}
                                            onNavigatePrevious={goToPreviousVariant}
                                            onNavigateNext={goToNextVariant}
                                            // The details modal only navigates ready images, so
                                            // bound it to the ready range (which is contiguous).
                                            canNavigatePrevious={visibleSlotIndex > 0}
                                            canNavigateNext={visibleSlotIndex < assets.length - 1}
                                        />
                                    )
                                })()
                            ) : isPendingSlot ? (
                                <div
                                    className="relative h-full w-full"
                                    aria-label={`Variant ${visibleSlotIndex + 1} of ${totalSlots} is still generating`}
                                >
                                    <ImageSkeleton
                                        rows={rows}
                                        cols={cols}
                                        dotSize={3}
                                        gap={4}
                                        loadingDuration={99999}
                                        autoLoop={false}
                                        className="h-full w-full border-0 bg-transparent"
                                    />
                                    <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
                                        <span className="inline-flex items-center gap-1.5 rounded-[var(--radius-md)] bg-background/75 px-2.5 py-1 font-medium text-foreground text-xs shadow-sm backdrop-blur-md">
                                            <Loader2
                                                className="size-3 animate-spin"
                                                aria-hidden="true"
                                            />
                                            Generating…
                                        </span>
                                    </div>
                                </div>
                            ) : isWorking ? (
                                <ImageSkeleton
                                    rows={rows}
                                    cols={cols}
                                    dotSize={3}
                                    gap={4}
                                    loadingDuration={99999}
                                    autoLoop={false}
                                    className="h-full w-full border-0 bg-transparent"
                                />
                            ) : status === "storing_failed" ? (
                                <div
                                    className="flex h-full w-full flex-col items-center justify-center gap-3 bg-destructive/10 p-4 text-center"
                                    role="alert"
                                >
                                    <AlertCircle
                                        className="size-8 text-destructive/80"
                                        aria-hidden="true"
                                    />
                                    <p className="text-destructive text-sm">
                                        {output.error || "Couldn't store this image."}
                                    </p>
                                </div>
                            ) : (
                                <div className="flex h-full w-full items-center justify-center bg-muted/10">
                                    <ImageIcon
                                        className="size-7 text-muted-foreground/45"
                                        aria-hidden="true"
                                    />
                                </div>
                            )}

                            {canNavigateSlots && (visibleAsset || isPendingSlot) && (
                                <>
                                    <Tooltip>
                                        <TooltipTrigger asChild>
                                            <button
                                                type="button"
                                                className="-translate-y-1/2 absolute top-1/2 left-2 z-10 size-8 rounded-[var(--radius-md)] border border-background/40 bg-background/80 text-foreground shadow-lg backdrop-blur-md hover:bg-background"
                                                aria-disabled={visibleSlotIndex <= 0}
                                                onClick={(event) => {
                                                    event.stopPropagation()
                                                    if (visibleSlotIndex <= 0) return
                                                    goToPreviousVariant()
                                                }}
                                                onMouseDown={(event) => event.stopPropagation()}
                                            >
                                                <span
                                                    className={cn(
                                                        "inline-flex size-full items-center justify-center transition-opacity",
                                                        visibleSlotIndex <= 0 && "opacity-50"
                                                    )}
                                                >
                                                    <ChevronLeft
                                                        className="size-4"
                                                        aria-hidden="true"
                                                    />
                                                    <span className="sr-only">
                                                        Previous variant, currently viewing{" "}
                                                        {visibleSlotIndex + 1} of {totalSlots}
                                                    </span>
                                                </span>
                                            </button>
                                        </TooltipTrigger>
                                        <TooltipContent>Previous variant</TooltipContent>
                                    </Tooltip>
                                    <Tooltip>
                                        <TooltipTrigger asChild>
                                            <button
                                                type="button"
                                                className="-translate-y-1/2 absolute top-1/2 right-2 z-10 size-8 rounded-[var(--radius-md)] border border-background/40 bg-background/80 text-foreground shadow-lg backdrop-blur-md hover:bg-background"
                                                aria-disabled={visibleSlotIndex >= totalSlots - 1}
                                                onClick={(event) => {
                                                    event.stopPropagation()
                                                    if (visibleSlotIndex >= totalSlots - 1) {
                                                        return
                                                    }
                                                    goToNextVariant()
                                                }}
                                                onMouseDown={(event) => event.stopPropagation()}
                                            >
                                                <span
                                                    className={cn(
                                                        "inline-flex size-full items-center justify-center transition-opacity",
                                                        visibleSlotIndex >= totalSlots - 1 &&
                                                            "opacity-50"
                                                    )}
                                                >
                                                    <ChevronRight
                                                        className="size-4"
                                                        aria-hidden="true"
                                                    />
                                                    <span className="sr-only">
                                                        Next variant, currently viewing{" "}
                                                        {visibleSlotIndex + 1} of {totalSlots}
                                                    </span>
                                                </span>
                                            </button>
                                        </TooltipTrigger>
                                        <TooltipContent>Next variant</TooltipContent>
                                    </Tooltip>
                                    <Tooltip>
                                        <TooltipTrigger asChild>
                                            <div
                                                className="absolute right-2 bottom-2 z-10 rounded-[var(--radius-md)] border border-background/40 bg-background/80 px-2 py-1 font-medium text-foreground text-xs shadow-lg backdrop-blur-md"
                                                aria-label={`Variant ${visibleSlotIndex + 1} of ${totalSlots}`}
                                            >
                                                {visibleSlotIndex + 1} / {totalSlots}
                                            </div>
                                        </TooltipTrigger>
                                        <TooltipContent side="left" sideOffset={6}>
                                            Variant {visibleSlotIndex + 1} of {totalSlots}
                                        </TooltipContent>
                                    </Tooltip>
                                </>
                            )}
                        </div>
                    </RevealBlock>

                    <div
                        className={cn(
                            "space-y-2.5 p-4 transition-[padding] duration-500 ease-out",
                            isPending ? "pt-12" : "pt-4"
                        )}
                    >
                        <PromptText
                            id={promptId}
                            text={prompt}
                            clampLines={3}
                            className="text-foreground/90 text-sm leading-relaxed"
                        />
                        <div className="flex flex-wrap gap-1.5">
                            <FrostedChip
                                icon={<SidebarAspectRatioIcon className="size-3" />}
                                label={displayAspectRatio}
                                ariaLabel={`Aspect ratio: ${displayAspectRatio}`}
                                tooltip="Aspect ratio"
                                tooltipSide="bottom"
                            />
                            <FrostedChip
                                icon={<SidebarModelsIcon className="size-3" />}
                                label={modelLabel}
                                ariaLabel={`Model: ${modelLabel}`}
                                tooltip="Model"
                                tooltipSide="bottom"
                            />
                            <FrostedChip
                                icon={<X className="size-3" aria-hidden="true" />}
                                label={`${variantCount}`}
                                ariaLabel={`${variantCount} ${
                                    variantCount === 1 ? "variant" : "variants"
                                }`}
                                tooltip="Variant count"
                                tooltipSide="bottom"
                            />
                            <FrostedChip
                                icon={<SidebarResolutionIcon className="size-3" />}
                                label={output.resolution ?? "Standard"}
                                ariaLabel={`Resolution: ${output.resolution ?? "Standard"}`}
                                tooltip="Resolution"
                                tooltipSide="bottom"
                            />
                        </div>
                        {(output.references?.length ?? 0) > 0 && (
                            <div className="flex flex-wrap gap-1.5">
                                {output.references?.map((reference) => (
                                    <FrostedChip key={reference.id} label={reference.label} />
                                ))}
                            </div>
                        )}
                        {output.error && status !== "storing_failed" && (
                            <p className="text-destructive text-xs">{output.error}</p>
                        )}
                    </div>

                    <div className="border-t bg-muted/10 p-3">
                        {status === "pending_confirmation" ? (
                            <Button
                                type="button"
                                className="h-10 w-full gap-2"
                                disabled={isPlanLoading || (needsPlanUpgrade ? false : !canConfirm)}
                                onClick={() => {
                                    if (needsPlanUpgrade) {
                                        void navigate({ to: "/settings/billing" })
                                        return
                                    }
                                    void handleConfirm()
                                }}
                                aria-describedby={prompt ? promptId : undefined}
                            >
                                {isConfirming || isPlanLoading ? (
                                    <Loader2 className="size-4 animate-spin" aria-hidden="true" />
                                ) : (
                                    <Sparkles className="size-4" aria-hidden="true" />
                                )}
                                {isConfirming
                                    ? "Generating"
                                    : isPlanLoading
                                      ? "Checking plan"
                                      : needsPlanUpgrade
                                        ? "Upgrade to Pro"
                                        : "Generate"}
                            </Button>
                        ) : isWorking ? (
                            <Button type="button" className="h-10 w-full gap-2" disabled>
                                <Loader2 className="size-4 animate-spin" aria-hidden="true" />
                                {isRetryingAsset ? "Refetching" : "Generating"}
                            </Button>
                        ) : isAwaitingVariants ? (
                            <Button type="button" className="h-10 w-full gap-2" disabled>
                                <Loader2 className="size-4 animate-spin" aria-hidden="true" />
                                {assets.length} of {variantCount} ready
                            </Button>
                        ) : status === "storing_failed" ? (
                            <Button
                                type="button"
                                className="h-10 w-full gap-2"
                                variant="secondary"
                                disabled={retryableJobIds.length === 0}
                                onClick={handleRefetch}
                            >
                                <RotateCcw className="size-4" aria-hidden="true" />
                                Refetch
                            </Button>
                        ) : isTerminalError ? (
                            <output className="flex h-10 items-center gap-2 rounded-[var(--radius-md)] bg-destructive/10 px-3 text-destructive text-sm">
                                <AlertCircle className="size-4" aria-hidden="true" />
                                {isComplete ? "Partial" : "Failed"}
                            </output>
                        ) : isComplete ? (
                            <output className="flex h-10 items-center gap-2 rounded-[var(--radius-md)] bg-background/60 px-3 text-muted-foreground text-sm">
                                <Sparkles className="size-4" aria-hidden="true" />
                                Complete
                            </output>
                        ) : null}
                    </div>
                </section>
            )
        }

        if (
            hasResult &&
            typeof toolInvocation.output === "object" &&
            toolInvocation.output !== null &&
            "assets" in toolInvocation.output &&
            Array.isArray(toolInvocation.output.assets)
        ) {
            const output = toolInvocation.output as {
                assets: ImageGenerationAsset[]
                prompt?: string
                modelId?: string
            }
            const assets = output.assets
            const prompt =
                output.prompt ||
                ((toolInvocation.input as { prompt?: string } | undefined)?.prompt ?? "")

            const modelName = output.modelId
                ? sharedModels.find((m) => m.id === output.modelId)?.name
                : output.modelId

            return assets.map((asset, index) => (
                <ImageWithErrorHandler
                    key={index}
                    asset={asset}
                    prompt={prompt}
                    modelName={modelName}
                    cssAspectRatio={cssAspectRatio}
                    image={
                        asset.generatedImageId
                            ? generatedImageById.get(asset.generatedImageId)
                            : undefined
                    }
                />
            ))
        }

        return null
    }
)

ImageGenerationToolRenderer.displayName = "ImageGenerationToolRenderer"

const ImageWithErrorHandler = memo(
    ({
        asset,
        prompt,
        modelName,
        cssAspectRatio,
        image,
        className,
        ariaLabel,
        onNavigatePrevious,
        onNavigateNext,
        canNavigatePrevious,
        canNavigateNext
    }: {
        asset: ImageGenerationAsset
        prompt: string
        modelName?: string
        cssAspectRatio: string
        image?: Doc<"generatedImages">
        className?: string
        ariaLabel?: string
        onNavigatePrevious?: () => void
        onNavigateNext?: () => void
        canNavigatePrevious?: boolean
        canNavigateNext?: boolean
    }) => {
        const [isError, setIsError] = useState(false)
        const [retryNonce, setRetryNonce] = useState(0)
        const [isDetailsOpen, setIsDetailsOpen] = useState(false)
        const revealTimeoutRef = useRef<number | null>(null)
        // Sources this instance has already loaded once, so cycling back to an
        // already-seen variant reveals instantly instead of replaying the load animation.
        const loadedSignaturesRef = useRef<Set<string>>(new Set())
        const storageKey = image?.storageKey ?? asset.storageKey ?? asset.imageUrl
        const optimizedSources =
            image && storageKey
                ? getChatImageCardSources({
                      storageKey,
                      aspectRatio: image.aspectRatio
                  })
                : null
        const imageSrc = optimizedSources?.src ?? resolveImageAssetUrl(storageKey || asset.imageUrl)
        const imageSourceSignature = `${imageSrc}\n${optimizedSources?.srcSet ?? ""}`
        const [loadState, setLoadState] = useState<"loading" | "revealing" | "ready">(() =>
            loadedSignaturesRef.current.has(imageSourceSignature) ? "ready" : "loading"
        )

        useEffect(() => {
            setIsError(false)
            setRetryNonce(0)
            setLoadState(
                loadedSignaturesRef.current.has(imageSourceSignature) ? "ready" : "loading"
            )
        }, [imageSourceSignature])

        useEffect(() => {
            return () => {
                if (revealTimeoutRef.current !== null) {
                    window.clearTimeout(revealTimeoutRef.current)
                }
            }
        }, [])

        if (isError) {
            return (
                <div
                    className={cn(
                        "flex w-full max-w-md items-center justify-center rounded-[var(--radius-xl)] border bg-muted/50",
                        className
                    )}
                    style={{ aspectRatio: cssAspectRatio }}
                    role="alert"
                >
                    <div className="flex flex-col items-center gap-2">
                        <AlertCircle
                            className="mx-auto mb-2 size-8 text-destructive/70"
                            aria-hidden="true"
                        />
                        <p className="text-destructive text-sm">Failed to load image</p>
                        <Button
                            type="button"
                            variant="secondary"
                            size="sm"
                            aria-label="Retry loading generated image"
                            onClick={() => {
                                setIsError(false)
                                setRetryNonce((current) => current + 1)
                            }}
                        >
                            Retry
                        </Button>
                    </div>
                </div>
            )
        }
        return (
            <>
                <button
                    type="button"
                    className={cn(
                        "not-prose relative block w-full max-w-md overflow-hidden rounded-[var(--radius-xl)] border bg-background text-left outline-none transition hover:border-primary/40 focus-visible:ring-2 focus-visible:ring-primary",
                        className
                    )}
                    style={{ aspectRatio: cssAspectRatio }}
                    aria-label={ariaLabel ?? "Open generated image details"}
                    onClick={() => {
                        if (image) setIsDetailsOpen(true)
                    }}
                >
                    {loadState !== "ready" && (
                        <ImageLoadIndicator complete={loadState === "revealing"} />
                    )}
                    <img
                        key={`${imageSourceSignature}:${retryNonce}`}
                        src={imageSrc}
                        srcSet={optimizedSources?.srcSet}
                        sizes={optimizedSources?.sizes}
                        alt={prompt || "Generated image"}
                        className={cn(
                            "h-full w-full object-cover transition-opacity duration-300 ease-out",
                            loadState === "loading" && "opacity-0"
                        )}
                        style={{ aspectRatio: cssAspectRatio }}
                        onLoad={() => {
                            setIsError(false)
                            const alreadyRevealed =
                                loadedSignaturesRef.current.has(imageSourceSignature)
                            loadedSignaturesRef.current.add(imageSourceSignature)
                            if (alreadyRevealed) {
                                setLoadState("ready")
                                return
                            }
                            setLoadState("revealing")
                            if (revealTimeoutRef.current !== null) {
                                window.clearTimeout(revealTimeoutRef.current)
                            }
                            revealTimeoutRef.current = window.setTimeout(() => {
                                setLoadState("ready")
                                revealTimeoutRef.current = null
                            }, 240)
                        }}
                        onError={() => {
                            if (retryNonce < MAX_IMAGE_LOAD_RETRIES) {
                                window.setTimeout(
                                    () => setRetryNonce((current) => current + 1),
                                    500 * (retryNonce + 1)
                                )
                                return
                            }

                            setIsError(true)
                        }}
                    />
                </button>
                {image && (
                    <ImageDetailsModal
                        image={image}
                        isOpen={isDetailsOpen}
                        onClose={() => setIsDetailsOpen(false)}
                        onPrevious={onNavigatePrevious}
                        onNext={onNavigateNext}
                        canNavigatePrevious={canNavigatePrevious}
                        canNavigateNext={canNavigateNext}
                    />
                )}
            </>
        )
    }
)
