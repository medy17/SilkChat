import type { Meta, StoryObj } from "@storybook/react-vite"
import { SidebarShortcutsHelper } from "@/components/threads/sidebar-shortcuts-helper"
import { SidebarProvider } from "@/components/ui/sidebar"
const meta = {
    title: "Sidebar/Keyboard shortcuts",
    component: SidebarShortcutsHelper,
    tags: ["autodocs"],
    parameters: {
        docs: {
            description: { component: "threads-sidebar.tsx footer keyboard shortcut popover." }
        }
    },
    decorators: [
        (Story) => (
            <SidebarProvider className="min-h-0">
                <div className="w-80 max-w-full">
                    <Story />
                </div>
            </SidebarProvider>
        )
    ],
    args: {}
} satisfies Meta<typeof SidebarShortcutsHelper>
export default meta
type Story = StoryObj<typeof meta>
export const Playground: Story = {}
