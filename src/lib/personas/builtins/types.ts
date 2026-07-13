export type BuiltInPersonaDoc = {
    fileName: string
    content: string
}

export type BuiltInPersonaOpening = {
    // Stable identifier used to resolve the authored opening server-side.
    id: string
    // The persona's first message, spoken in the persona's voice.
    text: string
    // Pre-authored replies the user can send with one tap. User-voiced.
    suggestedReplies: string[]
}

export const SYNTHETIC_PERSONA_OPENING_ID = "synthetic-default"

export const getSyntheticPersonaOpening = (
    conversationStarters: string[]
): BuiltInPersonaOpening => ({
    id: SYNTHETIC_PERSONA_OPENING_ID,
    text: "I'm here. Where shall we begin?",
    suggestedReplies: conversationStarters
})

// Openings the persona can speak first. Personas without authored openings use
// a neutral persona-side opening while retaining their user-voiced starters as
// suggested replies.
export const getBuiltInPersonaOpenings = (persona: {
    openings?: BuiltInPersonaOpening[]
    conversationStarters: string[]
}): BuiltInPersonaOpening[] =>
    persona.openings?.length
        ? persona.openings
        : [getSyntheticPersonaOpening(persona.conversationStarters)]

export type BuiltInPersona = {
    id: string
    name: string
    shortName: string
    description: string
    instructions: string
    conversationStarters: string[]
    openings?: BuiltInPersonaOpening[]
    defaultModelId: string
    avatarPath: string
    knowledgeDocs: BuiltInPersonaDoc[]
}
