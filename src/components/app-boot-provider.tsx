import { api } from "@/convex/_generated/api"
import { useSession } from "@/hooks/auth-hooks"
import { useDiskCachedQueryState } from "@/lib/convex-cached-query"
import { useConvexAuth } from "@convex-dev/react-query"
import type { FunctionReturnType } from "convex/server"
import { createContext, useContext, useMemo, useEffect, useState, type ReactNode } from "react"

type Configuration = FunctionReturnType<typeof api.settings.getAppConfiguration>
type AccountStatus = FunctionReturnType<typeof api.credits.getMyAccountStatus>
type Snapshot<T> = { value: T | null; live: T | undefined }

const ConfigurationContext = createContext<Snapshot<Configuration> | undefined>(undefined)
const AccountContext = createContext<Snapshot<AccountStatus> | undefined>(undefined)

export function AppBootProvider({ children }: { children: ReactNode }) {
    const { data: session, isPending } = useSession()
    const auth = useConvexAuth()
    const userId = session?.user?.isAnonymous ? null : (session?.user?.id ?? null)
    // Session and Convex auth resolve independently. A loaded session must not
    // subscribe while the socket still represents a signed-out user (or vice versa).
    const ready = !isPending && !auth.isLoading && Boolean(session?.user) === auth.isAuthenticated
    const ownsResult = (value: unknown) =>
        value === null ||
        (typeof value === "object" &&
            value !== null &&
            "userId" in value &&
            value.userId === userId)
    const config = useDiskCachedQueryState(
        api.settings.getAppConfiguration,
        {
            key: `app-configuration:v1:${userId ?? "guest"}`,
            default: undefined,
            forceCache: true,
            acceptResult: ownsResult
        },
        ready ? {} : "skip"
    )
    const account = useDiskCachedQueryState(
        api.credits.getMyAccountStatus,
        {
            key: `account-status:v1:${userId ?? "guest"}`,
            default: null,
            forceCache: true,
            acceptResult: ownsResult
        },
        ready && userId ? {} : "skip"
    )

    const configValue = config.live !== undefined ? config.live : config.value
    const accountValue = account.live !== undefined ? account.live : account.value
    const configuration = useMemo<Snapshot<Configuration>>(
        () => ({
            value:
                configValue && "userId" in configValue && configValue.userId === userId
                    ? configValue
                    : null,
            live: ready ? config.live : undefined
        }),
        [configValue, config.live, userId, ready]
    )
    const accountStatus = useMemo<Snapshot<AccountStatus>>(
        () => ({
            value:
                userId && accountValue && "userId" in accountValue && accountValue.userId === userId
                    ? accountValue
                    : null,
            live: ready ? (userId ? account.live : null) : undefined
        }),
        [accountValue, account.live, userId, ready]
    )

    return (
        <ConfigurationContext.Provider value={configuration}>
            <AccountContext.Provider value={accountStatus}>{children}</AccountContext.Provider>
        </ConfigurationContext.Provider>
    )
}

export function useAppConfiguration() {
    const value = useContext(ConfigurationContext)
    if (!value) throw new Error("AppBootProvider is missing")
    return value
}

export function useAccountStatus() {
    const value = useContext(AccountContext)
    if (!value) throw new Error("AppBootProvider is missing")
    return value
}

// Side-effect consumers retain the fresh-only behavior of their former queries.
export const useLiveUserSettings = () => useAppConfiguration().live?.settings ?? undefined
export const useToolAvailability = () => useAppConfiguration().value?.toolAvailability ?? null
export const useBillingSummary = () => useAccountStatus().live?.billing

const EMPTY_PERSONAS: Configuration["personas"] = { builtIns: [], userPersonas: [] }
export function usePersonaPickerOptions(acceptUpdates = true) {
    const { value } = useAppConfiguration()
    const options = value?.personas ?? EMPTY_PERSONAS
    const userId = value?.userId ?? null
    const [snapshot, setSnapshot] = useState({ userId, options })
    useEffect(() => {
        if (acceptUpdates)
            setSnapshot((previous) =>
                previous.userId === userId && previous.options === options
                    ? previous
                    : { userId, options }
            )
    }, [acceptUpdates, userId, options])
    // Preserve the picker's opening-animation pause without adding a subscription.
    return acceptUpdates || snapshot.userId !== userId ? options : snapshot.options
}

export const useActiveSandbox = () => useAccountStatus().live?.activeSandbox
export const useImportJobs = () => useAccountStatus().live?.importJobs
export const useDevModelLimits = (modelId: string | null | undefined, enabled: boolean) => {
    const { value } = useAppConfiguration()
    return enabled && modelId ? (value?.devModelLimits?.[modelId] ?? null) : null
}
