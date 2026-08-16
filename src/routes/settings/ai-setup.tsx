import { SettingsLayout } from "@/components/settings/settings-layout"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { createFileRoute, useNavigate } from "@tanstack/react-router"
import { ModelsSettingsContent } from "./models"
import { ProvidersSettingsContent } from "./providers"

type AISetupTab = "providers" | "models"

export const Route = createFileRoute("/settings/ai-setup")({
    validateSearch: (search: Record<string, unknown>) => ({
        tab:
            search.tab === "models" || search.tab === "providers"
                ? (search.tab as AISetupTab)
                : "providers"
    }),
    component: AISetupSettingsRoute
})

function AISetupSettingsRoute() {
    const navigate = useNavigate({ from: "/settings/ai-setup" })
    const search = Route.useSearch()

    return (
        <SettingsLayout title="AI Setup" description="Configure AI providers and available models.">
            <Tabs
                value={search.tab}
                onValueChange={(value) =>
                    navigate({
                        search: (prev) => ({
                            ...prev,
                            tab: value as AISetupTab
                        }),
                        replace: true
                    })
                }
                className="space-y-6"
            >
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                    <TabsList className="grid w-full grid-cols-2 sm:mx-auto sm:min-w-[28rem] sm:max-w-[36rem]">
                        <TabsTrigger value="providers" className="text-center">
                            Providers
                        </TabsTrigger>
                        <TabsTrigger value="models" className="text-center">
                            Models
                        </TabsTrigger>
                    </TabsList>
                </div>

                <TabsContent value="providers">
                    <ProvidersSettingsContent />
                </TabsContent>

                <TabsContent value="models">
                    <ModelsSettingsContent />
                </TabsContent>
            </Tabs>
        </SettingsLayout>
    )
}
