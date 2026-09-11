import type { Meta, StoryObj } from "@storybook/react-vite"
import { fn } from "storybook/test"
import { MultimodalInput } from "@/components/multimodal-input"
const meta = {
    title: "Chat/Composer",
    component: MultimodalInput,
    tags: ["autodocs"],
    parameters: {
        docs: {
            description: {
                component:
                    "chat.tsx and folder-chat.tsx composer. Submission is an action stub; no model request is sent."
            }
        }
    },
    args: { status: "ready", onSubmit: fn(), showIntentShortcuts: true },
    decorators: [
        (Story) => (
            <div className="w-full max-w-3xl">
                <Story />
            </div>
        )
    ]
} satisfies Meta<typeof MultimodalInput>
export default meta
type Story = StoryObj<typeof meta>
export const Playground: Story = {}
export const Streaming: Story = { args: { status: "streaming" } }
export const PdfConversation: Story = { args: { threadHasPdfAttachments: true } }
