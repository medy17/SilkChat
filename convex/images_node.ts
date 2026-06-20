"use node"

import { buildGeneratedImageSearchText } from "@/lib/generated-image-search"
import { getLibraryPrivateBlurWidths, getPrivateBlurStorageKey } from "@/lib/private-blur-variants"
import { fal } from "@fal-ai/client"
import type { GenericActionCtx } from "convex/server"
import { v } from "convex/values"
import { nanoid } from "nanoid"
import { internal } from "./_generated/api"
import type { DataModel, Id } from "./_generated/dataModel"
import { action } from "./_generated/server"
import { r2 } from "./attachments"
import { resolvePrototypeCreditCharge, resolveRequiredPlanForModelAccess } from "./lib/credits"
import { getUserIdentity } from "./lib/identity"
import { MODELS_SHARED } from "./lib/models"
import type { ImageResolution, ImageSize } from "./lib/models"
import {
    type FalReferenceImage,
    buildFalImageInput,
    getFalEndpointForRequest,
    getFalImageDescriptor,
    isFalImageSizeSupported
} from "./lib/models/fal"

const DEV_FAKE_PALETTES = [
    {
        backgroundStart: "#0f172a",
        backgroundEnd: "#1d4ed8",
        accent: "#38bdf8",
        accentSoft: "#93c5fd",
        text: "#f8fafc"
    },
    {
        backgroundStart: "#1f2937",
        backgroundEnd: "#7c2d12",
        accent: "#fb7185",
        accentSoft: "#fdba74",
        text: "#fff7ed"
    },
    {
        backgroundStart: "#111827",
        backgroundEnd: "#065f46",
        accent: "#34d399",
        accentSoft: "#a7f3d0",
        text: "#ecfdf5"
    },
    {
        backgroundStart: "#172554",
        backgroundEnd: "#581c87",
        accent: "#c084fc",
        accentSoft: "#e9d5ff",
        text: "#faf5ff"
    }
] as const

const clampAspectValue = (value: number) => {
    if (!Number.isFinite(value) || value <= 0) return 1
    return Math.min(24, Math.max(1, Math.round(value)))
}

const parseAspectRatio = (aspectRatio?: string) => {
    const normalized = aspectRatio?.replace("-hd", "") || "1:1"

    if (normalized.includes("x")) {
        const [width, height] = normalized.split("x").map((value) => Number.parseFloat(value))
        return {
            width: clampAspectValue(width),
            height: clampAspectValue(height)
        }
    }

    if (normalized.includes(":")) {
        const [width, height] = normalized.split(":").map((value) => Number.parseFloat(value))
        return {
            width: clampAspectValue(width),
            height: clampAspectValue(height)
        }
    }

    return { width: 1, height: 1 }
}

const escapeSvgText = (value: string) =>
    value
        .replaceAll("&", "&amp;")
        .replaceAll("<", "&lt;")
        .replaceAll(">", "&gt;")
        .replaceAll('"', "&quot;")
        .replaceAll("'", "&apos;")

const wrapSvgText = (value: string, maxLineLength = 38, maxLines = 3) => {
    const words = value.split(/\s+/).filter(Boolean)
    const lines: string[] = []
    let currentLine = ""

    for (const word of words) {
        const nextLine = currentLine ? `${currentLine} ${word}` : word
        if (nextLine.length <= maxLineLength) {
            currentLine = nextLine
            continue
        }

        if (currentLine) {
            lines.push(currentLine)
        }
        currentLine = word

        if (lines.length === maxLines - 1) {
            break
        }
    }

    if (lines.length < maxLines && currentLine) {
        lines.push(currentLine)
    }

    const consumedWords = lines.join(" ").split(/\s+/).filter(Boolean).length
    const hasRemainingWords = consumedWords < words.length

    if (hasRemainingWords && lines.length > 0) {
        lines[lines.length - 1] = `${lines[lines.length - 1]}...`
    }

    return lines
}

const clampFakeResponseTimeSeconds = (value?: number) => {
    if (!Number.isFinite(value)) return 12
    return Math.max(5, Math.min(90, Math.round(value!)))
}

const buildDevFakeSvg = ({
    modelName,
    aspectRatio,
    resolution,
    prompt,
    variantIndex,
    referenceCount,
    responseTimeSeconds
}: {
    modelName: string
    aspectRatio: string
    resolution?: string
    prompt: string
    variantIndex?: number
    referenceCount: number
    responseTimeSeconds: number
}) => {
    const { width, height } = parseAspectRatio(aspectRatio)
    const canvasWidth = width * 160
    const canvasHeight = height * 160
    const palette =
        DEV_FAKE_PALETTES[Math.floor(Math.random() * DEV_FAKE_PALETTES.length)] ||
        DEV_FAKE_PALETTES[0]
    const lines = [
        modelName,
        `${aspectRatio}${resolution ? ` • ${resolution}` : ""}`,
        [
            variantIndex ? `fake generation #${variantIndex}` : "fake generation",
            `${responseTimeSeconds}s response`,
            `${referenceCount} ref${referenceCount === 1 ? "" : "s"}`
        ].join(" • "),
        ...wrapSvgText(prompt)
    ]
    const escapedLines = lines.map((line) => escapeSvgText(line))

    const gridStep = Math.max(28, Math.round(Math.min(canvasWidth, canvasHeight) / 8))
    const circleX = Math.round(canvasWidth * 0.76)
    const circleY = Math.round(canvasHeight * 0.28)
    const circleRadius = Math.round(Math.min(canvasWidth, canvasHeight) * 0.16)
    const frameX = Math.round(canvasWidth * 0.08)
    const frameY = Math.round(canvasHeight * 0.14)
    const frameWidth = Math.round(canvasWidth * 0.68)
    const frameHeight = Math.round(canvasHeight * 0.72)

    return `
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${canvasWidth} ${canvasHeight}" role="img" aria-label="Development fake generated image">
  <defs>
    <linearGradient id="bg" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="${palette.backgroundStart}"/>
      <stop offset="100%" stop-color="${palette.backgroundEnd}"/>
    </linearGradient>
    <linearGradient id="beam" x1="0%" y1="0%" x2="100%" y2="0%">
      <stop offset="0%" stop-color="${palette.accent}" stop-opacity="0"/>
      <stop offset="50%" stop-color="${palette.accent}" stop-opacity="0.95"/>
      <stop offset="100%" stop-color="${palette.accentSoft}" stop-opacity="0"/>
    </linearGradient>
    <pattern id="grid" width="${gridStep}" height="${gridStep}" patternUnits="userSpaceOnUse">
      <path d="M ${gridStep} 0 L 0 0 0 ${gridStep}" fill="none" stroke="${palette.text}" stroke-opacity="0.12" stroke-width="1"/>
    </pattern>
  </defs>
  <rect width="${canvasWidth}" height="${canvasHeight}" fill="url(#bg)"/>
  <rect width="${canvasWidth}" height="${canvasHeight}" fill="url(#grid)"/>
  <circle cx="${circleX}" cy="${circleY}" r="${circleRadius}" fill="${palette.accentSoft}" fill-opacity="0.22"/>
  <rect x="${Math.round(canvasWidth * 0.12)}" y="${Math.round(canvasHeight * 0.18)}" width="${Math.round(canvasWidth * 0.82)}" height="${Math.round(canvasHeight * 0.06)}" rx="${Math.round(canvasHeight * 0.03)}" fill="url(#beam)" opacity="0.75" transform="rotate(-18 ${Math.round(canvasWidth * 0.53)} ${Math.round(canvasHeight * 0.21)})"/>
  <rect x="${frameX}" y="${frameY}" width="${frameWidth}" height="${frameHeight}" rx="${Math.round(Math.min(canvasWidth, canvasHeight) * 0.04)}" fill="#0b1220" fill-opacity="0.18" stroke="${palette.text}" stroke-opacity="0.35" stroke-width="2"/>
  <path d="M ${Math.round(canvasWidth * 0.18)} ${Math.round(canvasHeight * 0.68)} C ${Math.round(canvasWidth * 0.34)} ${Math.round(canvasHeight * 0.32)}, ${Math.round(canvasWidth * 0.46)} ${Math.round(canvasHeight * 0.92)}, ${Math.round(canvasWidth * 0.62)} ${Math.round(canvasHeight * 0.5)} S ${Math.round(canvasWidth * 0.86)} ${Math.round(canvasHeight * 0.38)}, ${Math.round(canvasWidth * 0.92)} ${Math.round(canvasHeight * 0.7)}" fill="none" stroke="${palette.accent}" stroke-width="8" stroke-linecap="round" stroke-opacity="0.9"/>
  <g fill="${palette.text}">
    <text x="${Math.round(canvasWidth * 0.12)}" y="${Math.round(canvasHeight * 0.2)}" font-size="${Math.max(20, Math.round(canvasHeight * 0.055))}" font-family="ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, Liberation Mono, monospace" font-weight="700">${escapedLines[0]}</text>
    <text x="${Math.round(canvasWidth * 0.12)}" y="${Math.round(canvasHeight * 0.28)}" font-size="${Math.max(14, Math.round(canvasHeight * 0.03))}" font-family="ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, Liberation Mono, monospace" opacity="0.88">${escapedLines[1]}</text>
    <text x="${Math.round(canvasWidth * 0.12)}" y="${Math.round(canvasHeight * 0.34)}" font-size="${Math.max(13, Math.round(canvasHeight * 0.028))}" font-family="ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, Liberation Mono, monospace" opacity="0.78">${escapedLines[2]}</text>
    <text x="${Math.round(canvasWidth * 0.12)}" y="${Math.round(canvasHeight * 0.5)}" font-size="${Math.max(14, Math.round(canvasHeight * 0.028))}" font-family="ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, Liberation Mono, monospace" opacity="0.92">${escapedLines[3] || ""}</text>
    <text x="${Math.round(canvasWidth * 0.12)}" y="${Math.round(canvasHeight * 0.56)}" font-size="${Math.max(14, Math.round(canvasHeight * 0.028))}" font-family="ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, Liberation Mono, monospace" opacity="0.92">${escapedLines[4] || ""}</text>
    <text x="${Math.round(canvasWidth * 0.12)}" y="${Math.round(canvasHeight * 0.62)}" font-size="${Math.max(14, Math.round(canvasHeight * 0.028))}" font-family="ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, Liberation Mono, monospace" opacity="0.92">${escapedLines[5] || ""}</text>
  </g>
</svg>`.trim()
}

const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))

const enforceImageGenerationPlan = ({
    userCreditPlan,
    availableToPickFor
}: {
    userCreditPlan: "free" | "pro"
    availableToPickFor?: "free" | "pro"
}) => {
    const requiredPlan = resolveRequiredPlanForModelAccess({
        reasoningEffort: "off",
        availableToPickFor
    })

    if (requiredPlan === "pro" && userCreditPlan !== "pro") {
        throw new Error("Pro plan required for image generation.")
    }
}

const getFalWebhookUrl = () => {
    const siteUrl =
        process.env.CONVEX_SITE_URL ??
        process.env.VITE_CONVEX_SITE_URL ??
        process.env.VITE_CONVEX_API_URL

    if (!siteUrl) {
        throw new Error("CONVEX_SITE_URL is required for fal image webhooks.")
    }

    return `${siteUrl.replace(/\/+$/, "")}/webhooks/fal`
}

const getFalKey = () => {
    const key = process.env.FAL_KEY?.trim() || process.env.FAL_API_KEY?.trim()
    if (!key) {
        throw new Error("FAL_KEY is required for image generation.")
    }
    return key
}

const resolveReferenceImages = async (
    ctx: GenericActionCtx<DataModel>,
    userId: string,
    keys: string[] = []
): Promise<FalReferenceImage[]> => {
    const references: FalReferenceImage[] = []

    for (const key of keys) {
        if (!key.startsWith(`references/${userId}/`)) {
            throw new Error("Invalid reference image.")
        }

        const metadata = await r2.getMetadata(ctx, key)
        if (!metadata) {
            throw new Error("Reference image not found.")
        }

        const authorId =
            typeof metadata === "object" && metadata !== null && "authorId" in metadata
                ? metadata.authorId
                : undefined
        if (authorId && authorId !== userId) {
            throw new Error("Invalid reference image.")
        }

        const url = await r2.getUrl(key)
        references.push({ key, url })
    }

    return references
}

export const generateStandaloneImage = action({
    args: {
        prompt: v.string(),
        modelId: v.string(),
        aspectRatio: v.optional(v.string()),
        resolution: v.optional(v.string()),
        referenceImageIds: v.optional(v.array(v.string()))
    },
    handler: async (ctx, args) => {
        const user = await getUserIdentity(ctx.auth, { allowAnons: false })
        if ("error" in user) throw new Error("unauthorized:chat")

        const sharedModel = MODELS_SHARED.find(
            (model) => model.id === args.modelId && model.mode === "image"
        )
        if (!sharedModel) {
            throw new Error("Image model not found.")
        }

        const falDescriptor = getFalImageDescriptor(args.modelId)
        if (!falDescriptor) {
            throw new Error("Image model is not available on fal.")
        }

        const selectedAspectRatio = (args.aspectRatio ||
            sharedModel.supportedImageSizes?.[0] ||
            "1:1") as ImageSize
        if (
            sharedModel.supportedImageSizes?.length &&
            !sharedModel.supportedImageSizes.includes(selectedAspectRatio) &&
            !isFalImageSizeSupported(falDescriptor, selectedAspectRatio)
        ) {
            throw new Error("Selected aspect ratio is not supported by this model.")
        }

        const selectedResolution = args.resolution as ImageResolution | undefined
        if (
            selectedResolution &&
            sharedModel.supportedImageResolutions?.length &&
            !sharedModel.supportedImageResolutions.includes(selectedResolution)
        ) {
            throw new Error("Selected resolution is not supported by this model.")
        }

        if ((args.referenceImageIds?.length ?? 0) > 0 && !sharedModel.supportsReferenceImages) {
            throw new Error("Reference images are not supported by this model.")
        }
        if (
            typeof sharedModel.maxReferenceImages === "number" &&
            (args.referenceImageIds?.length ?? 0) > sharedModel.maxReferenceImages
        ) {
            throw new Error(
                `This model supports up to ${sharedModel.maxReferenceImages} reference images.`
            )
        }
        if ((args.referenceImageIds?.length ?? 0) > 0 && !falDescriptor.supportsReferences) {
            throw new Error("Reference images are not supported by this fal model.")
        }

        const requiredPlan = resolveRequiredPlanForModelAccess({
            reasoningEffort: "off",
            availableToPickFor: sharedModel.availableToPickFor
        })
        const creditCharge = resolvePrototypeCreditCharge({
            providerSource: "internal",
            modelMode: "image",
            enabledTools: [],
            reasoningEffort: "off",
            prototypeCreditTier: sharedModel.prototypeCreditTier,
            prototypeCreditTierWithReasoning: sharedModel.prototypeCreditTierWithReasoning
        })
        const creditEventKey = `standalone-image:${nanoid()}`
        const creditReservation = await ctx.runMutation(internal.credits.reserveCreditForMessage, {
            userId: user.id,
            messageId: creditEventKey,
            messageKey: creditEventKey,
            modelId: args.modelId,
            providerSource: "internal",
            feature: creditCharge.feature,
            bucket: creditCharge.bucket,
            units: creditCharge.units,
            counted: creditCharge.counted,
            requiredPlan
        })

        if (!creditReservation.allowed) {
            if (creditReservation.reason === "plan") {
                throw new Error("Pro plan required for image generation.")
            }

            throw new Error("Monthly plan limit reached for image generation.")
        }

        try {
            fal.config({ credentials: getFalKey() })
            const referenceImages = await resolveReferenceImages(
                ctx,
                user.id,
                args.referenceImageIds
            )
            const falEndpoint = getFalEndpointForRequest(falDescriptor, referenceImages.length)
            const input = buildFalImageInput(falDescriptor, {
                prompt: args.prompt,
                imageSize: selectedAspectRatio,
                imageResolution: selectedResolution,
                referenceImages,
                maxAssets: 1
            })
            const submitFalQueue = fal.queue.submit as (
                endpointId: string,
                options: { input: Record<string, unknown>; webhookUrl: string }
            ) => Promise<{ request_id?: string; gateway_request_id?: string }>
            const submission = await submitFalQueue(falEndpoint, {
                input,
                webhookUrl: getFalWebhookUrl()
            })
            const falRequestId = submission.request_id
            if (!falRequestId) {
                throw new Error("fal did not return a request id.")
            }

            const jobId: Id<"imageGenerationJobs"> = await ctx.runMutation(
                internal.image_generation_jobs.createImageGenerationJob,
                {
                    userId: user.id,
                    appModelId: args.modelId,
                    falEndpoint,
                    falRequestId,
                    falGatewayRequestId: submission.gateway_request_id,
                    prompt: args.prompt,
                    aspectRatio: selectedAspectRatio,
                    resolution: selectedResolution,
                    referenceImageKeys: args.referenceImageIds ?? [],
                    creditEventKey
                }
            )

            return [jobId]
        } catch (error) {
            await ctx.runMutation(internal.credits.releaseReservedCreditForMessage, {
                userId: user.id,
                messageKey: creditEventKey
            })
            throw error
        }
    }
})

export const generateFakeStandaloneImage = action({
    args: {
        prompt: v.string(),
        modelId: v.string(),
        aspectRatio: v.optional(v.string()),
        resolution: v.optional(v.string()),
        variantIndex: v.optional(v.number()),
        referenceImageIds: v.optional(v.array(v.string())),
        responseTimeSeconds: v.optional(v.number())
    },
    handler: async (ctx, args): Promise<Id<"generatedImages">[]> => {
        const user = await getUserIdentity(ctx.auth, { allowAnons: false })
        if ("error" in user) throw new Error("unauthorized:chat")

        const modelName =
            MODELS_SHARED.find((model) => model.id === args.modelId)?.name ?? args.modelId
        const sharedModel = MODELS_SHARED.find((model) => model.id === args.modelId)
        enforceImageGenerationPlan({
            userCreditPlan: await ctx.runQuery(internal.credits.getUserCreditPlanInternal, {
                userId: user.id
            }),
            availableToPickFor: sharedModel?.availableToPickFor
        })
        const aspectRatio = args.aspectRatio || "1:1"
        const responseTimeSeconds = clampFakeResponseTimeSeconds(args.responseTimeSeconds)
        const prompt = args.prompt.trim()
        const referenceCount = args.referenceImageIds?.length ?? 0

        await wait(responseTimeSeconds * 1000)

        const svg = buildDevFakeSvg({
            modelName,
            aspectRatio,
            resolution: args.resolution,
            prompt,
            variantIndex: args.variantIndex,
            referenceCount,
            responseTimeSeconds
        })
        const storageKey = await r2.store(ctx, new TextEncoder().encode(svg), {
            authorId: user.id,
            key: `generations/${user.id}/${Date.now()}-${crypto.randomUUID()}-dev-fake-generation.svg`,
            type: "image/svg+xml"
        })

        const insertedId: Id<"generatedImages"> = await ctx.runMutation(
            internal.images.insertGeneratedImage,
            {
                userId: user.id,
                storageKey,
                prompt,
                modelId: args.modelId,
                aspectRatio,
                resolution: args.resolution,
                referenceImageKeys: args.referenceImageIds
            }
        )

        return [insertedId]
    }
})

export const deleteGeneratedImage = action({
    args: { id: v.id("generatedImages") },
    handler: async (ctx, args) => {
        const user = await getUserIdentity(ctx.auth, { allowAnons: false })
        if ("error" in user) throw new Error("unauthorized:chat")

        // Need internal query to get image to check ownership and storageKey
        const image = await ctx.runQuery(internal.images.getGeneratedImageInternal, { id: args.id })
        if (!image) throw new Error("Image not found")
        if (image.userId !== user.id) throw new Error("Unauthorized to delete this image")

        // Import r2 dynamically or statically
        const { r2 } = await import("./attachments")

        try {
            await r2.deleteObject(ctx, image.storageKey)
        } catch (error) {
            console.error("Failed to delete from R2:", error)
            throw new Error("Failed to delete image file from storage")
        }

        const blurredWidths = getLibraryPrivateBlurWidths(image.aspectRatio)
        for (const width of blurredWidths) {
            for (const format of ["avif", "webp"] as const) {
                const blurredKey = getPrivateBlurStorageKey({
                    storageKey: image.storageKey,
                    width,
                    format
                })

                try {
                    await r2.deleteObject(ctx, blurredKey)
                } catch {
                    // Ignore missing derivatives during cleanup.
                }
            }
        }

        await ctx.runMutation(internal.images.removeGeneratedImageInternal, { id: args.id })
    }
})

export const migrateUserImages = action({
    args: {},
    handler: async (ctx) => {
        const user = await getUserIdentity(ctx.auth, { allowAnons: false })
        if ("error" in user) return

        const { r2 } = await import("./attachments")
        const keyPrefix = `generations/${user.id}/`
        const pageSize = 200
        let cursor: string | null = null
        const files: { key: string; lastModified: string | number }[] = []
        const seenCursors = new Set<string>()

        while (true) {
            const result: {
                page: { key: string; lastModified: string | number }[]
                isDone: boolean
                continueCursor: string
            } = await r2.listMetadata(ctx, user.id, pageSize, cursor, keyPrefix)
            files.push(...result.page)

            if (result.isDone) break

            if (seenCursors.has(result.continueCursor)) break
            seenCursors.add(result.continueCursor)
            cursor = result.continueCursor
        }

        // Get existing entries from DB
        const existingImages = await ctx.runQuery(internal.images.listGeneratedImagesInternal, {
            userId: user.id
        })
        const existingKeys = new Set(
            existingImages.map((img: { storageKey: string }) => img.storageKey)
        )

        const newFiles = files.filter((f) => !existingKeys.has(f.key))

        for (const file of newFiles) {
            await ctx.runMutation(internal.images.insertGeneratedImage, {
                userId: user.id,
                storageKey: file.key,
                createdAt: new Date(file.lastModified).getTime()
            })
        }

        for (const image of existingImages) {
            const searchText = buildGeneratedImageSearchText({
                prompt: image.prompt,
                modelId: image.modelId,
                aspectRatio: image.aspectRatio,
                resolution: image.resolution
            })

            if (image.searchText === searchText) {
                continue
            }

            await ctx.runMutation(internal.images.updateGeneratedImageSearchTextInternal, {
                id: image._id,
                searchText
            })
        }

        await ctx.runMutation(internal.images.rebuildGeneratedImageFacetsInternal, {
            userId: user.id
        })
    }
})
