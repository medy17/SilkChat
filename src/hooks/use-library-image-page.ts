import { api } from "@/convex/_generated/api"
import { removeDiskCacheKeys, writeDiskCache } from "@/lib/convex-cached-query"
import {
    assemblePageChunks,
    getPageChunkRequestKey,
    type PageChunk,
    type PageChunkRequest
} from "@/lib/cursor-pagination"
import { useQueries } from "convex-helpers/react/cache"
import type { FunctionArgs, FunctionReturnType } from "convex/server"
import { useEffect, useMemo, useRef, useState } from "react"

type LibraryPageQuery = typeof api.images.paginateGeneratedImages
type LibraryPageArgs = Omit<FunctionArgs<LibraryPageQuery>, "paginationOpts">
export type LibraryImagePage = PageChunk<FunctionReturnType<LibraryPageQuery>["page"][number]>

const isSameRequestList = (left: PageChunkRequest[], right: PageChunkRequest[]) =>
    left.length === right.length &&
    left.every(
        (request, index) => getPageChunkRequestKey(request) === getPageChunkRequestKey(right[index])
    )

const LIBRARY_PAGE_CACHE_PREFIX = "CVX_DISK_CACHE:library-cursor-page:v3:"
// Library cache formats replaced by LIBRARY_PAGE_CACHE_PREFIX.
const LEGACY_LIBRARY_CACHE_PREFIXES = [
    "CVX_DISK_CACHE:library-page:",
    "CVX_DISK_CACHE:library-cursor-page",
    "CVX_DISK_CACHE:library-count:"
]
let hasSweptLegacyLibraryCache = false

export const sweepLegacyLibraryCache = () => {
    if (hasSweptLegacyLibraryCache || typeof window === "undefined") return
    hasSweptLegacyLibraryCache = true
    try {
        removeDiskCacheKeys(
            (key) =>
                !key.startsWith(LIBRARY_PAGE_CACHE_PREFIX) &&
                LEGACY_LIBRARY_CACHE_PREFIXES.some((prefix) => key.startsWith(prefix))
        )
    } catch {}
}

const readDiskCache = (storageKey: string): LibraryImagePage | undefined => {
    if (typeof window === "undefined") return undefined
    try {
        const cached = localStorage.getItem(storageKey)
        return cached ? JSON.parse(cached) : undefined
    } catch {
        return undefined
    }
}

/**
 * Loads one full library page from its start cursor, fetching continuation
 * chunks when the server stops short on its read budget. While a page is
 * still filling, the last complete copy of the same page (or the disk cache)
 * stays on screen.
 */
export const useLibraryImagePage = ({
    args,
    startCursor,
    pageSize,
    cacheScope
}: {
    args: LibraryPageArgs | "skip"
    startCursor: string | null | undefined
    pageSize: number
    cacheScope: string
}) => {
    const enabled = args !== "skip" && startCursor !== undefined
    const scope = JSON.stringify([args, startCursor, pageSize])
    const firstRequests = useMemo<PageChunkRequest[]>(
        () => (enabled ? [{ cursor: startCursor ?? null, numItems: pageSize }] : []),
        [enabled, startCursor, pageSize]
    )
    const [requestState, setRequestState] = useState<{
        scope: string
        requests: PageChunkRequest[]
    }>({ scope, requests: firstRequests })
    const requests = enabled && requestState.scope === scope ? requestState.requests : firstRequests

    // biome-ignore lint/correctness/useExhaustiveDependencies: scope covers args by value; args is rebuilt every render.
    const queries = useMemo(
        () =>
            args === "skip"
                ? {}
                : Object.fromEntries(
                      requests.map((request) => [
                          getPageChunkRequestKey(request),
                          {
                              query: api.images.paginateGeneratedImages,
                              args: {
                                  ...args,
                                  paginationOpts: {
                                      numItems: request.numItems,
                                      cursor: request.cursor
                                  }
                              }
                          }
                      ])
                  ),
        [scope, requests]
    )
    const results = useQueries(queries)
    const hasError = Object.values(results).some((result) => result instanceof Error)

    const assembled = useMemo(() => {
        if (!enabled) return undefined
        return assemblePageChunks(startCursor ?? null, pageSize, (request) => {
            const result = results[getPageChunkRequestKey(request)]
            return result === undefined || result instanceof Error
                ? undefined
                : (result as LibraryImagePage)
        })
    }, [enabled, startCursor, pageSize, results])

    useEffect(() => {
        if (!assembled || isSameRequestList(assembled.requests, requests)) return
        setRequestState({ scope, requests: assembled.requests })
    }, [assembled, requests, scope])

    // A page's start cursor moves whenever newer images land, so each scope
    // keeps only its latest cursor's copy.
    const scopePrefix = `${LIBRARY_PAGE_CACHE_PREFIX}${cacheScope}:`
    const storageKey = `${scopePrefix}${startCursor}`
    const diskCache = useMemo(() => readDiskCache(storageKey), [storageKey])
    const livePage = assembled?.page
    const lastCompleteRef = useRef<{ storageKey: string; page: LibraryImagePage } | null>(null)
    if (livePage) {
        lastCompleteRef.current = { storageKey, page: livePage }
    }
    const lastSerializedRef = useRef<string | null>(null)

    useEffect(sweepLegacyLibraryCache, [])

    useEffect(() => {
        if (!livePage || typeof window === "undefined") return
        const serialized = JSON.stringify(livePage)
        if (lastSerializedRef.current === `${storageKey}\n${serialized}`) return
        lastSerializedRef.current = `${storageKey}\n${serialized}`
        writeDiskCache(storageKey, serialized, { replacePrefix: scopePrefix })
    }, [livePage, scopePrefix, storageKey])

    const page = !enabled
        ? undefined
        : (livePage ??
          (lastCompleteRef.current?.storageKey === storageKey
              ? lastCompleteRef.current.page
              : diskCache))

    return { page, isLive: Boolean(livePage), hasError }
}
