import { SettingsLayout } from "@/components/settings/settings-layout"
import { Card } from "@/components/ui/card"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
import { api } from "@/convex/_generated/api"
import { useSession } from "@/hooks/auth-hooks"
import { useConvexMutation, useConvexQuery } from "@convex-dev/react-query"
import { createFileRoute } from "@tanstack/react-router"
import { Loader2 } from "lucide-react"
import { usePostHog } from "posthog-js/react"
import { useState } from "react"
import { toast } from "sonner"

export const Route = createFileRoute("/settings/privacy")({
    component: PrivacySettingsRoute
})

function PrivacySettingsRoute() {
    const { data: session } = useSession()
    const posthog = usePostHog()
    const [isUpdating, setIsUpdating] = useState(false)
    const userId = session?.user?.id
    const userSettings = useConvexQuery(api.settings.getUserSettings, userId ? {} : "skip")
    const updateSettings = useConvexMutation(api.settings.updateUserSettingsPartial)

    const handleTelemetryToggle = async (enabled: boolean) => {
        if (!userId) return

        setIsUpdating(true)
        if (enabled) {
            posthog.opt_in_capturing({ captureEventName: false })
        } else {
            posthog.stopSessionRecording()
            posthog.opt_out_capturing()
        }

        try {
            await updateSettings({ telemetryEnabled: enabled })
            toast.success(enabled ? "Usage analytics enabled" : "Usage analytics disabled")
        } catch (error) {
            if (enabled) {
                posthog.stopSessionRecording()
                posthog.opt_out_capturing()
            } else {
                posthog.opt_in_capturing({ captureEventName: false })
            }
            console.error("Failed to update telemetry preference:", error)
            toast.error("Failed to update usage analytics")
        } finally {
            setIsUpdating(false)
        }
    }

    return (
        <SettingsLayout
            title="Privacy"
            description="Choose whether Silkchat may collect optional usage data."
        >
            {!userSettings || "error" in userSettings ? (
                <div className="flex items-center justify-center p-8">
                    <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                </div>
            ) : (
                <div className="space-y-4">
                    <Card className="p-4">
                        <div className="flex items-start justify-between gap-4">
                            <div className="space-y-1.5">
                                <Label htmlFor="usage-analytics" className="text-base">
                                    Share usage analytics
                                </Label>
                                <p
                                    id="usage-analytics-description"
                                    className="text-muted-foreground text-sm"
                                >
                                    This helps us improve Silkchat and fix issues faster. We do not
                                    collect chat prompts, model responses, attachment contents,
                                    filenames, email addresses, and provider credentials.
                                </p>
                            </div>
                            <Switch
                                id="usage-analytics"
                                checked={userSettings.telemetryEnabled !== false}
                                onCheckedChange={handleTelemetryToggle}
                                disabled={isUpdating}
                                aria-describedby="usage-analytics-description"
                                aria-label="Share usage analytics"
                            />
                        </div>
                    </Card>
                </div>
            )}
        </SettingsLayout>
    )
}
