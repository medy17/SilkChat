import type { Meta, StoryObj } from "@storybook/react-vite"
import { fn } from "storybook/test"
import { ThreadsSidebarHeader } from "@/components/threads/sidebar-header"
import { SidebarProvider } from "@/components/ui/sidebar"
const meta = {
    title: "Sidebar/Header",
    component: ThreadsSidebarHeader,
    tags: ["autodocs"],
    parameters: {
        docs: {
            description: {
                component:
                    "threads-sidebar.tsx header; library mode changes its mark and navigation actions."
            }
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
    args: { onNewChat: fn(), onImportClick: fn(), onSearchClick: fn(), isLibraryMode: false }
} satisfies Meta<typeof ThreadsSidebarHeader>
export default meta
type Story = StoryObj<typeof meta>
export const Playground: Story = {}
export const Library: Story = { args: { isLibraryMode: true } }
