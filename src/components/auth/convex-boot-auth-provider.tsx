import { useSession } from "@/hooks/auth-hooks"
import { authClient } from "@/lib/auth-client"
import { isBootSessionPending, readJwtClaims, takeBootConvexToken } from "@/lib/boot-auth"
import { type QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { ConvexProviderWithAuth, type ConvexReactClient } from "convex/react"
import { type ReactNode, useEffect, useMemo, useRef, useState } from "react"

// Matches the staleTime AuthQueryProvider gives every other useSession caller.
const SESSION_STALE_TIME_MS = 60 * 1000
const TOKEN_EXPIRY_MARGIN_SECONDS = 60

let cachedToken: string | null = null

const isTokenUsable = (token: string | null | undefined): token is string => {
    if (!token) return false
    const exp = readJwtClaims(token)?.exp
    return typeof exp === "number" && exp - Date.now() / 1000 > TOKEN_EXPIRY_MARGIN_SECONDS
}

const fetchConvexToken = async ({ forceRefreshToken }: { forceRefreshToken: boolean }) => {
    if (!forceRefreshToken) {
        // The boot already has a token, from the cookie JWT or the request the head script
        // started, so the socket can authenticate without waiting on another round trip.
        const bootTokenRequest = takeBootConvexToken()
        if (bootTokenRequest) {
            const bootToken = await bootTokenRequest
            if (isTokenUsable(bootToken)) {
                cachedToken = bootToken
                return cachedToken
            }
            // The server already answered that there is no session; asking again won't help.
            if (bootToken === null) return null
        }
        if (isTokenUsable(cachedToken)) return cachedToken
    }

    try {
        const { data } = await authClient.convex.token({ fetchOptions: { throw: false } })
        cachedToken = data?.token ?? null
    } catch {
        cachedToken = null
    }
    return cachedToken
}

/**
 * Convex auth driven by the shared `["session"]` query, which the boot seeds before the
 * first render. A returning user's cookie makes Convex authenticate straight away; the
 * pending session then resolves without changing anything Convex keys its auth effect on,
 * so authenticated queries never flip off and on again during boot.
 */
function useBootAwareConvexAuth() {
    const { data: session, isPending } = useSession({ staleTime: SESSION_STALE_TIME_MS })
    const [isAwaitingBootSession, setIsAwaitingBootSession] = useState(isBootSessionPending)
    if (isAwaitingBootSession && !isPending) setIsAwaitingBootSession(false)
    const assumeBootSession = isAwaitingBootSession && isPending

    const userId = session?.user?.id
    const lastUserIdRef = useRef<string | undefined>(undefined)
    const [authEpoch, setAuthEpoch] = useState(0)
    useEffect(() => {
        if (!userId) {
            if (isPending) return
            lastUserIdRef.current = undefined
            cachedToken = null
            return
        }
        // A different account (impersonation, re-sign-in) needs a fresh token. The first
        // resolution of the boot session is not a change, unless the token Convex is using
        // (say, a cookie JWT left over from another account) belongs to someone else.
        const isAccountChange = Boolean(lastUserIdRef.current) && lastUserIdRef.current !== userId
        const isForeignToken = cachedToken !== null && readJwtClaims(cachedToken)?.sub !== userId
        if (isAccountChange || isForeignToken) {
            cachedToken = null
            setAuthEpoch((epoch) => epoch + 1)
        }
        lastUserIdRef.current = userId
    }, [isPending, userId])

    // biome-ignore lint/correctness/useExhaustiveDependencies: authEpoch re-keys the callback on account change
    const fetchAccessToken = useMemo(
        () => (args: { forceRefreshToken: boolean }) => fetchConvexToken(args),
        [authEpoch]
    )

    const isAuthenticated = Boolean(session?.session) || assumeBootSession
    const isLoading = isPending && !assumeBootSession

    return useMemo(
        () => ({ isLoading, isAuthenticated, fetchAccessToken }),
        [fetchAccessToken, isAuthenticated, isLoading]
    )
}

export function ConvexBootAuthProvider({
    client,
    queryClient,
    children
}: {
    client: ConvexReactClient
    queryClient: QueryClient
    children: ReactNode
}) {
    // This sits above Providers' QueryClientProvider; both share the one client.
    return (
        <QueryClientProvider client={queryClient}>
            <ConvexProviderWithAuth client={client} useAuth={useBootAwareConvexAuth}>
                {children}
            </ConvexProviderWithAuth>
        </QueryClientProvider>
    )
}
