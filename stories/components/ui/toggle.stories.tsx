import type { Meta, StoryObj } from "@storybook/react-vite"
import { Toggle } from "@/components/ui/toggle"

const meta = {
    title: "Available primitives/Toggle",
    component: Toggle,
    tags: ["autodocs"],
    args: { children: "Bold", "aria-label": "Bold text", disabled: false }
} satisfies Meta<typeof Toggle>
export default meta
type Story = StoryObj<typeof meta>
export const UnusedInApp: Story = {
    parameters: {
        docs: {
            description: {
                story: "No current app call site. This is an available primitive API example, not a SilkChat screen."
            }
        }
    }
}
export const Pressed: Story = { args: { defaultPressed: true } }
