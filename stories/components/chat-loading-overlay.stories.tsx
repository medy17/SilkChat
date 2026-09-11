import type { Meta, StoryObj } from "@storybook/react-vite"
import { ChatLoadingOverlay } from "@/components/chat-loading-overlay"
const meta = {
    title: "Chat/Loading overlay",
    component: ChatLoadingOverlay,
    parameters: { layout: "fullscreen" },
    args: { label: "Loading conversation" },
    decorators: [
        (Story) => (
            <div className="relative min-h-80">
                <Story />
            </div>
        )
    ]
} satisfies Meta<typeof ChatLoadingOverlay>
export default meta
type Story = StoryObj<typeof meta>
export const Playground: Story = {}
