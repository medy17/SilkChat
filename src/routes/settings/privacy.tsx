import { SettingsLayout } from "@/components/settings/settings-layout"
import { Card } from "@/components/ui/card"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
import { MODEL_ROUTING_OPTIONS } from "@/convex/lib/model_routing"
import type { ModelRoutingMode } from "@/convex/schema/model_routing"
import { api } from "@/convex/_generated/api"
import { useSession } from "@/hooks/auth-hooks"
import { cn } from "@/lib/utils"
import { useConvexMutation, useConvexQuery } from "@convex-dev/react-query"
import { createFileRoute } from "@tanstack/react-router"
import { CheckCircle, Loader2 } from "lucide-react"
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
    const [isUpdatingRouting, setIsUpdatingRouting] = useState(false)
    const userId = session?.user?.id
    const userSettings = useConvexQuery(api.settings.getUserSettings, userId ? {} : "skip")
    const updateSettings = useConvexMutation(api.settings.updateUserSettingsPartial)

    const handleRoutingChange = async (mode: string) => {
        if (!userId || !MODEL_ROUTING_OPTIONS.some((option) => option.value === mode)) return
        setIsUpdatingRouting(true)
        try {
            await updateSettings({ modelRouting: mode as ModelRoutingMode })
            toast.success("Model routing updated")
        } catch (error) {
            console.error("Failed to update model routing:", error)
            toast.error("Failed to update model routing")
        } finally {
            setIsUpdatingRouting(false)
        }
    }

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
            description="Choose how model requests are routed and manage optional usage analytics."
        >
            {!userSettings || "error" in userSettings ? (
                <div className="flex items-center justify-center p-8">
                    <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                </div>
            ) : (
                <div className="space-y-4">
                    <section
                        className="space-y-4 border-border border-b pb-6"
                        aria-labelledby="model-routing-heading"
                    >
                        <div className="space-y-1.5">
                            <h2 id="model-routing-heading" className="font-medium text-base">
                                Model routing
                            </h2>
                        </div>
                        <div
                            role="radiogroup"
                            aria-labelledby="model-routing-heading"
                            aria-busy={isUpdatingRouting}
                            className="grid max-w-3xl grid-cols-1 gap-2 sm:grid-cols-3 sm:gap-3"
                        >
                            {MODEL_ROUTING_OPTIONS.map((option) => {
                                const isSelected =
                                    (userSettings.modelRouting ?? "silkchat") === option.value

                                return (
                                    <label
                                        key={option.value}
                                        className={cn(
                                            "cursor-pointer rounded-[var(--radius-xl)] border-0 bg-muted/20 p-3 transition-all duration-200 hover:bg-muted/40 sm:p-4 [&:has(input:focus-visible)]:ring-2 [&:has(input:focus-visible)]:ring-ring",
                                            isSelected
                                                ? "bg-primary/5 ring-1 ring-primary/20"
                                                : "hover:ring-1 hover:ring-border",
                                            isUpdatingRouting && "cursor-wait opacity-60"
                                        )}
                                    >
                                        <input
                                            type="radio"
                                            name="model-routing"
                                            value={option.value}
                                            checked={isSelected}
                                            disabled={isUpdatingRouting}
                                            onChange={() => handleRoutingChange(option.value)}
                                            aria-labelledby={`routing-${option.value}-label`}
                                            aria-describedby={`routing-${option.value}-description`}
                                            className="sr-only"
                                        />
                                        <div className="flex min-w-0 flex-col gap-2">
                                            <div className="flex items-center gap-1.5">
                                                <span
                                                    id={`routing-${option.value}-label`}
                                                    className="font-medium text-foreground text-sm"
                                                >
                                                    {option.label}
                                                </span>
                                                {isSelected && (
                                                    <CheckCircle
                                                        className="ml-auto size-4 shrink-0 text-primary"
                                                        aria-hidden="true"
                                                    />
                                                )}
                                            </div>
                                            <p
                                                id={`routing-${option.value}-description`}
                                                className="min-h-10 text-muted-foreground text-xs leading-5"
                                            >
                                                {option.description}
                                            </p>
                                        </div>
                                    </label>
                                )
                            })}
                        </div>
                    </section>
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
