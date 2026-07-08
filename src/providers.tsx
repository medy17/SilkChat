import { DevRuntime } from "@/components/dev/dev-runtime"
import { DevUtilityDock } from "@/components/dev/dev-utility-dock"
import { ThemeProvider } from "@/components/theme-provider"
import { Toaster } from "@/components/ui/sonner"
import { authClient } from "@/lib/auth-client"
import { useDevDisableAnimations } from "@/lib/dev-overrides"
import { installStaleAssetRecovery } from "@/lib/stale-asset-recovery"
import { ConvexQueryClient } from "@convex-dev/react-query"
import { AuthQueryProvider } from "@daveyplate/better-auth-tanstack"
import { AuthUIProviderTanstack } from "@daveyplate/better-auth-ui/tanstack"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { ClientOnly, Link, useRouter } from "@tanstack/react-router"
import { ConvexQueryCacheProvider } from "convex-helpers/react/cache"
import { MotionConfig } from "motion/react"
import { PostHogProvider } from "posthog-js/react"
import { type ReactNode, useEffect } from "react"
import { browserEnv, optionalBrowserEnv } from "./lib/browser-env"

let convexQueryClientSingleton: ConvexQueryClient | null = null

const defaultQueryOptions = {
    staleTime: 1000 * 60 * 5,
    gcTime: 1000 * 60 * 5
}

export const queryClient: QueryClient = new QueryClient({
    defaultOptions: {
        queries: defaultQueryOptions
    }
})

export function getConvexQueryClient() {
    if (typeof window === "undefined") {
        return null
    }

    if (!convexQueryClientSingleton) {
        convexQueryClientSingleton = new ConvexQueryClient(browserEnv("VITE_CONVEX_URL"))
        convexQueryClientSingleton.connect(queryClient)
        queryClient.setDefaultOptions({
            queries: {
                ...defaultQueryOptions,
                queryKeyHashFn: convexQueryClientSingleton.hashFn(),
                queryFn: convexQueryClientSingleton.queryFn()
            }
        })
    }

    return convexQueryClientSingleton
}

export function Providers({ children }: { children: ReactNode }) {
    const router = useRouter()
    const posthogKey = optionalBrowserEnv("VITE_POSTHOG_KEY")

    const app = (
        <AuthQueryProvider>
            <ThemeProvider>
                <AuthUIProviderTanstack
                    authClient={authClient}
                    navigate={(href) => router.navigate({ href })}
                    replace={(href) => router.navigate({ href, replace: true })}
                    Link={({ href, ...props }) => <Link to={href} {...props} />}
                >
                    <StaleAssetRecovery />

                    <DevMotionConfig>{children}</DevMotionConfig>

                    <DevRuntime />
                    <DevUtilityDock />
                    <Toaster />
                </AuthUIProviderTanstack>
            </ThemeProvider>
        </AuthQueryProvider>
    )

    return (
        <ClientOnly>
            <ConvexQueryCacheProvider>
                <QueryClientProvider client={queryClient}>
                    {posthogKey ? (
                        <PostHogProvider
                            apiKey={posthogKey}
                            options={{
                                api_host: "/api/phr",
                                capture_exceptions: true
                            }}
                        >
                            {app}
                        </PostHogProvider>
                    ) : (
                        app
                    )}
                </QueryClientProvider>
            </ConvexQueryCacheProvider>
        </ClientOnly>
    )
}

function DevMotionConfig({ children }: { children: ReactNode }) {
    const disableAnimations = useDevDisableAnimations()
    return (
        <MotionConfig reducedMotion={disableAnimations ? "always" : "user"}>
            {children}
        </MotionConfig>
    )
}

function StaleAssetRecovery() {
    useEffect(() => {
        return installStaleAssetRecovery()
    }, [])

    return null
}
