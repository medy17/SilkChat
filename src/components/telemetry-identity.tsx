import { api } from "@/convex/_generated/api"
import { useSession } from "@/hooks/auth-hooks"
import { optionalBrowserEnv } from "@/lib/browser-env"
import { isBrowserTelemetryConfigured } from "@/lib/telemetry/browser"
import { getTelemetryEnvironment } from "@/lib/telemetry/events"
import { useConvexQuery } from "@convex-dev/react-query"
import { usePostHog } from "posthog-js/react"
import { useEffect, useRef } from "react"

export function TelemetryIdentity() {
    const { data: session, isPending } = useSession()
    const posthog = usePostHog()
    const identifiedUserId = useRef<string | null>(null)
    const telemetryActive = useRef(false)
    const userId = session?.user?.id
    const userSettings = useConvexQuery(api.settings.getUserSettings, userId ? {} : "skip")

    useEffect(() => {
        if (!isBrowserTelemetryConfigured()) return
        if (isPending) return

        if (!userId) {
            if (identifiedUserId.current || telemetryActive.current) {
                posthog.reset()
                identifiedUserId.current = null
                telemetryActive.current = false
            }
            return
        }

        if (!userSettings || "error" in userSettings) return

        if (userSettings.telemetryEnabled === false) {
            if (telemetryActive.current || identifiedUserId.current) {
                posthog.stopSessionRecording()
                posthog.reset()
                posthog.opt_out_capturing()
                identifiedUserId.current = null
                telemetryActive.current = false
            }
            return
        }

        if (!telemetryActive.current) {
            posthog.opt_in_capturing({ captureEventName: false })
            posthog.register({
                app: "silkchat",
                environment: getTelemetryEnvironment(
                    optionalBrowserEnv("VITE_POSTHOG_ENVIRONMENT")
                ),
                release: optionalBrowserEnv("VITE_APP_RELEASE") || "unknown"
            })
            telemetryActive.current = true
        }

        if (identifiedUserId.current !== userId) {
            if (identifiedUserId.current) {
                posthog.reset()
                posthog.opt_in_capturing({ captureEventName: false })
            }
            posthog.identify(userId)
            posthog.capture("$pageview")
            identifiedUserId.current = userId
        }
    }, [isPending, posthog, userId, userSettings])

    return null
}
