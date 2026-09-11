import type { Meta, StoryObj } from "@storybook/react-vite"
import { ThreadExportButton } from "@/components/thread-export-button"
import { SidebarProvider } from "@/components/ui/sidebar"
const meta = {
    title: "Available components/Thread export",
    component: ThreadExportButton,
    args: { threadId: "storybook-thread" },
    decorators: [
        (Story) => (
            <SidebarProvider className="min-h-0">
                <div className="relative h-[70vh] w-full">
                    <Story />
                </div>
            </SidebarProvider>
        )
    ]
} satisfies Meta<typeof ThreadExportButton>
export default meta
type Story = StoryObj<typeof meta>
export const Playground: Story = {}
