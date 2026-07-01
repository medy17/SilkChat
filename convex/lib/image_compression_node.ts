"use node"

import { formatFileSizeLimit } from "./file_constants"

export type ImageCompressionStep = {
    quality: number
    maxDimension: number
}

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

export const compressImageBytesToWebpLimit = async ({
    bytes,
    maxBytes,
    steps,
    errorLabel = "image"
}: {
    bytes: Uint8Array
    maxBytes: number
    steps: readonly ImageCompressionStep[]
    errorLabel?: string
}) => {
    const sharpModule = (await getSharp()) as typeof import("sharp") & {
        default?: typeof import("sharp")
    }
    const sharp = sharpModule.default ?? sharpModule
    const metadata = await sharp(bytes, { failOn: "none" }).metadata()
    const width = metadata.width ?? 0
    const height = metadata.height ?? 0
    const largestSide = Math.max(width, height)

    for (const step of steps) {
        const resize =
            largestSide > 0
                ? {
                      width:
                          width > height
                              ? Math.max(1, Math.floor(width * (step.maxDimension / largestSide)))
                              : undefined,
                      height:
                          height >= width
                              ? Math.max(1, Math.floor(height * (step.maxDimension / largestSide)))
                              : undefined,
                      fit: "inside" as const,
                      withoutEnlargement: true
                  }
                : undefined

        const compressed = await sharp(bytes, { failOn: "none" })
            .rotate()
            .resize(resize)
            .webp({ quality: Math.round(step.quality * 100) })
            .toBuffer()

        if (compressed.byteLength <= maxBytes) {
            return new Uint8Array(compressed)
        }
    }

    throw new Error(`Could not compress ${errorLabel} below ${formatFileSizeLimit(maxBytes)}`)
}
