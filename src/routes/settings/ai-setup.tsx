import { SettingsLayout } from "@/components/settings/settings-layout"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { createFileRoute } from "@tanstack/react-router"
import { SearchMemoryToolsSettingsContent } from "./ai-options"
import { ModelsSettingsContent } from "./models"
import { ProvidersSettingsContent } from "./providers"

export const Route = createFileRoute("/settings/ai-setup")({
    component: AISetupSettingsRoute
})

function AISetupSettingsRoute() {
    return (
        <SettingsLayout
            title="AI Setup"
            description="Configure providers, available models, web search, memory, and connected tools."
        >
            <Tabs defaultValue="providers" className="space-y-6">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                    <TabsList className="grid w-full grid-cols-3 sm:mx-auto sm:min-w-[36rem] sm:max-w-[44rem]">
                        <TabsTrigger value="providers" className="text-center">
                            Providers
                        </TabsTrigger>
                        <TabsTrigger value="models" className="text-center">
                            Models
                        </TabsTrigger>
                        <TabsTrigger value="tools" className="text-center">
                            Tools
                        </TabsTrigger>
                    </TabsList>
                </div>

                <TabsContent value="providers">
                    <ProvidersSettingsContent />
                </TabsContent>

                <TabsContent value="models">
                    <ModelsSettingsContent />
                </TabsContent>

                <TabsContent value="tools">
                    <SearchMemoryToolsSettingsContent />
                </TabsContent>
            </Tabs>
        </SettingsLayout>
    )
}
