import type { ImageResolution, ImageSize } from "../types"

export type FalSafetyMode = {
    enableSafetyChecker?: boolean
    safetyTolerance?: "1"
}

export const SETTLES_AFTER_SAFETY_REJECTION = {
    settlesAfterSafetyRejection: true
} as const

export type FalImageDescriptor = {
    appModelId: string
    endpoint: string
    editEndpoint?: string
    supportsReferences?: boolean
    imageSizeMode?: "standard" | "legacyOpenAi" | "seedream"
    usesAspectRatio?: boolean
    resolutionMode?: "uppercase" | "lowercase"
    usesQuality?: boolean
    defaultQuality?: string
    usesMaxImages?: boolean
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
    quality?: "low" | "medium" | "high"
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
