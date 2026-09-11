import type { Meta, StoryObj } from "@storybook/react-vite"
import { MemoryRetrievalToolRenderer } from "@/components/renderers/memory-retrieval-tool"

const meta = {
    title: "Tools/Memory retrieval",
    component: MemoryRetrievalToolRenderer,
    tags: ["autodocs"],
    parameters: {
        docs: { description: { component: "messages.tsx search/profile memory results." } }
    },
    args: {
        mode: "search",
        toolInvocation: {
            toolCallId: "demo-memory",
            state: "output-available",
            input: { query: "preferences" },
            output: {
                success: true,
                results: [
                    { content: "Prefers concise answers." },
                    { content: "Uses TypeScript and Bun." }
                ]
            }
        }
    }
} satisfies Meta<typeof MemoryRetrievalToolRenderer>
export default meta
type Story = StoryObj<typeof meta>
export const Playground: Story = {}
export const Loading: Story = {
    args: {
        toolInvocation: {
            toolCallId: "demo-memory",
            state: "input-available",
            input: { query: "preferences" }
        }
    }
}
export const Empty: Story = {
    args: {
        toolInvocation: {
            toolCallId: "demo-memory",
            state: "output-available",
            input: {},
            output: { success: true, results: [] }
        }
    }
}
export const Failed: Story = {
    args: {
        toolInvocation: {
            toolCallId: "demo-memory",
            state: "output-available",
            input: {},
            output: { success: false, error: "Memory search unavailable." }
        }
    }
}
