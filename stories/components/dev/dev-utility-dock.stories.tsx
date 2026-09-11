import type { Meta, StoryObj } from "@storybook/react-vite"
import { DevUtilityDock } from "@/components/dev/dev-utility-dock"
import { SidebarProvider } from "@/components/ui/sidebar"
const meta = {
    title: "Development/Utility dock",
    component: DevUtilityDock,
    args: {},
    decorators: [
        (Story) => (
            <SidebarProvider className="min-h-0">
                <div className="relative h-[70vh] w-full">
                    <Story />
                </div>
            </SidebarProvider>
        )
    ]
} satisfies Meta<typeof DevUtilityDock>
export default meta
type Story = StoryObj<typeof meta>
export const Playground: Story = {}
