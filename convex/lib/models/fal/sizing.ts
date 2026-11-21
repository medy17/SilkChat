import { type ImageSizeSpec, formatImageSize, parseImageSizeInput } from "@/lib/image-aspect-ratios"
import type { ImageResolution } from "../types"

// The only code that reads a descriptor's `sizing`. Everything else (fal input, cost,
// validation, the sidebar) works from what `resolveImageSize` returns.

type ImagePixelSize = `${number}x${number}`
type ImageSizePresets = Record<ImageResolution, Readonly<Record<string, ImagePixelSize>>>

/** fal's limits for an endpoint that takes any concrete `{ width, height }`. */
export type CustomImageSizeLimits = {
    multiple: number
    maxEdge: number
    minPixels: number
    maxPixels: number
    /** Long side over short side. */
    maxRatio: number
}

export type FalImageSizing =
    | {
          input: "pixels"
          /**
           * Ratio → output pixels per resolution; also the ratios the backend accepts. The model's
           * `supportedImageSizes` only controls what the picker and chat tool offer.
           */
          presets: ImageSizePresets
          /** Set only on endpoints priced by output dimensions, so any size costs what it should. */
          custom?: CustomImageSizeLimits
          /** "auto" lets the edit endpoint size the output from the references. */
          edit: "explicit" | "auto"
          /** Legacy GPT Image endpoints take `"WxH"` enums instead of `{ width, height }`. */
          format?: "string"
      }
    | {
          /** The endpoint takes `aspect_ratio` from the model's `supportedImageSizes`. */
          input: "aspectRatio"
          resolutionParam?: "uppercase" | "lowercase"
      }

export type ResolvedImageSize = {
    /** What to store and display; resolving it again gives the same result. */
    canonical: string
    resolution?: ImageResolution
    /** The endpoint's size fields, ready to merge into the fal input. */
    falInput: Record<string, unknown>
} & (
    | { kind: "pixels"; width: number; height: number }
    | { kind: "aspectRatio"; aspectRatio: string }
    | { kind: "auto" }
)

export type ImageSizeResolution =
    | { ok: true; size: ResolvedImageSize }
    | { ok: false; reason: string; nearest?: string }

const sameForEveryResolution = (table: Record<string, ImagePixelSize>): ImageSizePresets => ({
    "1K": table,
    "2K": table,
    "4K": table
})

export const STANDARD_IMAGE_SIZE_PRESETS: ImageSizePresets = {
    "1K": {
        "1:1": "1024x1024",
        "16:9": "1280x720",
        "9:16": "720x1280",
        "4:3": "1024x768",
        "3:4": "768x1024",
        "3:2": "1152x768",
        "2:3": "768x1152",
        "5:4": "1280x1024",
        "4:5": "1024x1280",
        "21:9": "1568x672"
    },
    "2K": {
        "1:1": "2048x2048",
        "16:9": "2048x1152",
        "9:16": "1152x2048",
        "4:3": "2048x1536",
        "3:4": "1536x2048",
        "3:2": "2048x1360",
        "2:3": "1360x2048",
        "5:4": "2048x1648",
        "4:5": "1648x2048",
        "21:9": "2240x960"
    },
    "4K": {
        "1:1": "2880x2880",
        "16:9": "3840x2160",
        "9:16": "2160x3840",
        "4:3": "3264x2448",
        "3:4": "2448x3264",
        "3:2": "3456x2304",
        "2:3": "2304x3456",
        "5:4": "3200x2560",
        "4:5": "2560x3200",
        "21:9": "3808x1632"
    }
}

export const SEEDREAM_IMAGE_SIZE_PRESETS: ImageSizePresets = {
    "1K": {
        "1:1": "2048x2048",
        "16:9": "2560x1440",
        "9:16": "1440x2560",
        "4:3": "2304x1728",
        "3:4": "1728x2304",
        "3:2": "2400x1600",
        "2:3": "1600x2400",
        "5:4": "2400x1920",
        "4:5": "1920x2400",
        "21:9": "3024x1296"
    },
    "2K": {
        "1:1": "2560x2560",
        "16:9": "3072x1728",
        "9:16": "1728x3072",
        "4:3": "2816x2112",
        "3:4": "2112x2816",
        "3:2": "3072x2048",
        "2:3": "2048x3072",
        "5:4": "3200x2560",
        "4:5": "2560x3200",
        "21:9": "3360x1440"
    },
    "4K": {
        "1:1": "4096x4096",
        "16:9": "4096x2304",
        "9:16": "2304x4096",
        "4:3": "4096x3072",
        "3:4": "3072x4096",
        "3:2": "4096x2730",
        "2:3": "2730x4096",
        "5:4": "4096x3277",
        "4:5": "3277x4096",
        "21:9": "4032x1728"
    }
}

// GPT Image 1 and 1 Mini only make three sizes; the wider ratios round to the nearest.
export const LEGACY_OPENAI_IMAGE_SIZE_PRESETS = sameForEveryResolution({
    "1:1": "1024x1024",
    "16:9": "1536x1024",
    "3:2": "1536x1024",
    "4:3": "1536x1024",
    "9:16": "1024x1536",
    "2:3": "1024x1536",
    "3:4": "1024x1536"
})

const RESOLUTIONS: ImageResolution[] = ["1K", "2K", "4K"]

/** Resolutions arrive as strings from storage and requests; anything unknown means none. */
export const parseImageResolution = (value: string | undefined): ImageResolution | undefined =>
    RESOLUTIONS.find((resolution) => resolution === value)

const ratioOf = ({ width, height }: { width: number; height: number }) => width / height

const sameRatio = (a: { width: number; height: number }, b: { width: number; height: number }) =>
    Math.abs(ratioOf(a) / ratioOf(b) - 1) < 1e-9

const toPixels = (size: ImagePixelSize) => {
    const [width, height] = size.split("x").map(Number)
    return { width, height }
}

// A free ratio aims for the pixel count of that resolution's square.
const pixelBudget = (resolution: ImageResolution, limits: CustomImageSizeLimits) =>
    Math.min(
        { "1K": 1024 ** 2, "2K": 2048 ** 2, "4K": limits.maxPixels }[resolution],
        limits.maxPixels
    )

// The smallest resolution whose budget covers the image, so stored labels match the output.
const resolutionForPixels = (pixels: number, limits: CustomImageSizeLimits) =>
    RESOLUTIONS.find((resolution) => pixels <= pixelBudget(resolution, limits)) ?? "4K"

const customSizeProblem = (width: number, height: number, limits: CustomImageSizeLimits) => {
    const { multiple, maxEdge, minPixels, maxPixels, maxRatio } = limits
    if (Math.max(width, height) / Math.min(width, height) > maxRatio) {
        return `The aspect ratio can be at most ${maxRatio}:1.`
    }
    if (width % multiple !== 0 || height % multiple !== 0) {
        return `Width and height must be multiples of ${multiple}.`
    }
    if (Math.max(width, height) > maxEdge) {
        return `The longest side can be at most ${maxEdge}px.`
    }
    const pixels = width * height
    if (pixels < minPixels || pixels > maxPixels) {
        const megapixels = (value: number) => (value / 1_000_000).toFixed(2)
        return `It must be between ${megapixels(minPixels)} and ${megapixels(maxPixels)} megapixels.`
    }
    return null
}

// The legal size with the truest ratio near `target` pixels, never above `ceiling`. Rounding
// both sides to the multiple drifts the ratio, so a few neighbouring sizes are tried, starting
// above the target so one at the pixel floor can round up into the legal range.
const fitRatio = (
    shape: { width: number; height: number },
    target: number,
    ceiling: number,
    limits: CustomImageSizeLimits
) => {
    const long = Math.max(shape.width, shape.height)
    const short = Math.min(shape.width, shape.height)
    const ratio = long / short
    if (ratio > limits.maxRatio) return null

    const { multiple } = limits
    const idealShort = Math.min(Math.sqrt(target / ratio), limits.maxEdge / ratio)
    let best: { long: number; short: number; error: number; distance: number } | null = null
    for (let step = 0; step < 6; step++) {
        // Two sizes up: the long side can round down, and one size up may still miss the floor.
        const candidateShort = (Math.ceil(idealShort / multiple) + 1 - step) * multiple
        if (candidateShort <= 0) break
        const candidateLong = Math.round((candidateShort * ratio) / multiple) * multiple
        const pixels = candidateShort * candidateLong
        if (pixels > ceiling || customSizeProblem(candidateLong, candidateShort, limits)) continue
        const error = Math.abs(candidateLong / candidateShort / ratio - 1)
        const distance = Math.abs(pixels - target)
        const isTruer = best ? error < best.error - 1e-12 : true
        const isTie = best ? Math.abs(error - best.error) <= 1e-12 : false
        if (isTruer || (isTie && best && distance < best.distance)) {
            best = { long: candidateLong, short: candidateShort, error, distance }
        }
    }
    if (!best) return null

    return shape.width >= shape.height
        ? { width: best.long, height: best.short }
        : { width: best.short, height: best.long }
}

const toFalResolution = (
    resolution: ImageResolution | undefined,
    param: Extract<FalImageSizing, { input: "aspectRatio" }>["resolutionParam"]
) => {
    if (param === "uppercase") return resolution ?? "1K"
    if (param === "lowercase" && (resolution === "1K" || resolution === "2K")) {
        return resolution.toLowerCase()
    }
    return undefined
}

const resolvePixelSizing = (
    sizing: Extract<FalImageSizing, { input: "pixels" }>,
    spec: ImageSizeSpec,
    resolution: ImageResolution | undefined
): ImageSizeResolution => {
    const presets = sizing.presets[resolution ?? "1K"]
    const { custom } = sizing
    const pixelsResult = (
        width: number,
        height: number,
        canonical: string,
        outputResolution: ImageResolution | undefined
    ): ImageSizeResolution => ({
        ok: true,
        size: {
            kind: "pixels",
            width,
            height,
            canonical,
            resolution: outputResolution,
            falInput: {
                image_size: sizing.format === "string" ? `${width}x${height}` : { width, height }
            }
        }
    })

    if (spec.kind === "ratio") {
        for (const [ratio, size] of Object.entries(presets)) {
            const preset = parseImageSizeInput(ratio)
            if (preset && sameRatio(preset, spec)) {
                const { width, height } = toPixels(size)
                return pixelsResult(width, height, ratio, resolution)
            }
        }
        if (!custom) {
            return {
                ok: false,
                reason: `Supported ratios: ${Object.keys(presets).join(", ")}.`
            }
        }
        const budget = pixelBudget(resolution ?? "1K", custom)
        const fitted = fitRatio(spec, budget, budget, custom)
        if (!fitted) {
            return { ok: false, reason: `The aspect ratio can be at most ${custom.maxRatio}:1.` }
        }
        return pixelsResult(
            fitted.width,
            fitted.height,
            `${fitted.width}x${fitted.height}`,
            resolutionForPixels(fitted.width * fitted.height, custom)
        )
    }

    const canonical = formatImageSize(spec)
    if (!custom) {
        const isPreset = Object.values(presets).some((size) => size === canonical)
        return isPreset
            ? pixelsResult(spec.width, spec.height, canonical, resolution)
            : { ok: false, reason: "Only preset sizes are supported. Use an aspect ratio." }
    }
    const problem = customSizeProblem(spec.width, spec.height, custom)
    if (!problem) {
        // A typed preset keeps its preset's label; 1568x672 is a 1K size despite its area.
        const presetResolution = RESOLUTIONS.find((tier) =>
            Object.values(sizing.presets[tier]).includes(canonical as ImagePixelSize)
        )
        return pixelsResult(
            spec.width,
            spec.height,
            canonical,
            presetResolution ?? resolutionForPixels(spec.width * spec.height, custom)
        )
    }
    const target = Math.min(Math.max(spec.width * spec.height, custom.minPixels), custom.maxPixels)
    const nearest = fitRatio(spec, target, custom.maxPixels, custom)
    return {
        ok: false,
        reason: problem,
        ...(nearest ? { nearest: `${nearest.width}x${nearest.height}` } : {})
    }
}

export const resolveImageSize = ({
    sizing,
    supportedSizes,
    spec,
    resolution,
    referenceCount
}: {
    sizing: FalImageSizing
    /** The model's `supportedImageSizes`: the allowlist for aspect-ratio endpoints. */
    supportedSizes: readonly string[] | undefined
    spec: ImageSizeSpec
    resolution: ImageResolution | undefined
    referenceCount: number
}): ImageSizeResolution => {
    if (sizing.input === "aspectRatio") {
        if (spec.kind === "pixels") {
            return { ok: false, reason: "This model takes an aspect ratio, not a pixel size." }
        }
        const allowed = (supportedSizes ?? []).filter((size) => !size.includes("x"))
        const match = allowed.find((size) => {
            const candidate = parseImageSizeInput(size)
            return candidate !== null && sameRatio(candidate, spec)
        })
        if (!match) return { ok: false, reason: `Supported ratios: ${allowed.join(", ")}.` }
        const falResolution = toFalResolution(resolution, sizing.resolutionParam)
        return {
            ok: true,
            size: {
                kind: "aspectRatio",
                aspectRatio: match,
                canonical: match,
                resolution,
                falInput: {
                    aspect_ratio: match,
                    ...(falResolution ? { resolution: falResolution } : {})
                }
            }
        }
    }

    const resolved = resolvePixelSizing(sizing, spec, resolution)
    if (resolved.ok && referenceCount > 0 && sizing.edit === "auto") {
        const { canonical, resolution: outputResolution } = resolved.size
        return {
            ok: true,
            size: {
                kind: "auto",
                canonical,
                resolution: outputResolution,
                falInput: { image_size: "auto" }
            }
        }
    }
    return resolved
}

export const describeImageSizeFailure = (
    modelName: string,
    requested: string,
    failure: { reason: string; nearest?: string }
) =>
    `${modelName} can't make ${requested}. ${failure.reason}${failure.nearest ? ` Try ${failure.nearest}.` : ""}`
