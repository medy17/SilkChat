import { useSession, useToken } from "@/hooks/auth-hooks"
import { resolveJwtToken } from "@/lib/auth-token"
import { ConvexProviderWithAuth } from "convex/react"
import type { ReactNode } from "react"
import { useCallback, useMemo, useRef } from "react"

type ConvexAuthClient = {
    setAuth(
        fetchToken: (args: { forceRefreshToken: boolean }) => Promise<string | null | undefined>,
        onChange: (isAuthenticated: boolean) => void
    ): void
    clearAuth(): void
}

export function AppConvexAuthProvider({
    children,
    client
}: {
    children: ReactNode
    client: ConvexAuthClient
}) {
    const useAuth = useMemo(
        () =>
            function useAuthFromApp() {
                const session = useSession()
                const tokenQuery = useToken()
                const tokenRef = useRef<string | undefined>(tokenQuery.token)
                const pendingTokenRef = useRef<Promise<string | null> | null>(null)

                tokenRef.current = tokenQuery.token

                const sessionId = session.data?.session?.id
                const fetchAccessToken = useCallback(
                    async ({ forceRefreshToken = false }: { forceRefreshToken?: boolean } = {}) => {
                        const currentToken = tokenRef.current

                        if (currentToken && !forceRefreshToken) {
                            return currentToken
                        }

                        if (!forceRefreshToken && pendingTokenRef.current) {
                            return pendingTokenRef.current
                        }

                        pendingTokenRef.current = resolveJwtToken(
                            currentToken,
                            forceRefreshToken ? { forceRefresh: true } : undefined
                        )
                            .then((resolvedToken) => resolvedToken ?? null)
                            .finally(() => {
                                pendingTokenRef.current = null
                            })

                        return pendingTokenRef.current
                    },
                    [sessionId]
                )

                return useMemo(
                    () => ({
                        isLoading: (session.isPending || tokenQuery.isPending) && !tokenQuery.token,
                        isAuthenticated:
                            Boolean(session.data?.session) || tokenQuery.token !== undefined,
                        fetchAccessToken
                    }),
                    [
                        fetchAccessToken,
                        session.data?.session,
                        session.isPending,
                        tokenQuery.isPending,
                        tokenQuery.token
                    ]
                )
            },
        []
    )

    return (
        <ConvexProviderWithAuth client={client} useAuth={useAuth}>
            {children}
        </ConvexProviderWithAuth>
    )
}
