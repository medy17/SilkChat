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

// FNV-1a: small, synchronous, and identical in the browser and Convex.
const hashOpeningText = (text: string) => {
    let hash = 0x811c9dc5
    for (let index = 0; index < text.length; index++) {
        hash ^= text.charCodeAt(index)
        hash = Math.imul(hash, 0x01000193)
    }
    return (hash >>> 0).toString(36)
}

// Custom openings are plain strings, so each id derives from its text. An opening
// edited after it was shown stops resolving instead of persisting different words.
// The user's conversation starters stay the suggested replies.
export const getUserPersonaOpenings = (persona: {
    openings?: string[]
    conversationStarters: string[]
}): BuiltInPersonaOpening[] =>
    persona.openings?.length
        ? persona.openings.map((text) => ({
              id: `custom-${hashOpeningText(text)}`,
              text,
              suggestedReplies: persona.conversationStarters
          }))
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
    // Preloads native roleplay scene markup on every turn of this persona.
    roleplayFormat?: boolean
    avatarPath: string
    knowledgeDocs: BuiltInPersonaDoc[]
}
