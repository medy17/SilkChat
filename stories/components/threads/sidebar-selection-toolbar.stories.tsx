import type { Meta, StoryObj } from "@storybook/react-vite"
import { fn } from "storybook/test"
import { SelectionToolbar } from "@/components/threads/sidebar-selection-toolbar"
import { demoThread } from "../../../.storybook/fixtures"
import { SidebarProvider } from "@/components/ui/sidebar"
const meta = {
    title: "Sidebar/Selection toolbar",
    component: SelectionToolbar,
    tags: ["autodocs"],
    parameters: {
        docs: { description: { component: "threads-sidebar.tsx bulk selection toolbar." } }
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
        selectedThreads: [demoThread],
        selectedCount: 1,
        isApplyingSelectionAction: false,
        onSelectAllThreads: fn(),
        onBulkTogglePin: fn(),
        onOpenBulkMoveDialog: fn(),
        onOpenBulkDeleteDialog: fn(),
        onExitSelectionMode: fn()
    }
} satisfies Meta<typeof SelectionToolbar>
export default meta
type Story = StoryObj<typeof meta>
export const Playground: Story = {}
export const Busy: Story = { args: { isApplyingSelectionAction: true } }
