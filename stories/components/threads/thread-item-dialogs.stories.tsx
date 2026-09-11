import type { Meta, StoryObj } from "@storybook/react-vite"
import { fn } from "storybook/test"
import { ThreadItemDialogs } from "@/components/threads/thread-item-dialogs"
import { demoThread, demoProject } from "../../../.storybook/fixtures"
import { SidebarProvider } from "@/components/ui/sidebar"
const meta = {
    title: "Sidebar/Thread dialogs",
    component: ThreadItemDialogs,
    tags: ["autodocs"],
    parameters: {
        docs: {
            description: {
                component: "threads/sidebar-dialogs-container.tsx rename, move and delete flows."
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
    args: {
        currentThread: demoThread,
        projects: [demoProject],
        showRenameDialog: true,
        showDeleteDialog: false,
        showMoveDialog: false,
        onCloseRenameDialog: fn(),
        onCloseDeleteDialog: fn(),
        onCloseMoveDialog: fn()
    }
} satisfies Meta<typeof ThreadItemDialogs>
export default meta
type Story = StoryObj<typeof meta>
export const Playground: Story = {}
export const Move: Story = { args: { showRenameDialog: false, showMoveDialog: true } }
export const Delete: Story = { args: { showRenameDialog: false, showDeleteDialog: true } }
