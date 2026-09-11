import type { Meta, StoryObj } from "@storybook/react-vite"
import { WebSearchGroupRenderer } from "@/components/renderers/web-search-ui"
const meta = {
    title: "Tools/Web search",
    component: WebSearchGroupRenderer,
    tags: ["autodocs"],
    parameters: {
        docs: { description: { component: "messages.tsx grouped web-search results." } }
    },
    args: {
        searches: [
            {
                toolCallId: "search",
                query: "TypeScript documentation",
                status: "succeeded",
                results: [
                    {
                        title: "TypeScript documentation",
                        url: "https://www.typescriptlang.org/docs/",
                        description: "Guides and reference documentation."
                    }
                ]
            }
        ]
    },
    decorators: [
        (Story) => (
            <div className="w-full max-w-3xl">
                <Story />
            </div>
        )
    ]
} satisfies Meta<typeof WebSearchGroupRenderer>
export default meta
type Story = StoryObj<typeof meta>
export const Playground: Story = {}
export const Searching: Story = {
    args: {
        searches: [
            {
                toolCallId: "search",
                query: "TypeScript documentation",
                status: "running",
                results: []
            }
        ]
    }
}
export const Failed: Story = {
    args: {
        searches: [
            {
                toolCallId: "search",
                query: "TypeScript documentation",
                status: "failed",
                error: "Search is unavailable.",
                results: []
            }
        ]
    }
}
