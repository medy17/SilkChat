import { useCallback, useEffect, useMemo, useState } from "react"
import { useConvexAuth } from "@convex-dev/react-query"
import { useMutation } from "convex/react"
import { toast } from "sonner"
import { api } from "@/convex/_generated/api"
import { useCurrentUserSettings } from "@/hooks/use-current-user-settings"
import {
    FAVORITE_SETTINGS_FIELDS,
    type FavoriteKind,
    type FavoriteReplacement,
    MAX_FAVORITES,
    applyFavoriteReplacements,
    getNextFavoriteIds,
    isUntouchedDefaultFavoriteList,
    parseLegacyFavoriteIds
} from "@/lib/synced-favorites"

type ResolveFavoriteId = (id: string) => string | null

const readLegacyFavorites = (key: string | null) => {
    if (!key || typeof window === "undefined") return null
    try {
        return parseLegacyFavoriteIds(window.localStorage.getItem(key))
    } catch {
        return null
    }
}

const removeLegacyFavorites = (key: string) => {
    try {
        window.localStorage.removeItem(key)
    } catch {}
}

const getFavoriteReplacements = (ids: readonly string[], resolveId: ResolveFavoriteId) =>
    ids.flatMap((id): FavoriteReplacement[] => {
        const resolvedId = resolveId(id)
        return resolvedId === id ? [] : [{ from: id, to: resolvedId }]
    })

// The model picker and retry menu mount together; both share one import per browser.
const pendingImports = new Map<string, Promise<void>>()
const NO_PREVIOUS_DEFAULTS: readonly (readonly string[])[] = []

export function useSyncedFavorites({
    kind,
    userId,
    legacyStorageKey,
    defaultIds,
    previousDefaultIdLists = NO_PREVIOUS_DEFAULTS,
    resolveId
}: {
    kind: FavoriteKind
    userId: string | undefined
    legacyStorageKey: string | null
    defaultIds: readonly string[]
    previousDefaultIdLists?: readonly (readonly string[])[]
    /** Maps a saved ID to its current equivalent or null; undefined until the catalogue loads. */
    resolveId: ResolveFavoriteId | undefined
}) {
    const auth = useConvexAuth()
    const userSettings = useCurrentUserSettings(userId, auth.isLoading)
    const storedIds =
        userId && !("error" in userSettings)
            ? userSettings[FAVORITE_SETTINGS_FIELDS[kind]]
            : undefined
    const [legacy, setLegacy] = useState(() => ({
        key: legacyStorageKey,
        ids: readLegacyFavorites(legacyStorageKey)
    }))
    const legacyIds =
        legacy.key === legacyStorageKey ? legacy.ids : readLegacyFavorites(legacyStorageKey)

    useEffect(() => {
        setLegacy({ key: legacyStorageKey, ids: readLegacyFavorites(legacyStorageKey) })
    }, [legacyStorageKey])

    // Until this browser's import lands, its local list stands in for the synced one.
    const savedIds = storedIds ?? legacyIds ?? defaultIds
    const reconcile = useCallback(
        (ids: readonly string[]) =>
            resolveId
                ? applyFavoriteReplacements(ids, getFavoriteReplacements(ids, resolveId))
                : [...new Set(ids)],
        [resolveId]
    )
    const favoriteIds = useMemo(() => reconcile(savedIds), [reconcile, savedIds])

    const importLocalFavorites = useMutation(api.settings.importLocalFavorites)
    const canSync = Boolean(userId) && !auth.isLoading && auth.isAuthenticated

    useEffect(() => {
        if (!canSync || !legacyStorageKey || !legacyIds || !resolveId) return

        if (
            isUntouchedDefaultFavoriteList(
                legacyIds,
                [defaultIds, ...previousDefaultIdLists],
                reconcile
            )
        ) {
            removeLegacyFavorites(legacyStorageKey)
            setLegacy({ key: legacyStorageKey, ids: null })
            return
        }

        let importPromise = pendingImports.get(legacyStorageKey)
        if (!importPromise) {
            importPromise = importLocalFavorites({ kind, ids: legacyIds })
                .then(() => removeLegacyFavorites(legacyStorageKey))
                .finally(() => pendingImports.delete(legacyStorageKey))
            pendingImports.set(legacyStorageKey, importPromise)
        }

        let cancelled = false
        importPromise.then(
            () => {
                if (!cancelled) setLegacy({ key: legacyStorageKey, ids: null })
            },
            // The local list stays in place and the next mount retries.
            () => {}
        )
        return () => {
            cancelled = true
        }
    }, [
        canSync,
        defaultIds,
        importLocalFavorites,
        kind,
        legacyIds,
        legacyStorageKey,
        previousDefaultIdLists,
        reconcile,
        resolveId
    ])

    const setFavorite = useMutation(api.settings.setFavorite).withOptimisticUpdate(
        (localStore, args) => {
            const settings = localStore.getQuery(api.settings.getUserSettings, {})
            if (!settings) return
            const field = FAVORITE_SETTINGS_FIELDS[args.kind]
            const nextIds = getNextFavoriteIds({ ...args, storedIds: settings[field] })
            if (nextIds) {
                localStore.setQuery(
                    api.settings.getUserSettings,
                    {},
                    {
                        ...settings,
                        [field]: nextIds
                    }
                )
            }
        }
    )

    const canAddFavorite = favoriteIds.length < MAX_FAVORITES[kind]

    const toggleFavorite = useCallback(
        (id: string) => {
            if (!canSync) return
            const isFavorite = !favoriteIds.includes(id)
            if (isFavorite && !canAddFavorite) return
            setFavorite({
                kind,
                id,
                isFavorite,
                seed: favoriteIds,
                replacements: resolveId ? getFavoriteReplacements(savedIds, resolveId) : []
            }).catch(() => toast.error("Couldn't update favorites"))
        },
        [canAddFavorite, canSync, favoriteIds, kind, resolveId, savedIds, setFavorite]
    )

    return { favoriteIds, canAddFavorite, toggleFavorite }
}
