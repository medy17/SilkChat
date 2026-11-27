import { authClient } from "@/lib/auth-client"
import { isJwtToken } from "@/lib/auth-token"
import { createAuthHooks } from "@daveyplate/better-auth-tanstack"
import type { AnyUseQueryOptions } from "@tanstack/react-query"
import { useQuery } from "@tanstack/react-query"
import { useEffect, useMemo } from "react"

export const authHooks = createAuthHooks(authClient)

export const {
    useSession,
    usePrefetchSession,
    useListAccounts,
    useListSessions,
    useListDeviceSessions,
    useListPasskeys,
    useUpdateUser,
    useUnlinkAccount,
    useRevokeOtherSessions,
    useRevokeSession,
    useRevokeSessions,
    useSetActiveSession,
    useRevokeDeviceSession,
    useDeletePasskey,
    useAuthQuery,
    useAuthMutation
} = authHooks

const decodeJwtPayload = (token: string) => {
    const decode = (data: string) => {
        if (typeof Buffer === "undefined") {
            return atob(data)
        }

        return Buffer.from(data, "base64").toString()
    }

    const parts = token.split(".").map((part) => decode(part.replace(/-/g, "+").replace(/_/g, "/")))
    return JSON.parse(parts[1])
}

const isTokenExpired = (token: string) => {
    const payload = decodeJwtPayload(token)
    return !payload?.exp || payload.exp < Date.now() / 1000
}

export function useToken(options?: Partial<AnyUseQueryOptions>) {
    const session = useSession(options)
    const queryResult = useQuery({
        queryKey: ["token", session.data?.user?.id],
        queryFn: async () => {
            const response = await authClient.convex.token({
                fetchOptions: {
                    throw: false
                }
            })

            return response.data?.token ? { token: response.data.token } : undefined
        },
        ...options,
        enabled: Boolean(session.data?.session) && (options?.enabled ?? true)
    })

    const token = queryResult.data?.token
    const payload = useMemo(
        () => (token && isJwtToken(token) ? decodeJwtPayload(token) : null),
        [token]
    )

    useEffect(() => {
        if (!token || !isJwtToken(token)) return
        if (!payload?.exp) return

        const expiresAt = payload.exp * 1000
        const expiresIn = expiresAt - Date.now()
        // Refresh halfway through the token's lifetime so long-running chat requests start with
        // plenty of validity left without needing an extra round-trip on send.
        const lifetimeMs =
            typeof payload.iat === "number" && payload.exp > payload.iat
                ? (payload.exp - payload.iat) * 1000
                : 0
        const refreshLeadMs = lifetimeMs > 0 ? Math.max(60_000, Math.floor(lifetimeMs / 2)) : 60_000
        const refreshIn = Math.max(expiresIn - refreshLeadMs, 5000) // Minimum 5 seconds delay to prevent infinite loop

        const timeout = setTimeout(() => {
            void queryResult.refetch()
        }, refreshIn)

        return () => clearTimeout(timeout)
    }, [payload?.exp, payload?.iat, queryResult.refetch, token])

    const tokenData = useMemo(() => {
        if (!session.data?.user?.id || !token || !isJwtToken(token)) {
            return undefined
        }

        if (isTokenExpired(token) || payload?.sub !== session.data.user.id) {
            return undefined
        }

        return queryResult.data
    }, [payload?.sub, queryResult.data, session.data?.user?.id, token])

    return {
        ...queryResult,
        data: tokenData,
        token: tokenData?.token,
        payload
    }
}
