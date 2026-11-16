import { SettingsLayout } from "@/components/settings/settings-layout"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import type { ComponentProps } from "react"
import { SkillsBrowse } from "./skills-browse"
import { SkillsManage } from "./skills-manage"

export type SkillsSettingsTab = "manage" | "browse"

/**
 * The Skills settings page: one tab for the skills you have, one for finding more. The tool
 * flyout's Browse skills lands on the second.
 */
export function SkillsSettings({
    tab,
    onTabChange,
    manage,
    browse
}: {
    tab: SkillsSettingsTab
    onTabChange: (tab: SkillsSettingsTab) => void
    manage: Omit<ComponentProps<typeof SkillsManage>, "onBrowse">
    browse: ComponentProps<typeof SkillsBrowse>
}) {
    return (
        <SettingsLayout
            title="Skills"
            description="Know-how Silky picks up when a task calls for it."
        >
            <Tabs
                value={tab}
                onValueChange={(value) => onTabChange(value as SkillsSettingsTab)}
                className="space-y-6"
            >
                <TabsList className="grid w-full grid-cols-2 sm:mx-auto sm:min-w-[28rem] sm:max-w-[36rem]">
                    <TabsTrigger value="manage" className="text-center">
                        Your skills
                    </TabsTrigger>
                    <TabsTrigger value="browse" className="text-center">
                        Browse
                    </TabsTrigger>
                </TabsList>

                <TabsContent value="manage">
                    <SkillsManage {...manage} onBrowse={() => onTabChange("browse")} />
                </TabsContent>

                <TabsContent value="browse">
                    <SkillsBrowse {...browse} />
                </TabsContent>
            </Tabs>
        </SettingsLayout>
    )
}
