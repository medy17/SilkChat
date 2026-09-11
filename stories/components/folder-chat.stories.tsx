import type { Meta, StoryObj } from "@storybook/react-vite"
import { FolderChat } from "@/components/folder-chat"
import { demoProject } from "../../.storybook/fixtures"
import { SidebarProvider } from "@/components/ui/sidebar"
const meta = {
    title: "Chat/Folder page",
    component: FolderChat,
    parameters: { layout: "fullscreen" },
    args: { folderId: demoProject._id },
    decorators: [
        (Story) => (
            <SidebarProvider>
                <Story />
            </SidebarProvider>
        )
    ]
} satisfies Meta<typeof FolderChat>
export default meta
type Story = StoryObj<typeof meta>
export const Playground: Story = {}
