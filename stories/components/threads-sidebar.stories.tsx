import type { Meta, StoryObj } from "@storybook/react-vite"
import { ThreadsSidebar } from "@/components/threads-sidebar"
import { SidebarProvider } from "@/components/ui/sidebar"
const meta = {
    title: "Sidebar/Full sidebar",
    component: ThreadsSidebar,
    parameters: { layout: "fullscreen" },
    args: {},
    decorators: [
        (Story) => (
            <SidebarProvider>
                <Story />
            </SidebarProvider>
        )
    ]
} satisfies Meta<typeof ThreadsSidebar>
export default meta
type Story = StoryObj<typeof meta>
export const Playground: Story = {}
