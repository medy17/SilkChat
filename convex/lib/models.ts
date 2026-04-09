export * from "./models/types"

import { ANTHROPIC_MODELS } from "./models/anthropic"
import { GOOGLE_MODELS } from "./models/google"
import { META_MODELS } from "./models/meta"
import { OPENAI_MODELS } from "./models/openai"
import { OPENROUTER_MODELS } from "./models/openrouter"
import type { SharedModel } from "./models/types"
import { XAI_MODELS } from "./models/xai"

export const MODELS_SHARED: SharedModel[] = [
    ...OPENAI_MODELS,
    ...OPENROUTER_MODELS,
    ...ANTHROPIC_MODELS,
    ...GOOGLE_MODELS,
    ...META_MODELS,
    ...XAI_MODELS
] as const

export const SHARED_MODELS_VERSION = JSON.stringify(
    MODELS_SHARED.map((model) => [
        model.id,
        model.name,
        model.shortName,
        model.shortDescription,
        model.description,
        model.developer,
        model.knowledgeCutoff,
        model.addedOn,
        model.artificialAnalysis,
        model.releaseOrder,
        model.adapters,
        model.abilities,
        model.mode,
        model.maxPerMessage,
        model.supportsReferenceImages,
        model.openrouterImageModalities,
        model.supportedImageSizes,
        model.supportedImageResolutions,
        model.customIcon,
        model.supportsDisablingReasoning,
        model.prototypeCreditTier,
        model.prototypeCreditTierWithReasoning,
        model.legacy
    ])
)
