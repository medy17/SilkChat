import type { Meta, StoryObj } from "@storybook/react-vite"
import { fn } from "storybook/test"
import { ChatActions } from "@/components/chat-actions"
const meta = {
    title: "Chat/Message actions",
    component: ChatActions,
    tags: ["autodocs"],
    parameters: { docs: { description: { component: "messages.tsx message footer actions." } } },
    args: {
        role: "assistant",
        message: {
            id: "answer",
            role: "assistant",
            parts: [{ type: "text", text: "Here is the answer." }]
        },
        onRetry: fn(),
        onBranch: fn(),
        onEdit: fn()
    },
    decorators: [
        (Story) => (
            <div className="w-full max-w-3xl">
                <Story />
            </div>
        )
    ]
} satisfies Meta<typeof ChatActions>
export default meta
type Story = StoryObj<typeof meta>
export const Playground: Story = {}
export const Shared: Story = { args: { copyOnly: true } }
export const Editing: Story = { args: { editing: true, onCancelEdit: fn() } }
