import type { Meta, StoryObj } from "@storybook/react-vite"
import { fn } from "storybook/test"
import { BulkDeleteThreadsDialog } from "@/components/threads/sidebar-bulk-dialogs"
const meta = {
    title: "Sidebar/Bulk delete",
    component: BulkDeleteThreadsDialog,
    tags: ["autodocs"],
    parameters: {
        docs: { description: { component: "threads-sidebar.tsx bulk deletion dialog." } }
    },
    args: {
        open: true,
        onOpenChange: fn(),
        selectedThreadsCount: 3,
        isApplyingSelectionAction: false,
        onConfirm: fn()
    },
    decorators: [
        (Story) => (
            <div className="w-full max-w-3xl">
                <Story />
            </div>
        )
    ]
} satisfies Meta<typeof BulkDeleteThreadsDialog>
export default meta
type Story = StoryObj<typeof meta>
export const Playground: Story = {}
export const Deleting: Story = { args: { isApplyingSelectionAction: true } }
