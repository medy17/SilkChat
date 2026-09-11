import type { Meta, StoryObj } from "@storybook/react-vite"
import { MemoizedMarkdown } from "@/components/memoized-markdown"
const meta = {
    title: "Chat/Markdown table",
    component: MemoizedMarkdown,
    tags: ["autodocs"],
    args: {
        content:
            "| Approach | Complexity | Best for |\n|---|---|---|\n| Linear scan | O(n) | Small collections |\n| Binary search | O(log n) | Sorted collections |"
    },
    parameters: {
        docs: {
            description: {
                component:
                    "The real MarkdownTable rendered through streamdown-config.ts, as in assistant messages, including its table controls."
            }
        }
    }
} satisfies Meta<typeof MemoizedMarkdown>
export default meta
export const AssistantComparison: StoryObj<typeof meta> = {}
