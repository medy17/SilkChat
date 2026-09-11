import type { Meta, StoryObj } from "@storybook/react-vite"
import { FolderItem } from "@/components/threads/folder-item"
import { demoProject } from "../../../.storybook/fixtures"
import { SidebarProvider } from "@/components/ui/sidebar"
const meta = {
    title: "Sidebar/Folder",
    component: FolderItem,
    tags: ["autodocs"],
    parameters: {
        docs: { description: { component: "threads/sidebar-sections.tsx project folders." } }
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
    args: { project: demoProject, numThreads: 3 }
} satisfies Meta<typeof FolderItem>
export default meta
type Story = StoryObj<typeof meta>
export const Playground: Story = {}
export const Active: Story = { args: { isCurrentFolder: true } }
export const Empty: Story = { args: { numThreads: 0 } }
