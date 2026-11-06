import type { ImageQuality, ImageReasoningEffort, ImageResolution, ImageSize } from "../types"

export type FalSafetyMode = {
    enableSafetyChecker?: boolean
    /** Lower is stricter: 1 is fal's strictest level, and 6 its loosest on Google models. */
    safetyTolerance?: "1" | "6"
}

export const SETTLES_AFTER_SAFETY_REJECTION = {
    settlesAfterSafetyRejection: true
} as const

export type FalImageDescriptor = {
    appModelId: string
    endpoint: string
    editEndpoint?: string
    supportsReferences?: boolean
    imageSizeMode?: "standard" | "legacyOpenAi" | "seedream" | "seedreamPro"
    editImageSizeMode?: "auto" | "explicit"
    usesAspectRatio?: boolean
    resolutionMode?: "uppercase" | "lowercase"
    usesQuality?: boolean
    /** Endpoint takes `background`; we always send it so the model never picks for itself. */
    usesBackground?: boolean
    defaultQuality?: string
    /** Endpoint takes `reasoning_effort`; sent on every request so the level is never implicit. */
    defaultReasoningEffort?: ImageReasoningEffort
    usesMaxImages?: boolean
    omitOutputFormat?: boolean
    safety: FalSafetyMode
    settlesAfterSafetyRejection?: boolean
}

export type FalReferenceImage = {
    key: string
    url: string
}

export type FalImageRequest = {
    prompt: string
    imageSize: ImageSize
    imageResolution?: ImageResolution
    referenceImages: FalReferenceImage[]
    maxAssets?: number
    quality?: Exclude<ImageQuality, "auto">
    reasoningEffort?: ImageReasoningEffort
    transparentBackground?: boolean
}

export type FalGeneratedImage = {
    url: string
    contentType?: string
}

export type FalImageParseResult =
    | { kind: "images"; images: FalGeneratedImage[] }
    | { kind: "refusal"; reason: string }
    | { kind: "error"; reason: string }
    | { kind: "unknown"; reason: string }
