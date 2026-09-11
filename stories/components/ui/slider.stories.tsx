import type { Meta, StoryObj } from "@storybook/react-vite"
import { Slider } from "@/components/ui/slider"

const meta = {
    title: "UI/Slider",
    component: Slider,
    tags: ["autodocs"],
    parameters: {
        docs: {
            description: {
                component: "Avatar zoom in persona-avatar-cropper.tsx: 1–3× with 0.01 increments."
            }
        }
    },
    args: {
        defaultValue: [1],
        min: 1,
        max: 3,
        step: 0.01,
        className: "flex-1",
        "aria-label": "Avatar zoom"
    },
    render: (args) => (
        <div className="flex max-w-sm items-center gap-3">
            <span className="text-muted-foreground text-xs">1x</span>
            <Slider {...args} />
            <span className="text-muted-foreground text-xs">3x</span>
        </div>
    )
} satisfies Meta<typeof Slider>
export default meta
type Story = StoryObj<typeof meta>
export const Playground: Story = {}
export const ZoomedIn: Story = { args: { defaultValue: [2.5] } }
