import type { Meta, StoryObj } from "@storybook/react-vite"
import { Reasoning, ReasoningTrigger, ReasoningContent } from "@/components/reasoning"
const meta = {
    title: "Chat/Reasoning",
    component: Reasoning,
    tags: ["autodocs"],
    parameters: {
        docs: {
            description: {
                component:
                    "Expandable reasoning from messages.tsx. Click the heading to inspect the model's reasoning."
            }
        }
    },
    args: {
        className: "mb-6 max-w-3xl",
        children: (
            <>
                <ReasoningTrigger className="mb-4">Reasoning</ReasoningTrigger>
                <ReasoningContent
                    markdown
                    className="rounded-[var(--radius-lg)] border bg-muted/50"
                >
                    {
                        "Compare the approaches by **complexity**, then check the edge cases before choosing an implementation."
                    }
                </ReasoningContent>
            </>
        )
    }
} satisfies Meta<typeof Reasoning>
export default meta
type Story = StoryObj<typeof meta>
export const Complete: Story = {}
export const Streaming: Story = { args: { isStreaming: true } }
