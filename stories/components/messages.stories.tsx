import type { Meta, StoryObj } from "@storybook/react-vite"
import { fn } from "storybook/test"
import { Messages } from "@/components/messages"
const meta = {
    title: "Chat/Conversation",
    component: Messages,
    tags: ["autodocs"],
    parameters: {
        docs: {
            description: {
                component:
                    "chat.tsx message list, including actual message actions and code rendering."
            }
        }
    },
    args: {
        messages: [
            {
                id: "question",
                role: "user",
                parts: [{ type: "text", text: "How do I get started with TypeScript?" }]
            },
            {
                id: "answer",
                role: "assistant",
                parts: [
                    {
                        type: "text",
                        text: 'Start with a small project.\n\n```typescript\nconst greeting: string = "Hello";\n```'
                    }
                ]
            }
        ],
        status: "ready",
        onRetry: fn(),
        onBranch: fn(),
        onEditAndRetry: fn()
    },
    decorators: [
        (Story) => (
            <div className="flex h-[70vh] flex-col">
                <Story />
            </div>
        )
    ]
} satisfies Meta<typeof Messages>
export default meta
type Story = StoryObj<typeof meta>
export const Playground: Story = {}
export const Streaming: Story = { args: { status: "streaming" } }
export const Shared: Story = { args: { copyOnlyActions: true } }
