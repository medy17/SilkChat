import type { Meta, StoryObj } from "@storybook/react-vite"
import { fn } from "storybook/test"
import { Button } from "@/components/ui/button"

const meta = {
    title: "UI/Button",
    component: Button,
    tags: ["autodocs"],
    args: {
        children: "Send message",
        variant: "default",
        size: "default",
        disabled: false,
        onClick: fn()
    }
} satisfies Meta<typeof Button>
export default meta
type Story = StoryObj<typeof meta>
export const Playground: Story = {}
export const Secondary: Story = { args: { variant: "secondary" } }
export const Destructive: Story = { args: { variant: "destructive" } }
export const Disabled: Story = { args: { disabled: true } }
