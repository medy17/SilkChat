import type { Meta, StoryObj } from "@storybook/react-vite"
import { BlurText } from "@/components/blur-text"

const meta = {
    title: "Brand/About text",
    component: BlurText,
    tags: ["autodocs"],
    parameters: {
        docs: { description: { component: "routes/about.lazy.tsx introductory text." } }
    },
    args: {
        text: "The models will keep changing. What you build around them — your conversations, characters, and files — shouldn\u0027t have to.",
        animateBy: "words",
        direction: "top",
        delay: 90,
        stepDuration: 0.4,
        className:
            "max-w-4xl font-medium text-3xl text-foreground leading-[1.15] tracking-tight md:text-5xl"
    }
} satisfies Meta<typeof BlurText>
export default meta
type Story = StoryObj<typeof meta>
export const Playground: Story = {}
