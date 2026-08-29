export const PERSONA_FAVORITES_SECTION_ID = "favorites"

export const DEFAULT_FAVORITE_BUILTIN_PERSONA_KEYS = [
    "builtin:elara-adventurer",
    "builtin:brooding-stranger",
    "builtin:monday",
    "builtin:essay-columnist",
    "builtin:senior-code-reviewer",
    "builtin:socratic-tutor"
] as const
const DEFAULT_FAVORITE_PERSONA_LIMIT = 6

export const getDefaultFavoritePersonaKeys = (userPersonaKeys: readonly string[]) =>
    [...new Set([...userPersonaKeys.slice(0, 3), ...DEFAULT_FAVORITE_BUILTIN_PERSONA_KEYS])]
        .slice(0, DEFAULT_FAVORITE_PERSONA_LIMIT)
        .reverse()

export const DEFAULT_FAVORITE_PERSONA_KEYS = getDefaultFavoritePersonaKeys([])

export const getPersonaFavoritesStorageKey = (userId: string) =>
    `persona-selector-favorites:${userId}`

export const getFavoritePersonaKeysByRecentlyAdded = (favoritePersonaKeys: readonly string[]) =>
    [...favoritePersonaKeys].reverse()

export const resolveFavoritePersonaKeys = (
    storedValue: string | null,
    defaultFavoritePersonaKeys: readonly string[] = DEFAULT_FAVORITE_PERSONA_KEYS
): string[] => {
    if (storedValue === null) return [...defaultFavoritePersonaKeys]

    try {
        const parsed = JSON.parse(storedValue)
        if (!Array.isArray(parsed) || !parsed.every((value) => typeof value === "string")) {
            return [...defaultFavoritePersonaKeys]
        }

        return [...new Set(parsed)]
    } catch {
        return [...defaultFavoritePersonaKeys]
    }
}

export const reconcileFavoritePersonaKeys = ({
    favoritePersonaKeys,
    availablePersonaKeys
}: {
    favoritePersonaKeys: readonly string[]
    availablePersonaKeys: ReadonlySet<string>
}) => favoritePersonaKeys.filter((key) => availablePersonaKeys.has(key))
