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
import type { FalReferenceImage } from "../models/fal"
import { type ImageReferenceSource, assertOwnedImageKey, getMetadataString } from "./shared"

export const MAX_MODEL_REFERENCE_IMAGE_SIZE = 4 * 1024 * 1024

const MODEL_REFERENCE_COMPRESSION_STEPS = [
    { quality: 0.82, maxDimension: 2048 },
    { quality: 0.72, maxDimension: 1536 },
    { quality: 0.62, maxDimension: 1280 }
] as const

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
        throw new Error(`Failed to load reference image (${response.status})`)
    }

    return new Uint8Array(await response.arrayBuffer())
}

const getOrCreateGeneratedReferenceDerivative = async (
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
    const derivativeKey = `references/${userId}/generated/${sourceHash}-${DEFAULT_UPLOAD_POLICY_VERSION}.webp`

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
            `Reference image exceeds ${formatFileSizeLimit(MAX_COMPRESSIBLE_IMAGE_SIZE)} limit`
        )
    }

    const compressed = await compressImageBytesToWebpLimit({
        bytes,
        maxBytes: MAX_MODEL_REFERENCE_IMAGE_SIZE,
        steps: MODEL_REFERENCE_COMPRESSION_STEPS,
        errorLabel: "reference image"
    })

    return await r2.store(ctx, compressed, {
        authorId: userId,
        key: derivativeKey,
        type: "image/webp",
        cacheControl: "public, max-age=604800, s-maxage=2592000, stale-while-revalidate=604800"
    })
}

export const resolveFalReferenceImagesForProvider = async (
    ctx: GenericActionCtx<DataModel>,
    userId: string,
    references: ImageReferenceSource[] = []
): Promise<FalReferenceImage[]> => {
    const resolved: FalReferenceImage[] = []

    for (const reference of references) {
        const metadata = await assertOwnedImageKey(ctx, userId, reference.key)
        const size = metadata.size
        let key = reference.key

        if (
            reference.source === "generation" &&
            (typeof size !== "number" || size > MAX_MODEL_REFERENCE_IMAGE_SIZE)
        ) {
            key = await getOrCreateGeneratedReferenceDerivative(ctx, {
                userId,
                sourceKey: reference.key
            })
        }

        resolved.push({
            key,
            url: await r2.getUrl(key)
        })
    }

    return resolved
}
