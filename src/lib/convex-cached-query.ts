import { useQuery } from "convex-helpers/react/cache"
import {
    type OptionalRestArgsOrSkip,
    type PaginatedQueryArgs,
    type PaginatedQueryReference,
    usePaginatedQuery
} from "convex/react"
import type { FunctionReference } from "convex/server"
import { useEffect, useMemo, useRef, useState } from "react"
type IsArrayType<T> = T extends readonly unknown[] ? true : false

const isQueryErrorResult = (value: unknown): value is { error: unknown } =>
    typeof value === "object" && value !== null && "error" in value

type CachedItem<
    T,
    IsArray extends boolean = false,
    ExtraProps extends Record<string, unknown> = Record<string, never>
> = IsArray extends true
    ? T extends readonly unknown[]
        ? (T[number] & ExtraProps)[]
        : never
    : T & ExtraProps

export const useDiskCachedQueryState = <
    Query extends FunctionReference<"query">,
    ExtraProps extends Record<string, unknown>,
    T = ReturnType<typeof useQuery<Query>>,
    IsArray extends boolean = IsArrayType<T>
>(
    query: Query,
    cacheOptions: {
        key: string
        maxItems?: number
        default: ReturnType<typeof useQuery<Query>>
        forceCache?: boolean
        acceptResult?: (value: unknown) => boolean
    },
    ...args: OptionalRestArgsOrSkip<Query>
) => {
    const isClient = typeof window !== "undefined"
    const queriedResult = useQuery(query, ...args)
    const result =
        cacheOptions.acceptResult && !cacheOptions.acceptResult(queriedResult)
            ? undefined
            : queriedResult
    const storageKey = `CVX_DISK_CACHE:${cacheOptions.key}`
    const defaultValueRef = useRef(cacheOptions.default)
    defaultValueRef.current = cacheOptions.default
    const diskCacheFromCurrentKey = useMemo(() => {
        if (!isClient) return defaultValueRef.current as CachedItem<T, IsArray, ExtraProps>
        const cache = localStorage.getItem(storageKey)
        return cache
            ? JSON.parse(cache)
            : (defaultValueRef.current as CachedItem<T, IsArray, ExtraProps>)
    }, [isClient, storageKey])
    const [externalCacheUpdate, setExternalCacheUpdate] = useState<{
        storageKey: string
        value: CachedItem<T, IsArray, ExtraProps>
    } | null>(null)
    const disk_cache =
        externalCacheUpdate?.storageKey === storageKey
            ? externalCacheUpdate.value
            : diskCacheFromCurrentKey

    useEffect(() => {
        if (!isClient) return

        const handleStorageChange = (e: StorageEvent) => {
            if (e.key === storageKey && e.newValue) {
                try {
                    const newCache = JSON.parse(e.newValue)
                    setExternalCacheUpdate({ storageKey, value: newCache })
                } catch (error) {
                    console.warn("Failed to parse localStorage cache update:", error)
                }
            }
        }

        window.addEventListener("storage", handleStorageChange)
        return () => window.removeEventListener("storage", handleStorageChange)
    }, [storageKey, isClient])

    const output: CachedItem<T, IsArray, ExtraProps> | { error: unknown } =
        args.length > 0 && args[0] === "skip" && !cacheOptions.forceCache
            ? (cacheOptions.default as CachedItem<T, IsArray, ExtraProps>)
            : (result ?? disk_cache)

    useEffect(() => {
        if (result === undefined || isQueryErrorResult(result)) return
        if (cacheOptions.maxItems && Array.isArray(result)) {
            localStorage.setItem(storageKey, JSON.stringify(result.slice(0, cacheOptions.maxItems)))
        } else {
            localStorage.setItem(storageKey, JSON.stringify(result))
        }
    }, [result, cacheOptions.maxItems, storageKey])

    return { value: output, live: result }
}

// Boot consumers also need freshness before running onboarding or privacy effects.
export const useDiskCachedQuery = <
    Query extends FunctionReference<"query">,
    ExtraProps extends Record<string, unknown>,
    T = ReturnType<typeof useQuery<Query>>,
    IsArray extends boolean = IsArrayType<T>
>(
    query: Query,
    cacheOptions: {
        key: string
        maxItems?: number
        default: ReturnType<typeof useQuery<Query>>
        forceCache?: boolean
    },
    ...args: OptionalRestArgsOrSkip<Query>
) => useDiskCachedQueryState<Query, ExtraProps, T, IsArray>(query, cacheOptions, ...args).value

export const useDiskCachedPaginatedQuery = <
    ExtraProps extends Record<string, unknown>,
    Query extends PaginatedQueryReference
>(
    query: Query,
    cacheOptions: { key: string; maxItems?: number },
    args: PaginatedQueryArgs<Query> | "skip",
    options: { initialNumItems: number }
) => {
    const { results, status, loadMore } = usePaginatedQuery(query, args, options)
    const [acceptEmptyResults, setAcceptEmptyResults] = useState(false)
    const skipped = args === "skip"
    type Items = ((typeof results)[number] & ExtraProps)[]
    const [lastSnapshot, setLastSnapshot] = useState<{ key: string; items: Items } | null>(null)

    const disk_cache: ((typeof results)[number] & ExtraProps)[] = useMemo(() => {
        if (typeof window === "undefined") return []
        const cache = localStorage.getItem(`CVX_DISK_CACHE:${cacheOptions.key}`)
        return cache ? JSON.parse(cache) : []
    }, [cacheOptions.key])
    const cachedResults = lastSnapshot?.key === cacheOptions.key ? lastSnapshot.items : disk_cache

    // Debounce logic for "Exhausted" state with empty results
    useEffect(() => {
        if (skipped || status === "LoadingFirstPage" || results.length > 0) {
            setAcceptEmptyResults(false)
            return
        }
        if (status === "Exhausted" && results.length === 0 && cachedResults.length > 0) {
            // Wait 500ms before accepting empty results as truth
            const timer = setTimeout(() => {
                setAcceptEmptyResults(true)
            }, 500)
            return () => clearTimeout(timer)
        }
    }, [skipped, status, results.length, cachedResults.length, cacheOptions.key])

    const output: ((typeof results)[number] & ExtraProps)[] =
        skipped ||
        status === "LoadingFirstPage" ||
        (results.length === 0 && cachedResults.length > 0 && !acceptEmptyResults)
            ? cachedResults
            : results

    useEffect(() => {
        // A skipped query reports empty results; that is not an empty server list.
        if (skipped || status === "LoadingFirstPage") return
        if (results.length === 0 && cachedResults.length > 0 && !acceptEmptyResults) return
        setLastSnapshot((previous) =>
            previous?.key === cacheOptions.key && previous.items === results
                ? previous
                : { key: cacheOptions.key, items: results as Items }
        )
        if (cacheOptions.maxItems && Array.isArray(results)) {
            localStorage.setItem(
                `CVX_DISK_CACHE:${cacheOptions.key}`,
                JSON.stringify(results.slice(0, cacheOptions.maxItems))
            )
        } else {
            localStorage.setItem(`CVX_DISK_CACHE:${cacheOptions.key}`, JSON.stringify(results))
        }
    }, [
        skipped,
        results,
        status,
        cacheOptions.key,
        cacheOptions.maxItems,
        cachedResults.length,
        acceptEmptyResults
    ])

    return {
        results: output,
        loadMore: (numItems: number) => {
            if (!skipped) loadMore(numItems)
        },
        status
    }
}

export const clearDiskCache = () => {
    Object.keys(localStorage).forEach((key) => {
        if (key.startsWith("CVX_DISK_CACHE:")) {
            localStorage.removeItem(key)
        }
    })
}
