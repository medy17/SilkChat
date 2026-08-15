import { SettingsLayout } from "@/components/settings/settings-layout"
import { SupermemoryCard } from "@/components/settings/supermemory-card"
import { api } from "@/convex/_generated/api"
import { useSession } from "@/hooks/auth-hooks"
import { useConvexMutation, useConvexQuery } from "@convex-dev/react-query"
import { createFileRoute, useNavigate } from "@tanstack/react-router"
import { useEffect, useState } from "react"
import { toast } from "sonner"

export const Route = createFileRoute("/settings/ai-options")({
    component: LegacyAIOptionsRedirect
})

function LegacyAIOptionsRedirect() {
    const navigate = useNavigate()

    useEffect(() => {
        navigate({
            to: "/settings/ai-setup",
            search: { tab: "tools" },
            replace: true
        })
    }, [navigate])

    return null
}

export function SearchMemoryToolsSettingsContent() {
    const session = useSession()
    const [isLoading, setIsLoading] = useState(false)

    const userSettings = useConvexQuery(
        api.settings.getUserSettings,
        session.user?.id ? {} : "skip"
    )
    const updateSettings = useConvexMutation(api.settings.updateUserSettingsPartial)

    if (!session.user?.id || !userSettings) return null

    const handleSupermemoryUpdate = async (enabled: boolean, newKey?: string) => {
        if (!session.user) return

        setIsLoading(true)
        try {
            await updateSettings({
                generalProviderUpdates: {
                    supermemory: { enabled, newKey }
                }
            })
            toast.success(`Supermemory ${enabled ? "enabled" : "disabled"}`)
        } catch (error) {
            toast.error("Failed to update Supermemory settings")
            console.error(error)
            throw error
        } finally {
            setIsLoading(false)
        }
    }

    return (
        <div className="space-y-8">
            {/* Supermemory Section */}
            <div className="space-y-4">
                <div>
                    <h3 className="font-semibold text-foreground">AI Memory</h3>
                    <p className="mt-1 text-muted-foreground text-sm">
                        Store and retrieve information across conversations for enhanced AI context
                    </p>
                </div>

                <SupermemoryCard
                    userSettings={userSettings}
                    onSave={handleSupermemoryUpdate}
                    loading={isLoading}
                />
            </div>
        </div>
    )
}

function AIOptionsSettingsPage() {
    return (
        <SettingsLayout
            title="Search, Memory & Tools"
            description="Configure web search, long-term memory, and connected tool servers."
        >
            <SearchMemoryToolsSettingsContent />
        </SettingsLayout>
    )
}
