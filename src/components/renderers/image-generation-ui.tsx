import { ImageDetailsModal } from "@/components/library/image-details-modal"
import { Button } from "@/components/ui/button"
import { ImageSkeleton } from "@/components/ui/image-skeleton"
import { api } from "@/convex/_generated/api"
import type { Doc, Id } from "@/convex/_generated/dataModel"
import { getLibraryImageSources } from "@/lib/generated-image-urls"
import { getPublicR2AssetUrl } from "@/lib/r2-public-url"
import { useSharedModels } from "@/lib/shared-models"
import type { UIToolInvocation } from "ai"
import { useAction, useQuery } from "convex/react"
import {
    AlertCircle,
    ChevronLeft,
    ChevronRight,
    Image as ImageIcon,
    Loader2,
    RotateCcw,
    Sparkles
} from "lucide-react"
import { memo, useEffect, useMemo, useState } from "react"
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

const resolveImageAssetUrl = (value: string) => {
    if (value.startsWith("http://") || value.startsWith("https://") || value.startsWith("data:")) {
        return value
    }

    return getPublicR2AssetUrl(value)
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
        const generatedImageById = useMemo(() => {
            return new Map((generatedImages ?? []).map((image) => [image._id, image]))
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

        useEffect(() => {
            setActiveAssetIndex((current) => {
                if (preparedAssetCount <= 0) return 0
                return Math.min(current, preparedAssetCount - 1)
            })
        }, [preparedAssetCount])

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
                    className="w-full max-w-md overflow-hidden rounded-xl border bg-muted/5"
                    style={{ aspectRatio: cssAspectRatio }}
                >
                    <ImageSkeleton
                        rows={rows}
                        cols={cols}
                        dotSize={3}
                        gap={4}
                        loadingDuration={99999}
                        autoLoop={false}
                        className="h-full w-full rounded-xl border-0 bg-transparent"
                    />
                </div>
            )
        }

        if (hasError) {
            return (
                <div
                    className="flex w-full max-w-md flex-col items-center justify-center rounded-xl border border-destructive/50 bg-destructive/10"
                    style={{ aspectRatio: cssAspectRatio }}
                >
                    <AlertCircle className="mx-auto mb-2 size-8 text-destructive/70" />
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
            const visibleAssetIndex =
                assets.length > 0 ? Math.min(activeAssetIndex, assets.length - 1) : 0
            const visibleAsset = assets[visibleAssetIndex]
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
            const canConfirm =
                status === "pending_confirmation" &&
                output.cardId &&
                threadId &&
                messageId &&
                !isConfirming
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
                    toast.error(
                        error instanceof Error ? error.message : "Failed to start image generation"
                    )
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
                    toast.error(error instanceof Error ? error.message : "Failed to refetch image")
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

            return (
                <div className="not-prose my-3 w-full max-w-md overflow-hidden rounded-xl border bg-muted/20">
                    <div className="border-b bg-background/60 px-4 py-3">
                        <div className="flex items-center gap-2 font-medium text-sm">
                            <ImageIcon className="size-4 shrink-0 text-muted-foreground" />
                            <span className="min-w-0 truncate">
                                {output.title?.trim() || "SilkScreen image"}
                            </span>
                        </div>
                    </div>
                    <div className="space-y-3 p-4">
                        <p className="whitespace-pre-wrap text-sm">{output.prompt}</p>
                        <div className="grid grid-cols-2 gap-2 text-xs">
                            <div className="rounded-md bg-background/70 p-2">
                                <div className="text-muted-foreground">Model</div>
                                <div className="mt-0.5 font-medium">
                                    {output.modelName ?? output.modelId}
                                </div>
                            </div>
                            <div className="rounded-md bg-background/70 p-2">
                                <div className="text-muted-foreground">Aspect ratio</div>
                                <div className="mt-0.5 font-medium">{output.aspectRatio}</div>
                            </div>
                            <div className="rounded-md bg-background/70 p-2">
                                <div className="text-muted-foreground">Variants</div>
                                <div className="mt-0.5 font-medium">{output.variants ?? 1}</div>
                            </div>
                            <div className="rounded-md bg-background/70 p-2">
                                <div className="text-muted-foreground">Resolution</div>
                                <div className="mt-0.5 font-medium">{output.resolution ?? "—"}</div>
                            </div>
                        </div>
                        {(output.references?.length ?? 0) > 0 && (
                            <div className="space-y-1 text-xs">
                                <div className="text-muted-foreground">References</div>
                                {output.references?.map((reference) => (
                                    <div
                                        key={reference.id}
                                        className="rounded-md bg-background/70 px-2 py-1"
                                    >
                                        {reference.label}
                                    </div>
                                ))}
                            </div>
                        )}
                        {visibleAsset ? (
                            <div className="relative">
                                {(() => {
                                    const key = visibleAsset.storageKey ?? visibleAsset.imageUrl
                                    if (!key) return null
                                    return (
                                        <ImageWithErrorHandler
                                            key={visibleAsset.generatedImageId ?? visibleAssetIndex}
                                            asset={{
                                                imageUrl: key,
                                                generatedImageId: visibleAsset.generatedImageId,
                                                storageKey: visibleAsset.storageKey,
                                                variantIndex: visibleAsset.variantIndex
                                            }}
                                            prompt={output.prompt ?? "Generated image"}
                                            modelName={output.modelName}
                                            cssAspectRatio={cssAspectRatio}
                                            image={
                                                visibleAsset.generatedImageId
                                                    ? generatedImageById.get(
                                                          visibleAsset.generatedImageId
                                                      )
                                                    : undefined
                                            }
                                        />
                                    )
                                })()}
                                {variantCount > 1 && (
                                    <>
                                        <Button
                                            type="button"
                                            variant="secondary"
                                            size="icon"
                                            className="-translate-y-1/2 absolute top-1/2 left-2 z-10 size-8 border border-background/40 bg-background/80 text-foreground shadow-lg backdrop-blur-md hover:bg-background"
                                            disabled={visibleAssetIndex <= 0}
                                            onClick={() =>
                                                setActiveAssetIndex((current) =>
                                                    Math.max(0, current - 1)
                                                )
                                            }
                                        >
                                            <ChevronLeft className="size-4" />
                                            <span className="sr-only">Previous variant</span>
                                        </Button>
                                        <Button
                                            type="button"
                                            variant="secondary"
                                            size="icon"
                                            className="-translate-y-1/2 absolute top-1/2 right-2 z-10 size-8 border border-background/40 bg-background/80 text-foreground shadow-lg backdrop-blur-md hover:bg-background"
                                            disabled={visibleAssetIndex >= assets.length - 1}
                                            onClick={() =>
                                                setActiveAssetIndex((current) =>
                                                    Math.min(assets.length - 1, current + 1)
                                                )
                                            }
                                        >
                                            <ChevronRight className="size-4" />
                                            <span className="sr-only">Next variant</span>
                                        </Button>
                                        <div className="absolute right-2 bottom-2 z-10 rounded-md border border-background/40 bg-background/80 px-2 py-1 font-medium text-foreground text-xs shadow-lg backdrop-blur-md">
                                            {visibleAssetIndex + 1} / {variantCount}
                                        </div>
                                    </>
                                )}
                            </div>
                        ) : (
                            <div
                                className="overflow-hidden rounded-lg border bg-background/60"
                                style={{ aspectRatio: cssAspectRatio }}
                            >
                                {isWorking ? (
                                    <ImageSkeleton
                                        rows={rows}
                                        cols={cols}
                                        dotSize={3}
                                        gap={4}
                                        loadingDuration={99999}
                                        autoLoop={false}
                                        className="h-full w-full rounded-lg border-0 bg-transparent"
                                    />
                                ) : status === "storing_failed" ? (
                                    <div className="flex h-full w-full flex-col items-center justify-center gap-3 bg-destructive/10 p-4 text-center">
                                        <AlertCircle className="size-8 text-destructive/80" />
                                        <p className="text-destructive text-sm">
                                            {output.error || "Couldn't store this image."}
                                        </p>
                                    </div>
                                ) : (
                                    <div className="flex h-full w-full items-center justify-center bg-muted/10">
                                        <ImageIcon className="size-7 text-muted-foreground/45" />
                                    </div>
                                )}
                            </div>
                        )}
                        {output.error && status !== "storing_failed" && (
                            <p className="text-destructive text-xs">{output.error}</p>
                        )}
                        <div className="min-h-10">
                            {status === "pending_confirmation" ? (
                                <Button
                                    type="button"
                                    className="h-10 w-full gap-2"
                                    disabled={!canConfirm}
                                    onClick={handleConfirm}
                                >
                                    {isConfirming ? (
                                        <Loader2 className="size-4 animate-spin" />
                                    ) : (
                                        <Sparkles className="size-4" />
                                    )}
                                    {isConfirming ? "Generating" : "Generate"}
                                </Button>
                            ) : isWorking ? (
                                <Button type="button" className="h-10 w-full gap-2" disabled>
                                    <Loader2 className="size-4 animate-spin" />
                                    {isRetryingAsset ? "Refetching" : "Generating"}
                                </Button>
                            ) : isAwaitingVariants ? (
                                <Button type="button" className="h-10 w-full gap-2" disabled>
                                    <Loader2 className="size-4 animate-spin" />
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
                                    <RotateCcw className="size-4" />
                                    Refetch
                                </Button>
                            ) : isTerminalError ? (
                                <div className="flex h-10 items-center gap-2 rounded-md bg-destructive/10 px-3 text-destructive text-sm">
                                    <AlertCircle className="size-4" />
                                    {isComplete ? "Partial" : "Failed"}
                                </div>
                            ) : isComplete ? (
                                <div className="flex h-10 items-center gap-2 rounded-md bg-background/60 px-3 text-muted-foreground text-sm">
                                    <Sparkles className="size-4" />
                                    Complete
                                </div>
                            ) : null}
                        </div>
                    </div>
                </div>
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
        image
    }: {
        asset: ImageGenerationAsset
        prompt: string
        modelName?: string
        cssAspectRatio: string
        image?: Doc<"generatedImages">
    }) => {
        const [isError, setIsError] = useState(false)
        const [retryNonce, setRetryNonce] = useState(0)
        const [isDetailsOpen, setIsDetailsOpen] = useState(false)
        const storageKey = image?.storageKey ?? asset.storageKey ?? asset.imageUrl
        const optimizedSources =
            image && storageKey
                ? getLibraryImageSources({
                      storageKey,
                      aspectRatio: image.aspectRatio
                  })
                : null
        const imageSrc = optimizedSources?.src ?? resolveImageAssetUrl(storageKey || asset.imageUrl)
        const imageSourceSignature = `${imageSrc}\n${optimizedSources?.srcSet ?? ""}`

        useEffect(() => {
            void imageSourceSignature
            setIsError(false)
            setRetryNonce(0)
        }, [imageSourceSignature])

        if (isError) {
            return (
                <div
                    className="flex w-full max-w-md items-center justify-center rounded-xl border bg-muted/50"
                    style={{ aspectRatio: cssAspectRatio }}
                >
                    <div className="flex flex-col items-center gap-2">
                        <AlertCircle className="mx-auto mb-2 size-8 text-destructive/70" />
                        <p className="text-destructive text-sm">Failed to load image</p>
                        <Button
                            type="button"
                            variant="secondary"
                            size="sm"
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
                    className="not-prose relative block w-full max-w-md overflow-hidden rounded-xl border bg-background text-left outline-none transition hover:border-primary/40 focus-visible:ring-2 focus-visible:ring-primary"
                    style={{ aspectRatio: cssAspectRatio }}
                    onClick={() => {
                        if (image) setIsDetailsOpen(true)
                    }}
                >
                    <img
                        key={`${imageSourceSignature}:${retryNonce}`}
                        src={imageSrc}
                        srcSet={optimizedSources?.srcSet}
                        sizes={optimizedSources?.sizes}
                        alt={prompt || "Generated image"}
                        className="h-full w-full object-cover"
                        style={{ aspectRatio: cssAspectRatio }}
                        onLoad={() => {
                            setIsError(false)
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
                    />
                )}
            </>
        )
    }
)
