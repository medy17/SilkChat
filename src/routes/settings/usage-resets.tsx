import {
    GlobalUsageResetHistory,
    UsageResetGrantForm
} from "@/components/moderation/usage-reset-controls"
import { SettingsLayout } from "@/components/settings/settings-layout"
import { Card, CardContent } from "@/components/ui/card"
import { api } from "@/convex/_generated/api"
import { useSession } from "@/hooks/auth-hooks"
import { createFileRoute } from "@tanstack/react-router"
import { useQuery } from "convex/react"

export const Route = createFileRoute("/settings/usage-resets")({
    component: UsageResetsSettingsRoute
})

function UsageResetsSettingsRoute() {
    const { data: session } = useSession()
    const currentUser = useQuery(api.auth.getCurrentUser, session?.user ? {} : "skip")

    return (
        <SettingsLayout title="Usage Resets" description="Reset usage for everyone.">
            {currentUser === undefined ? null : !currentUser?.canModerate ? (
                <p className="text-muted-foreground text-sm">
                    You don't have access to Usage Resets.
                </p>
            ) : (
                <div className="space-y-8">
                    <Card className="py-5">
                        <CardContent className="px-5">
                            <UsageResetGrantForm target={{ kind: "global" }} />
                        </CardContent>
                    </Card>

                    <section className="space-y-4" aria-labelledby="usage-reset-history-heading">
                        <h3
                            id="usage-reset-history-heading"
                            className="font-semibold text-foreground"
                        >
                            Reset history
                        </h3>
                        <GlobalUsageResetHistory />
                    </section>
                </div>
            )}
        </SettingsLayout>
    )
}
