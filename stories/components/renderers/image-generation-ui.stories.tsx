import type { Meta, StoryObj } from "@storybook/react-vite"
import { ImageGenerationToolRenderer } from "@/components/renderers/image-generation-ui"

const meta = {
    title: "Tools/Image generation",
    component: ImageGenerationToolRenderer,
    tags: ["autodocs"],
    parameters: {
        docs: {
            description: { component: "messages.tsx image generation tool; read-only fixture." }
        }
    },

    args: {
        readOnly: true,
        toolInvocation: {
            toolCallId: "image",
            state: "input-available",
            input: { prompt: "A quiet landscape" }
        }
    }
} satisfies Meta<typeof ImageGenerationToolRenderer>
export default meta
type Story = StoryObj<typeof meta>
export const Playground: Story = {}
