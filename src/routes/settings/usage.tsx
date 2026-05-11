import { UsageDashboard } from "@/components/analytics/usage-dashboard"
import { SettingsLayout } from "@/components/settings/settings-layout"
import { createFileRoute } from "@tanstack/react-router"

export const Route = createFileRoute("/settings/usage")({
    component: UsageAnalyticsPage
})

function UsageAnalyticsPage() {
    return (
        <SettingsLayout
            title="Usage"
            description="Review request volume, token usage, and model activity across your account."
        >
            <UsageDashboard />
        </SettingsLayout>
    )
}
