import type { Meta, StoryObj } from "@storybook/react-vite"
import { fn } from "storybook/test"
import { ChatErrorNotice } from "@/components/chat-error-notice"
const meta = {
    title: "Chat/Error notice",
    component: ChatErrorNotice,
    tags: ["autodocs"],
    parameters: { docs: { description: { component: "messages.tsx failed response notice." } } },
    args: {
        error: new Error("The service is temporarily unavailable."),
        onRetry: fn(),
        onSwitchModel: fn()
    },
    decorators: [
        (Story) => (
            <div className="w-full max-w-3xl">
                <Story />
            </div>
        )
    ]
} satisfies Meta<typeof ChatErrorNotice>
export default meta
type Story = StoryObj<typeof meta>
export const Playground: Story = {}
