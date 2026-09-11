import type { Meta, StoryObj } from "@storybook/react-vite"
import { fn } from "storybook/test"
import { CommandK } from "@/components/commandk"

const meta = {
    title: "Chat/Search conversations",
    component: CommandK,
    tags: ["autodocs"],
    parameters: {
        docs: {
            description: {
                component: "Chat keyboard search dialog, opened with the command shortcut."
            }
        }
    },

    args: { open: true, onOpenChange: fn() }
} satisfies Meta<typeof CommandK>
export default meta
type Story = StoryObj<typeof meta>
export const Playground: Story = {}
