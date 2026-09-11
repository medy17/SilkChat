import type { Meta, StoryObj } from "@storybook/react-vite"
import * as C from "@/components/ui/toggle-group"

const meta = {
    title: "Available primitives/Toggle Group",
    parameters: { layout: "padded" },
    render: () => (
        <C.ToggleGroup type="single" defaultValue="center" aria-label="Alignment">
            {["left", "center", "right"].map((value) => (
                <C.ToggleGroupItem key={value} value={value} aria-label={value}>
                    {value}
                </C.ToggleGroupItem>
            ))}
        </C.ToggleGroup>
    )
} satisfies Meta
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
