import { DevRuntime } from "@/components/dev/dev-runtime"
import { DevUtilityDock } from "@/components/dev/dev-utility-dock"
import { TelemetryIdentity } from "@/components/telemetry-identity"
import { ThemeProvider } from "@/components/theme-provider"
import { Toaster } from "@/components/ui/sonner"
import { authClient } from "@/lib/auth-client"
import { useDevDisableAnimations } from "@/lib/dev-overrides"
import { installStaleAssetRecovery } from "@/lib/stale-asset-recovery"
import { sanitizePostHogEvent } from "@/lib/telemetry/sanitize"
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
    const posthogHost = optionalBrowserEnv("VITE_POSTHOG_HOST")

    const app = (
        <AuthQueryProvider>
            <ThemeProvider>
                <AuthUIProviderTanstack
                    authClient={authClient}
                    navigate={(href) => router.navigate({ href })}
                    replace={(href) => router.navigate({ href, replace: true })}
                    Link={({ href, ...props }) => <Link to={href} {...props} />}
                >
                    <TelemetryIdentity />
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
                    {posthogKey && posthogHost ? (
                        <PostHogProvider
                            apiKey={posthogKey}
                            options={{
                                api_host: posthogHost,
                                defaults: "2026-06-25",
                                autocapture: false,
                                capture_pageview: "history_change",
                                capture_pageleave: true,
                                capture_exceptions: true,
                                capture_performance: true,
                                person_profiles: "identified_only",
                                respect_dnt: true,
                                opt_out_capturing_by_default: true,
                                opt_out_persistence_by_default: true,
                                disable_capture_url_hashes: true,
                                mask_all_text: true,
                                mask_all_element_attributes: true,
                                mask_personal_data_properties: true,
                                custom_personal_data_properties: ["email", "token", "code"],
                                session_recording: {
                                    maskAllInputs: true,
                                    maskTextSelector: "*",
                                    recordCrossOriginIframes: false
                                },
                                before_send: sanitizePostHogEvent
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
