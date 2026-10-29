export const MAX_FAVORITES = {
    model: 20,
    persona: 20
} as const

export type FavoriteKind = keyof typeof MAX_FAVORITES

export const FAVORITE_SETTINGS_FIELDS = {
    model: "favoriteModelIds",
    persona: "favoritePersonaKeys"
} as const

// Bounds request payloads; merged imports may still exceed the cap.
export const MAX_FAVORITE_PAYLOAD_LENGTH = 200
const MAX_FAVORITE_ID_LENGTH = 256

export type FavoriteReplacement = { from: string; to: string | null }

export const assertFavoritePayload = (ids: readonly string[]) => {
    if (ids.length > MAX_FAVORITE_PAYLOAD_LENGTH) throw new Error("Too many favorites")
    if (ids.some((id) => !id || id.length > MAX_FAVORITE_ID_LENGTH)) {
        throw new Error("Invalid favorite")
    }
}

/** Maps retired or deleted entries to their current equivalent, dropping any that resolve to null. */
export const applyFavoriteReplacements = (
    ids: readonly string[],
    replacements: readonly FavoriteReplacement[]
) => {
    const replacementById = new Map(replacements.map(({ from, to }) => [from, to]))
    const resolvedIds: string[] = []
    for (const id of ids) {
        const resolvedId = replacementById.has(id) ? replacementById.get(id) : id
        if (resolvedId && !resolvedIds.includes(resolvedId)) resolvedIds.push(resolvedId)
    }
    return resolvedIds
}

/**
 * Returns the next stored list, or null when adding would pass the cap. `seed` is the list the
 * client is showing and only applies before the user has a stored list.
 */
export const getNextFavoriteIds = ({
    kind,
    storedIds,
    seed,
    replacements,
    id,
    isFavorite
}: {
    kind: FavoriteKind
    storedIds: readonly string[] | undefined
    seed: readonly string[]
    replacements: readonly FavoriteReplacement[]
    id: string
    isFavorite: boolean
}) => {
    const currentIds = applyFavoriteReplacements(storedIds ?? seed, replacements)
    if (!isFavorite) return currentIds.filter((currentId) => currentId !== id)
    if (currentIds.includes(id)) return currentIds
    if (currentIds.length >= MAX_FAVORITES[kind]) return null
    return [...currentIds, id]
}

// Appends unseen IDs in their local order. Imports keep everything, even past the cap.
export const mergeImportedFavoriteIds = (
    storedIds: readonly string[] | undefined,
    importedIds: readonly string[]
) => [...new Set([...(storedIds ?? []), ...importedIds])]

export const parseLegacyFavoriteIds = (storedValue: string | null): string[] | null => {
    if (storedValue === null) return null
    try {
        const parsed: unknown = JSON.parse(storedValue)
        if (!Array.isArray(parsed) || !parsed.every((value) => typeof value === "string")) {
            return null
        }
        return [...new Set(parsed)]
    } catch {
        return null
    }
}

const hasSameIds = (left: readonly string[], right: readonly string[]) => {
    const leftIds = new Set(left)
    const rightIds = new Set(right)
    return leftIds.size === rightIds.size && [...leftIds].every((id) => rightIds.has(id))
}

/**
 * Browsers saved reconciled default lists without the user choosing them. Importing those would
 * re-add defaults the user already removed on another device.
 */
export const isUntouchedDefaultFavoriteList = (
    ids: readonly string[],
    defaultLists: readonly (readonly string[])[],
    reconcile: (ids: readonly string[]) => string[]
) => {
    const reconciledIds = reconcile(ids)
    return defaultLists.some(
        (defaults) => hasSameIds(ids, defaults) || hasSameIds(reconciledIds, reconcile(defaults))
    )
}
