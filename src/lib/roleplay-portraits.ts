import { ROLEPLAY_USER_ID } from "./roleplay"

// Supporting-character portraits are stored per thread and keyed by the markup's
// character ID. The Persona and the user keep their own portraits, so their reserved
// IDs never take one.
export const ROLEPLAY_PERSONA_ID = "persona"
export const MAX_ROLEPLAY_PORTRAITS = 50
const MAX_CHARACTER_ID_LENGTH = 64

export type RoleplayPortrait = {
    characterId: string
    storageKey: string
    // The SilkScreen image it came from, so a card can show which variant is in use.
    generatedImageId?: string
}

// Portable metadata keeps storage keys, not provider URLs or generated-image IDs
// tied to the exporting account. Invalid entries never reach scene rendering.
export function parseRoleplayPortraits(value: unknown): RoleplayPortrait[] {
    if (typeof value === "string") {
        try {
            value = JSON.parse(value)
        } catch {
            return []
        }
    }
    if (!Array.isArray(value)) return []
    const portraits = new Map<string, RoleplayPortrait>()
    for (const entry of value) {
        if (
            !entry ||
            typeof entry !== "object" ||
            typeof entry.characterId !== "string" ||
            getRoleplayPortraitIdError(entry.characterId) ||
            typeof entry.storageKey !== "string" ||
            !/^(attachments|generations|references|roleplay-portraits)\/[^/]+\/.+/.test(
                entry.storageKey
            ) ||
            /[?#\\\s]/.test(entry.storageKey) ||
            entry.storageKey.split("/").includes("..")
        )
            continue
        if (portraits.size >= MAX_ROLEPLAY_PORTRAITS && !portraits.has(entry.characterId)) continue
        portraits.set(entry.characterId, {
            characterId: entry.characterId,
            storageKey: entry.storageKey
        })
    }
    return [...portraits.values()]
}

export function getRoleplayPortraitIdError(characterId: string): string | undefined {
    if (characterId === ROLEPLAY_PERSONA_ID || characterId === ROLEPLAY_USER_ID) {
        return "The Persona and the user already have their own portraits."
    }
    if (
        !characterId ||
        characterId.length > MAX_CHARACTER_ID_LENGTH ||
        characterId !== characterId.trim() ||
        /[\s<>"'&]/.test(characterId)
    ) {
        return "Use the character's ID exactly as written in the scene markup."
    }
    return undefined
}

export function upsertRoleplayPortrait(
    portraits: readonly RoleplayPortrait[],
    portrait: RoleplayPortrait
): RoleplayPortrait[] {
    const others = portraits.filter((entry) => entry.characterId !== portrait.characterId)
    if (others.length >= MAX_ROLEPLAY_PORTRAITS) {
        throw new Error(`A conversation can have up to ${MAX_ROLEPLAY_PORTRAITS} portraits.`)
    }
    return [...others, portrait]
}
