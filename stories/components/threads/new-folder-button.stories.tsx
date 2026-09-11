import type { Meta, StoryObj } from "@storybook/react-vite"
import { fn } from "storybook/test"
import { NewFolderDialog } from "@/components/threads/new-folder-button"
import { SidebarProvider } from "@/components/ui/sidebar"
const meta = {
    title: "Sidebar/New folder",
    component: NewFolderDialog,
    tags: ["autodocs"],
    parameters: {
        docs: {
            description: {
                component:
                    "SidebarDialogsContainer and NewFolderButton folder creation; mutation is mocked."
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
    args: { open: true, onOpenChange: fn() }
} satisfies Meta<typeof NewFolderDialog>
export default meta
type Story = StoryObj<typeof meta>
export const Playground: Story = {}
