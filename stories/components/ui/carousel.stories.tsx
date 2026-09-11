import type { Meta, StoryObj } from "@storybook/react-vite"
import * as C from "@/components/ui/carousel"

const meta = {
    title: "Available primitives/Carousel",
    parameters: { layout: "padded" },
    render: () => (
        <C.Carousel className="mx-12 max-w-sm">
            <C.CarouselContent>
                {["First", "Second", "Third"].map((label) => (
                    <C.CarouselItem key={label}>
                        <div className="flex h-48 items-center justify-center bg-secondary">
                            {label} slide
                        </div>
                    </C.CarouselItem>
                ))}
            </C.CarouselContent>
            <C.CarouselPrevious />
            <C.CarouselNext />
        </C.Carousel>
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
