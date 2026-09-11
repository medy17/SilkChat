import type { Meta, StoryObj } from "@storybook/react-vite"
import { Input } from "@/components/ui/input"

const meta = {
    title: "UI/Input",
    component: Input,
    tags: ["autodocs"],
    parameters: {
        docs: {
            description: { component: "Thread rename input in threads/thread-item-dialogs.tsx." }
        }
    },
    args: {
        placeholder: "Enter thread name",
        defaultValue: "Planning a TypeScript project",
        disabled: false,
        type: "text",
        "aria-label": "Thread name"
    }
} satisfies Meta<typeof Input>
export default meta
type Story = StoryObj<typeof meta>
export const Playground: Story = {}
export const Disabled: Story = { args: { disabled: true } }
export const Invalid: Story = { args: { "aria-invalid": true, defaultValue: "Invalid value" } }
