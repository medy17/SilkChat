import { getRoleplayPortraitIdError } from "@/lib/roleplay-portraits"
import { tool } from "ai"
import { z } from "zod"
import type { PreparedImageReference } from "../image_generation/shared"

export const ASSIGN_ROLEPLAY_PORTRAIT_TOOL_NAME = "assign_roleplay_portrait"

type PortraitAssignment = {
    characterId: string
    storageKey: string
    generatedImageId?: string
}

// The model may name an image by its reference ID or by the URL it saw. Either way the
// result must be one of this conversation's own images, never an arbitrary address.
export function resolvePortraitReference(
    references: readonly PreparedImageReference[],
    image: string,
    extractKey: (value: string) => string | null
): PreparedImageReference | undefined {
    const value = image.trim()
    const byId = references.find((reference) => reference.id === value)
    if (byId) return byId
    const key = extractKey(value)
    return key ? references.find((reference) => reference.key === key) : undefined
}

// Offered with SilkScreen: both need function calling and vision.
export const getAssignRoleplayPortraitTool = ({
    enabled,
    references,
    extractKey,
    assign
}: {
    enabled: boolean
    references: readonly PreparedImageReference[]
    extractKey: (value: string) => string | null
    assign: (portrait: PortraitAssignment) => Promise<unknown>
}) => {
    if (!enabled || references.length === 0) return {}

    return {
        [ASSIGN_ROLEPLAY_PORTRAIT_TOOL_NAME]: tool({
            description:
                "Set an image already in this conversation (an attachment or a finished SilkScreen image) as a roleplay character's portrait. Use only when the user asks. To create a new portrait, prepare a SilkScreen image with its portrait field instead.",
            inputSchema: z.object({
                characterId: z
                    .string()
                    .describe("The character's ID exactly as written in the scene markup."),
                name: z.string().min(1).max(80).describe("The character's display name."),
                image: z
                    .string()
                    .describe(
                        "The image's reference ID, or its URL as it appears in this conversation."
                    )
            }),
            execute: async ({ characterId, image }) => {
                const idError = getRoleplayPortraitIdError(characterId)
                if (idError) return { success: false, error: idError }

                const reference = resolvePortraitReference(references, image, extractKey)
                if (!reference) {
                    return { success: false, error: "That image is not part of this conversation." }
                }

                await assign({
                    characterId,
                    storageKey: reference.key,
                    ...(reference.generatedImageId
                        ? { generatedImageId: reference.generatedImageId }
                        : {})
                })
                return { success: true, characterId, image: reference.label }
            }
        })
    }
}
