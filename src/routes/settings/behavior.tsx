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
            description="Control the assistant's default tone, context, and how it addresses you."
        >
            <BehaviorSettingsContent />
        </SettingsLayout>
    )
}
