import type { Meta, StoryObj } from "@storybook/react-vite"
import { Separator } from "@/components/ui/separator"

const meta = {
    title: "UI/Separator",
    component: Separator,
    tags: ["autodocs"],
    args: { className: "my-6" }
} satisfies Meta<typeof Separator>
export default meta
type Story = StoryObj<typeof meta>
export const Playground: Story = {}
