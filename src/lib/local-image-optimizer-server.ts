import { createHash } from "node:crypto"
import { access, mkdir, readFile, readdir, unlink, writeFile } from "node:fs/promises"
import path from "node:path"
import {
    LOCAL_IMAGE_OPTIMIZER_PURGE_PATH,
    LOCAL_IMAGE_OPTIMIZER_ROUTE_PREFIX,
    extractLocalImageOptimizerRequestParts,
    getLocalImageOptimizerCacheKeyInput,
    isAllowedLocalImageOptimizerSource,
    parseLocalImageTransformOptions
} from "./local-image-optimizer"

type OutputFormat = "avif" | "webp" | "png" | "jpeg"

type LocalImageOptimizerConfig = {
    cacheDir: string
    convexApiUrl: string
    publicAssetBaseUrl?: string
}

const LONG_LIVED_CACHE_CONTROL = "public, max-age=31536000, immutable"
const LOCAL_AVIF_ENCODER_SIGNATURE = "bun-image-avif-v1"

const formatToContentType = (format: OutputFormat) => {
    switch (format) {
        case "avif":
            return "image/avif"
        case "webp":
            return "image/webp"
        case "png":
            return "image/png"
        case "jpeg":
            return "image/jpeg"
    }
}

const formatToExtension = (format: OutputFormat) => {
    switch (format) {
        case "jpeg":
            return "jpg"
        default:
            return format
    }
}

const buildCacheHash = (value: string) => createHash("sha256").update(value).digest("hex")

const buildCacheFilePath = ({
    cacheDir,
    baseHash,
    format
}: {
    cacheDir: string
    baseHash: string
    format: OutputFormat
}) => path.join(cacheDir, `${baseHash}.${formatToExtension(format)}`)

const readCachedVariant = async ({
    cacheDir,
    baseHash,
    preferredFormat
}: {
    cacheDir: string
    baseHash: string
    preferredFormat: OutputFormat | null
}) => {
    const candidateFormats =
        preferredFormat === "avif"
            ? (["avif", "webp"] as const)
            : preferredFormat
              ? [preferredFormat]
              : (["png", "jpeg"] as const)

    for (const candidateFormat of candidateFormats) {
        const filePath = buildCacheFilePath({
            cacheDir,
            baseHash,
            format: candidateFormat
        })

        try {
            await access(filePath)
            const bytes = await readFile(filePath)
            return {
                bytes,
                format: candidateFormat
            }
        } catch {
            // Try the next candidate.
        }
    }

    return null
}

const getPreferredModernFormat = (acceptHeader: string | null): OutputFormat | null => {
    const normalized = acceptHeader?.toLowerCase() ?? ""

    if (normalized.includes("image/webp")) {
        return "webp"
    }

    if (normalized.includes("image/avif")) {
        return "avif"
    }

    return null
}

const buildCachedResponse = ({
    bytes,
    format,
    cacheStatus
}: {
    bytes: Uint8Array
    format: OutputFormat
    cacheStatus: "HIT" | "MISS"
}) =>
    new Response(Buffer.from(bytes), {
        status: 200,
        headers: {
            "content-type": formatToContentType(format),
            "cache-control": LONG_LIVED_CACHE_CONTROL,
            vary: "Accept",
            "x-silkchat-local-image-optimizer": cacheStatus
        }
    })

const buildErrorResponse = (status: number, message: string) =>
    Response.json({ error: message }, { status })

const pngHasAlpha = (bytes: Uint8Array) =>
    bytes.length > 25 &&
    bytes[0] === 0x89 &&
    bytes[1] === 0x50 &&
    bytes[2] === 0x4e &&
    bytes[3] === 0x47 &&
    (bytes[25] === 4 || bytes[25] === 6)

const getPortableFallbackFormat = (
    sourceFormat: string,
    sourceBytes: Uint8Array
): "png" | "jpeg" => {
    if (sourceFormat === "jpeg") return "jpeg"
    if (sourceFormat === "png" && !pngHasAlpha(sourceBytes)) return "jpeg"
    return "png"
}

const purgeCache = async (cacheDir: string) => {
    let entries: string[]
    try {
        entries = await readdir(cacheDir)
    } catch {
        // No cache directory yet — nothing to purge.
        return 0
    }

    let removed = 0
    await Promise.all(
        entries.map(async (entry) => {
            try {
                await unlink(path.join(cacheDir, entry))
                removed += 1
            } catch {
                // Ignore files that vanished or can't be removed.
            }
        })
    )
    return removed
}

const writeOptimizedImage = async ({
    cacheDir,
    baseHash,
    sourceBytes,
    width,
    quality,
    format
}: {
    cacheDir: string
    baseHash: string
    sourceBytes: Uint8Array
    width: number
    quality: number
    format: OutputFormat
}) => {
    const image = new Bun.Image(sourceBytes)
    const metadata = await image.metadata()
    const transformer = image.resize(Math.min(width, metadata.width))

    let outputFormat = format
    let outputBytes: Uint8Array
    try {
        outputBytes =
            format === "avif"
                ? await transformer.avif({ quality }).bytes()
                : format === "webp"
                  ? await transformer.webp({ quality }).bytes()
                  : format === "png"
                    ? await transformer.png().bytes()
                    : await transformer.jpeg({ quality }).bytes()
    } catch (error) {
        if (
            format !== "avif" ||
            !(error instanceof Error) ||
            !("code" in error) ||
            error.code !== "ERR_IMAGE_FORMAT_UNSUPPORTED"
        ) {
            throw error
        }

        outputFormat = "webp"
        outputBytes = await new Bun.Image(sourceBytes)
            .resize(Math.min(width, metadata.width))
            .webp({ quality })
            .bytes()
    }

    await mkdir(cacheDir, { recursive: true })

    const filePath = buildCacheFilePath({
        cacheDir,
        baseHash,
        format: outputFormat
    })

    await writeFile(filePath, outputBytes)

    return {
        bytes: outputBytes,
        format: outputFormat
    }
}

export const createLocalImageOptimizerHandler = ({
    cacheDir,
    convexApiUrl,
    publicAssetBaseUrl
}: LocalImageOptimizerConfig) => {
    const inflightTransforms = new Map<string, Promise<Response>>()

    return async (request: Request) => {
        const requestUrl = new URL(request.url)

        if (requestUrl.pathname === LOCAL_IMAGE_OPTIMIZER_PURGE_PATH) {
            if (request.method !== "DELETE") {
                return buildErrorResponse(405, "Method not allowed")
            }
            const removed = await purgeCache(cacheDir)
            return Response.json({ ok: true, removed })
        }

        if (!requestUrl.pathname.startsWith(`${LOCAL_IMAGE_OPTIMIZER_ROUTE_PREFIX}/`)) {
            return new Response(null, { status: 404 })
        }

        if (request.method !== "GET") {
            return buildErrorResponse(405, "Method not allowed")
        }

        const requestParts = extractLocalImageOptimizerRequestParts(requestUrl)
        if (!requestParts) {
            return buildErrorResponse(400, "Invalid image optimization request")
        }

        const parsedOptions = parseLocalImageTransformOptions(requestParts.optionsSegment)
        if (!parsedOptions) {
            return buildErrorResponse(400, "Unsupported image transform options")
        }

        if (
            !isAllowedLocalImageOptimizerSource({
                sourceUrl: requestParts.sourceUrl,
                convexApiUrl,
                publicAssetBaseUrl
            })
        ) {
            return buildErrorResponse(403, "Source URL is not allowed")
        }

        const preferredModernFormat = getPreferredModernFormat(request.headers.get("accept"))
        const baseCacheHash = buildCacheHash(
            getLocalImageOptimizerCacheKeyInput({
                sourceUrl: requestParts.sourceUrl,
                width: parsedOptions.width,
                quality: parsedOptions.quality,
                format:
                    preferredModernFormat === "avif"
                        ? LOCAL_AVIF_ENCODER_SIGNATURE
                        : (preferredModernFormat ?? "fallback")
            })
        )

        const cachedVariant = await readCachedVariant({
            cacheDir,
            baseHash: baseCacheHash,
            preferredFormat: preferredModernFormat
        })

        if (cachedVariant) {
            return buildCachedResponse({
                bytes: cachedVariant.bytes,
                format: cachedVariant.format,
                cacheStatus: "HIT"
            })
        }

        const inflightKey = `${baseCacheHash}:${preferredModernFormat ?? "fallback"}`
        const existingTransform = inflightTransforms.get(inflightKey)
        if (existingTransform) {
            return existingTransform
        }

        const transformPromise = (async () => {
            const upstreamResponse = await fetch(requestParts.sourceUrl, {
                headers: {
                    Accept: "image/*"
                }
            })

            if (!upstreamResponse.ok) {
                return buildErrorResponse(502, "Failed to fetch source image")
            }

            const sourceBytes = new Uint8Array(await upstreamResponse.arrayBuffer())
            const metadata = await new Bun.Image(sourceBytes).metadata()
            const outputFormat =
                preferredModernFormat ?? getPortableFallbackFormat(metadata.format, sourceBytes)
            const optimizedImage = await writeOptimizedImage({
                cacheDir,
                baseHash: baseCacheHash,
                sourceBytes,
                width: parsedOptions.width,
                quality: parsedOptions.quality,
                format: outputFormat
            })

            return buildCachedResponse({
                bytes: optimizedImage.bytes,
                format: optimizedImage.format,
                cacheStatus: "MISS"
            })
        })()

        inflightTransforms.set(inflightKey, transformPromise)

        try {
            return await transformPromise
        } catch (error) {
            console.error("[local-image-optimizer] Failed to optimize image", error)
            return buildErrorResponse(500, "Failed to optimize image")
        } finally {
            inflightTransforms.delete(inflightKey)
        }
    }
}
