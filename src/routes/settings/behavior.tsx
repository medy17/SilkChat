import { SettingsLayout } from "@/components/settings/settings-layout"
import { createFileRoute } from "@tanstack/react-router"
import { BehaviorSettingsContent } from "./customization"

export const Route = createFileRoute("/settings/behavior")({
    component: BehaviorSettingsRoute
})

function BehaviorSettingsRoute() {
    return (
        <SettingsLayout
            title="Behavior"
            description="Control composer behavior, assistant defaults, and saved context."
        >
            <BehaviorSettingsContent />
        </SettingsLayout>
    )
}
