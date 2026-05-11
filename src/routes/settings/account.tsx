import { SettingsLayout } from "@/components/settings/settings-layout"
import { createFileRoute } from "@tanstack/react-router"
import { AccountSettingsContent } from "./profile"

export const Route = createFileRoute("/settings/account")({
    component: AccountSettingsRoute
})

function AccountSettingsRoute() {
    return (
        <SettingsLayout
            title="Account"
            description="Manage your profile, active sessions, and sign-in security."
        >
            <AccountSettingsContent />
        </SettingsLayout>
    )
}
