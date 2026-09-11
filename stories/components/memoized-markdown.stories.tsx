import type { Meta, StoryObj } from "@storybook/react-vite"
import { MemoizedMarkdown } from "@/components/memoized-markdown"

const meta = {
    title: "Chat/Markdown",
    component: MemoizedMarkdown,
    tags: ["autodocs"],
    parameters: {
        docs: {
            description: {
                component: "messages.tsx assistant message body; reasoning.tsx expanded reasoning."
            }
        }
    },
    args: {
        content:
            "## A useful response\n\nText with **emphasis**, `inline code`, and a list:\n\n- First step\n- Second step\n\n> A short quotation.\n\n| Item | Result |\n| --- | --- |\n| Alpha | 42 |\n\n```typescript\nconst answer = 42;\n```",
        isAnimating: false
    }
} satisfies Meta<typeof MemoizedMarkdown>
export default meta
type Story = StoryObj<typeof meta>
export const Playground: Story = {}
export const Streaming: Story = {
    args: {
        content: "Let me work through this.\n\n```typescript\nconst answer =",
        isAnimating: true
    }
}
export const Mathematics: Story = {
    args: { content: "The identity is $a^2+b^2=c^2$.\n\n$$\\int_0^1 x^2 dx = \\frac{1}{3}$$" }
}
