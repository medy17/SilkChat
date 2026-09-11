import type { Meta, StoryObj } from "@storybook/react-vite"
import { GenericToolRenderer } from "@/components/renderers/generic-tool"

const meta = {
    title: "Tools/Generic",
    component: GenericToolRenderer,
    tags: ["autodocs"],
    parameters: {
        docs: {
            description: {
                component:
                    "messages.tsx fallback renderer for tool invocations without a specialized view."
            }
        }
    },
    args: {
        toolName: "Tool",
        toolInvocation: {
            toolCallId: "demo-tool",
            state: "input-available",
            input: { query: "example" }
        }
    }
} satisfies Meta<typeof GenericToolRenderer>
export default meta
type Story = StoryObj<typeof meta>
export const Playground: Story = {}
export const Completed: Story = {
    args: {
        toolInvocation: {
            toolCallId: "demo-tool",
            state: "output-available",
            input: { query: "example" },
            output: { result: "Completed", count: 3 }
        }
    }
}
