import { tool } from "ai"
import { z } from "zod"
import {
    type PreparedImageReference,
    getSelectableImageModels,
    getSupportedAspectRatiosForImageModel,
    getSupportedResolutionsForImageModel,
    validatePreparedImageRequest
} from "../image_generation/shared"
import type { ImageResolution } from "../models"

export type ImageGenerationDefaults = {
    resolution?: ImageResolution
    variants?: number
}

const nonEmptyEnum = (values: string[], fallback: string) =>
    z.enum((values.length > 0 ? values : [fallback]) as [string, ...string[]])

export const PREPARE_IMAGE_GENERATION_TOOL_NAME = "prepareImageGeneration"

export const getPrepareImageGenerationTool = ({
    enabled,
    references,
    defaults
}: {
    enabled: boolean
    references: PreparedImageReference[]
    defaults?: ImageGenerationDefaults
}) => {
    if (!enabled) return {}

    const imageModels = getSelectableImageModels()
    if (imageModels.length === 0) return {}

    const modelIds = imageModels.map((model) => model.id)
    const aspectRatios = Array.from(
        new Set(imageModels.flatMap((model) => getSupportedAspectRatiosForImageModel(model)))
    )
    const resolutions = Array.from(
        new Set(imageModels.flatMap((model) => getSupportedResolutionsForImageModel(model)))
    )
    const referenceIds = references.map((reference) => reference.id)
    const modelSelectionSummary = imageModels
        .map((model) => {
            const modelAspectRatios = getSupportedAspectRatiosForImageModel(model)
            const modelResolutions = getSupportedResolutionsForImageModel(model)
            const referenceLimit = model.supportsReferenceImages
                ? `references up to ${model.maxReferenceImages ?? "the model limit"}`
                : "references none"
            return `${model.id}: aspect ratios ${modelAspectRatios.join(", ") || "default"}; resolutions ${modelResolutions.join(", ") || "default"}; ${referenceLimit}`
        })
        .join("\n")

    const defaultsSummary = `resolution ${defaults?.resolution ?? "1K"}, variants ${defaults?.variants ?? 1}`

    // One tool instance is constructed per turn, so this closure is turn-scoped. It lets us
    // reject duplicate cards from models that call the tool repeatedly (one card per option)
    // instead of setting the variants field on a single call. execute() has no await before
    // the check-and-add, so it is atomic even if the SDK runs parallel tool calls.
    const preparedCardKeys = new Set<string>()

    return {
        [PREPARE_IMAGE_GENERATION_TOOL_NAME]: tool({
            description: [
                "Prepare a SilkScreen image generation or image edit card for the user to confirm.",
                "This is an internal orchestration tool: it does not generate pixels, submit the job, store an asset, or spend credits.",
                "After a successful call, stop the turn. The pending card is the assistant response.",
                "Use only valid enum inputs supplied by the schema.",
                "For edits or transformations of an attached/provided/current image, include the relevant referenceIds.",
                "When multiple SilkScreen variants are available, select the variant-specific reference id the user named. If the intended variant is ambiguous, ask the user which variant to use instead of guessing.",
                `Leave resolution and variants unset to apply the user's defaults (${defaultsSummary}); an explicit user request for higher fidelity or multiple images overrides them.`,
                `Available SilkScreen image selections:\n${modelSelectionSummary}`
            ].join("\n"),
            inputSchema: z.object({
                title: z
                    .string()
                    .min(1)
                    .max(80)
                    .describe(
                        'A short, human-friendly title for the image (3-6 words), shown as the card heading. E.g. "Greek goddess on the beach".'
                    ),
                prompt: z
                    .string()
                    .min(1)
                    .describe(
                        "The prompt for a SINGLE image, written in the singular. For multiple options use the variants field instead — never request several images, a grid, or a count inside this text (each variant re-runs this same prompt independently)."
                    ),
                modelId: nonEmptyEnum(modelIds, imageModels[0].id).describe(
                    "The SilkScreen image model to use."
                ),
                aspectRatio: nonEmptyEnum(aspectRatios, "1:1").describe(
                    "The requested image aspect ratio."
                ),
                resolution:
                    resolutions.length > 0
                        ? nonEmptyEnum(resolutions, "1K")
                              .optional()
                              .describe(
                                  "The requested image resolution. Leave unset to use the user's default (standard quality). Only set a higher resolution when the user explicitly asks for high fidelity, large prints, or names a resolution."
                              )
                        : z.undefined().optional(),
                variants: z
                    .number()
                    .int()
                    .min(1)
                    .max(10)
                    .optional()
                    .describe(
                        "How many image variants to prepare. Leave unset to use the user's default. Only request multiple when the user explicitly asks for options or variations."
                    ),
                referenceIds:
                    referenceIds.length > 0
                        ? z
                              .array(nonEmptyEnum(referenceIds, referenceIds[0]))
                              .default([])
                              .describe(
                                  "Opaque ids for available images to use as edit references. Required when editing, transforming, or using an attached/provided image."
                              )
                        : z.array(z.never()).default([])
            }),
            execute: async ({
                title,
                prompt,
                modelId,
                aspectRatio,
                resolution,
                variants,
                referenceIds
            }) => {
                const selectedReferenceIds = referenceIds as string[]
                const selectedReferences = references.filter((reference) =>
                    selectedReferenceIds.includes(reference.id)
                )

                try {
                    // Edit vs. text-to-image is decided downstream purely by whether
                    // references are passed (getFalEndpointForRequest switches to the edit
                    // endpoint when referenceImageCount > 0). So we don't sniff the prompt:
                    // the model is told to include referenceIds for edits, and whatever it
                    // selects is honored as-is.
                    const validated = validatePreparedImageRequest({
                        modelId,
                        aspectRatio,
                        resolution,
                        variants,
                        referenceCount: selectedReferences.length,
                        defaults
                    })

                    // Dedupe on everything that defines the image (not variant count): a
                    // model that wants N copies of the same card is really asking for N
                    // variants. Distinct prompts/models/references still produce distinct
                    // cards, so legitimate multi-image turns are unaffected.
                    const cardKey = [
                        prompt.trim().replace(/\s+/g, " ").toLowerCase(),
                        validated.model.id,
                        validated.aspectRatio,
                        validated.resolution ?? "",
                        selectedReferences
                            .map((reference) => reference.id)
                            .sort()
                            .join(",")
                    ].join("|")
                    if (preparedCardKeys.has(cardKey)) {
                        return {
                            success: false,
                            code: "duplicate_card",
                            error: "An identical image card was already prepared this turn. To create multiple variations of the same image, set the `variants` field on a single call — do not call the tool again."
                        }
                    }
                    preparedCardKeys.add(cardKey)

                    return {
                        success: true,
                        kind: "prepared_image_generation",
                        status: "pending_confirmation",
                        cardId: crypto.randomUUID(),
                        title: title.trim(),
                        prompt: prompt.trim(),
                        modelId: validated.model.id,
                        modelName: validated.model.name,
                        aspectRatio: validated.aspectRatio,
                        resolution: validated.resolution,
                        variants: validated.variants,
                        referenceIds: selectedReferences.map((reference) => reference.id),
                        references: selectedReferences.map((reference) => ({
                            id: reference.id,
                            label: reference.label,
                            mimeType: reference.mimeType,
                            source: reference.source
                        })),
                        referenceSources: selectedReferences.map((reference) => ({
                            id: reference.id,
                            key: reference.key,
                            source: reference.source,
                            generatedImageId: reference.generatedImageId
                        })),
                        estimatedCredits: {
                            ...validated.creditEstimate,
                            units: validated.creditEstimate.units * validated.variants
                        },
                        validSelectionsVersion: imageModels.map((model) => model.id).join(",")
                    }
                } catch (error) {
                    return {
                        success: false,
                        code: "invalid_selection",
                        error:
                            error instanceof Error
                                ? error.message
                                : "Could not prepare this image request."
                    }
                }
            }
        })
    }
}
