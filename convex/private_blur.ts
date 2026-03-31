"use node"

import {
    type PrivateBlurFormat,
    getPrivateBlurAuthorId,
    getPrivateBlurStorageKey
} from "@/lib/private-blur-variants"
import { httpAction } from "./_generated/server"
import { r2 } from "./attachments"

let sharpPromise: Promise<typeof import("sharp")> | null = null

const getSharp = () => {
    if (!sharpPromise) {
        const resolved = import.meta.resolve?.("sharp")
        sharpPromise = resolved
            ? (import(resolved) as Promise<typeof import("sharp")>)
            : (Function("return import('sharp')")() as Promise<typeof import("sharp")>)
    }

    return sharpPromise
}

const clampWidth = (value: string | null) => {
    const parsed = Number(value)
    if (!Number.isFinite(parsed)) return null
    return Math.max(64, Math.min(1200, Math.round(parsed)))
}

const isPrivateBlurFormat = (value: string | null): value is PrivateBlurFormat =>
    value === "avif" || value === "webp"

const getContentType = (format: PrivateBlurFormat) =>
    format === "avif" ? "image/avif" : "image/webp"

const getPrivateBlurRedirect = async ({
    ctx,
    key
}: {
    ctx: Parameters<typeof r2.getUrl>[0]
    key: string
}) => {
    const url = await r2.getUrl(key)
    return new Response(null, {
        status: 302,
        headers: {
            Location: url,
            "Cache-Control":
                "public, max-age=31536000, s-maxage=31536000, stale-while-revalidate=604800"
        }
    })
}

export const getPrivateBlur = httpAction(async (ctx, request) => {
    const url = new URL(request.url)
    const key = url.searchParams.get("key")
    const width = clampWidth(url.searchParams.get("w"))
    const format = url.searchParams.get("fmt")

    if (!key || !width || !isPrivateBlurFormat(format)) {
        return Response.json({ error: "Invalid image blur request" }, { status: 400 })
    }

    const blurredKey = getPrivateBlurStorageKey({
        storageKey: key,
        width,
        format
    })

    try {
        const existing = await r2.getMetadata(ctx, blurredKey)
        if (existing) {
            return await getPrivateBlurRedirect({
                ctx,
                key: blurredKey
            })
        }
    } catch {
        // Generate and store on demand below.
    }

    let sourceUrl: string
    try {
        sourceUrl = await r2.getUrl(key)
    } catch {
        return new Response(null, { status: 404 })
    }

    const sourceResponse = await fetch(sourceUrl, {
        headers: {
            Accept: "image/*"
        }
    })

    if (!sourceResponse.ok) {
        return new Response(null, { status: sourceResponse.status })
    }

    const sourceBytes = new Uint8Array(await sourceResponse.arrayBuffer())
    const sharp = await getSharp()

    const transformer = sharp(sourceBytes, { failOn: "none" })
        .rotate()
        .resize({
            width,
            fit: "inside",
            withoutEnlargement: true
        })
        .blur(20)

    const outputBuffer =
        format === "avif"
            ? await transformer.avif({ quality: 42, effort: 6 }).toBuffer()
            : await transformer.webp({ quality: 54 }).toBuffer()

    await r2.store(ctx, new Uint8Array(outputBuffer), {
        authorId: getPrivateBlurAuthorId(key),
        key: blurredKey,
        type: getContentType(format)
    })

    return await getPrivateBlurRedirect({
        ctx,
        key: blurredKey
    })
})
