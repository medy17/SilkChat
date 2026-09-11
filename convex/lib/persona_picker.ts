import {
    BUILT_IN_PERSONAS,
    getBuiltInPersonaOpenings,
    getSyntheticPersonaOpening
} from "@/lib/personas/builtins"
import type { QueryCtx } from "../_generated/server"

export const getPersonaPickerOptions = async (ctx: QueryCtx, userId: string | null) => {
    const userPersonas = userId
        ? await ctx.db
              .query("userPersonas")
              .withIndex("byAuthorUpdatedAt", (q) => q.eq("authorId", userId))
              .order("desc")
              .collect()
        : []
    return {
        builtIns: BUILT_IN_PERSONAS.map((persona) => ({
            source: "builtin" as const,
            id: persona.id,
            name: persona.name,
            shortName: persona.shortName,
            description: persona.description,
            conversationStarters: persona.conversationStarters,
            openings: getBuiltInPersonaOpenings(persona),
            defaultModelId: persona.defaultModelId,
            avatarKind: "builtin" as const,
            avatarValue: persona.avatarPath
        })),
        userPersonas: userPersonas.map((persona) => ({
            source: "user" as const,
            id: persona._id,
            name: persona.name,
            shortName: persona.shortName || persona.name.slice(0, 10),
            description: persona.description,
            conversationStarters: persona.conversationStarters,
            openings: [getSyntheticPersonaOpening(persona.conversationStarters)],
            defaultModelId: persona.defaultModelId,
            avatarKind: persona.avatarKey ? ("r2" as const) : undefined,
            avatarValue: persona.avatarKey,
            avatarMimeType: persona.avatarMimeType
        }))
    }
}
