import type { Meta, StoryObj } from "@storybook/react-vite"
import { MemoryToolRenderer } from "@/components/renderers/memory-tool"

const meta = {
    title: "Tools/Memory change",
    component: MemoryToolRenderer,
    tags: ["autodocs"],
    parameters: { docs: { description: { component: "messages.tsx memory confirmation card." } } },

    args: {
        toolInvocation: {
            toolCallId: "memory-change",
            state: "output-available",
            input: {},
            output: {
                kind: "prepared_memory_change",
                status: "pending_confirmation",
                operation: "add",
                content: "Prefers concise answers."
            }
        }
    }
} satisfies Meta<typeof MemoryToolRenderer>
export default meta
type Story = StoryObj<typeof meta>
export const Playground: Story = {}
export const Saving: Story = {
    args: { toolInvocation: { toolCallId: "memory-change", state: "input-available", input: {} } }
}
