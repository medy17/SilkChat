import type { Meta, StoryObj } from "@storybook/react-vite"
import { fn } from "storybook/test"
import { ThreadItem } from "@/components/threads/thread-item"
import { demoThread } from "../../../.storybook/fixtures"
import { SidebarProvider } from "@/components/ui/sidebar"
const meta = {
    title: "Sidebar/Thread",
    component: ThreadItem,
    tags: ["autodocs"],
    parameters: {
        docs: {
            description: {
                component: "threads/sidebar-sections.tsx conversation rows and context menu."
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
        thread: demoThread,
        isActive: false,
        onOpenRenameDialog: fn(),
        onOpenMoveDialog: fn(),
        onOpenDeleteDialog: fn(),
        onToggleSelection: fn()
    }
} satisfies Meta<typeof ThreadItem>
export default meta
type Story = StoryObj<typeof meta>
export const Playground: Story = {}
export const Active: Story = { args: { isActive: true } }
export const Pinned: Story = { args: { thread: { ...demoThread, pinned: true } } }
export const Selected: Story = {
    args: { isSelectionMode: true, isSelected: true, selectedThreadCount: 1 }
}
export const Branched: Story = { args: { thread: { ...demoThread, isBranched: true } } }
