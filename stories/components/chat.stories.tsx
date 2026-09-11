import type { Meta, StoryObj } from "@storybook/react-vite"
import { Chat } from "@/components/chat"
import { SidebarProvider } from "@/components/ui/sidebar"
const meta = {
    title: "Chat/Full page",
    component: Chat,
    parameters: { layout: "fullscreen" },
    args: { threadId: undefined },
    decorators: [
        (Story) => (
            <SidebarProvider>
                <Story />
            </SidebarProvider>
        )
    ]
} satisfies Meta<typeof Chat>
export default meta
type Story = StoryObj<typeof meta>
export const Playground: Story = {}
