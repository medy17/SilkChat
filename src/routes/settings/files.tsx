import { SettingsLayout } from "@/components/settings/settings-layout"
import { createFileRoute } from "@tanstack/react-router"
import { FilesSettingsContent } from "./attachments"

export const Route = createFileRoute("/settings/files")({
    component: FilesSettingsRoute
})

function FilesSettingsRoute() {
    return (
        <SettingsLayout
            title="Files"
            description="Manage uploaded attachments and review how much storage you're using."
        >
            <FilesSettingsContent />
        </SettingsLayout>
    )
}
