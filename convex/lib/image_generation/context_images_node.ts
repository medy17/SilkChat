"use node"

import type { GenericActionCtx } from "convex/server"
import type { DataModel } from "../../_generated/dataModel"
import { r2 } from "../../attachments"
import {
    DEFAULT_UPLOAD_POLICY_VERSION,
    MAX_COMPRESSIBLE_IMAGE_SIZE,
    formatFileSizeLimit
} from "../file_constants"
import { compressImageBytesToWebpLimit } from "../image_compression_node"
import { assertOwnedImageKey, getMetadataString } from "./shared"

export const MAX_MODEL_CONTEXT_IMAGE_SIZE = 1 * 1024 * 1024

const MODEL_CONTEXT_IMAGE_COMPRESSION_STEPS = [
    { quality: 0.78, maxDimension: 1536 },
    { quality: 0.68, maxDimension: 1280 },
    { quality: 0.58, maxDimension: 1024 }
] as const

const trimTrailingSlash = (value: string) => value.replace(/\/+$/, "")
const trimLeadingSlash = (value: string) => value.replace(/^\/+/, "")

const encodeKeyPath = (key: string) =>
    trimLeadingSlash(key)
        .split("/")
        .map((segment) => encodeURIComponent(segment))
        .join("/")

const buildDirectPublicAssetUrl = (key: string, publicAssetBaseUrl?: string) => {
    if (!publicAssetBaseUrl) {
        throw new Error(
            `R2_PUBLIC_BASE_URL is required to resolve model-facing generated image URLs for ${key}`
        )
    }

    return `${trimTrailingSlash(publicAssetBaseUrl)}/${encodeKeyPath(key)}`
}

const getSourceKeyHash = async (sourceKey: string) => {
    const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(sourceKey))
    return Array.from(new Uint8Array(digest))
        .map((byte) => byte.toString(16).padStart(2, "0"))
        .join("")
        .slice(0, 32)
}

const fetchStoredImageBytes = async (key: string) => {
    const url = await r2.getUrl(key)
    const response = await fetch(url, {
        headers: {
            Accept: "image/*",
            "Accept-Encoding": "identity"
        }
    })

    if (!response.ok) {
        throw new Error(`Failed to load generated image context (${response.status})`)
    }

    return new Uint8Array(await response.arrayBuffer())
}

const getOrCreateGeneratedImageContextDerivative = async (
    ctx: GenericActionCtx<DataModel>,
    {
        userId,
        sourceKey
    }: {
        userId: string
        sourceKey: string
    }
) => {
    const sourceHash = await getSourceKeyHash(sourceKey)
    const derivativeKey = `references/${userId}/generated-context/${sourceHash}-${DEFAULT_UPLOAD_POLICY_VERSION}.webp`

    try {
        const existing = await r2.getMetadata(ctx, derivativeKey)
        if (existing && getMetadataString(existing, "authorId") === userId) {
            return derivativeKey
        }
    } catch {
        // Missing derivative: create it below.
    }

    const bytes = await fetchStoredImageBytes(sourceKey)
    if (bytes.byteLength > MAX_COMPRESSIBLE_IMAGE_SIZE) {
        throw new Error(
            `Generated image context exceeds ${formatFileSizeLimit(MAX_COMPRESSIBLE_IMAGE_SIZE)} limit`
        )
    }

    const compressed = await compressImageBytesToWebpLimit({
        bytes,
        maxBytes: MAX_MODEL_CONTEXT_IMAGE_SIZE,
        steps: MODEL_CONTEXT_IMAGE_COMPRESSION_STEPS,
        errorLabel: "generated image context"
    })

    return await r2.store(ctx, compressed, {
        authorId: userId,
        key: derivativeKey,
        type: "image/webp",
        cacheControl: "public, max-age=604800, s-maxage=2592000, stale-while-revalidate=604800"
    })
}

export const resolveGeneratedImageContextUrl = async (
    ctx: GenericActionCtx<DataModel>,
    {
        userId,
        storageKey,
        publicAssetBaseUrl
    }: {
        userId: string
        storageKey: string
        publicAssetBaseUrl?: string
    }
) => {
    const metadata = await assertOwnedImageKey(ctx, userId, storageKey)
    let key = storageKey

    if (typeof metadata.size !== "number" || metadata.size > MAX_MODEL_CONTEXT_IMAGE_SIZE) {
        key = await getOrCreateGeneratedImageContextDerivative(ctx, {
            userId,
            sourceKey: storageKey
        })
    }

    return {
        url: buildDirectPublicAssetUrl(key, publicAssetBaseUrl),
        mediaType: key.endsWith(".webp") ? "image/webp" : metadata.mimeType || "image/png"
    }
}
