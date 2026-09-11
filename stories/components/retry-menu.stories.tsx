import type { Meta, StoryObj } from "@storybook/react-vite"
import { fn } from "storybook/test"
import { RetryMenu } from "@/components/retry-menu"
const meta = {
    title: "Chat/Retry menu",
    component: RetryMenu,
    tags: ["autodocs"],
    parameters: {
        docs: {
            description: {
                component: "chat-actions.tsx and BlockedToolCard retry/model selection."
            }
        }
    },
    args: { onRetry: fn() },
    decorators: [
        (Story) => (
            <div className="w-full max-w-3xl">
                <Story />
            </div>
        )
    ]
} satisfies Meta<typeof RetryMenu>
export default meta
type Story = StoryObj<typeof meta>
export const Playground: Story = {}
export const PdfRequired: Story = { args: { requiresNativePdf: true } }
