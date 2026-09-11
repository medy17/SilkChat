import type { Meta, StoryObj } from "@storybook/react-vite"
import * as C from "@/components/ui/aspect-ratio"

const meta = {
    title: "Available primitives/Aspect Ratio",
    parameters: { layout: "padded" },
    render: () => (
        <div className="w-80 max-w-full">
            <C.AspectRatio ratio={16 / 9}>
                <img
                    src="/storybook/sample.svg"
                    alt="Abstract sample"
                    className="h-full w-full object-cover"
                />
            </C.AspectRatio>
        </div>
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
