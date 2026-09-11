import type { Meta, StoryObj } from "@storybook/react-vite"
import { fn } from "storybook/test"
import { StickToBottomButton } from "@/components/stick-to-bottom-button"
const meta = {
    title: "Chat/Scroll to bottom",
    component: StickToBottomButton,
    parameters: { layout: "fullscreen" },
    args: { isAtBottom: false, scrollDirection: "down", scrollToBottom: fn() },
    decorators: [
        (Story) => (
            <div className="relative min-h-80">
                <Story />
            </div>
        )
    ]
} satisfies Meta<typeof StickToBottomButton>
export default meta
type Story = StoryObj<typeof meta>
export const Playground: Story = {}
