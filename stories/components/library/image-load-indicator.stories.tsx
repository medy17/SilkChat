import type { Meta, StoryObj } from "@storybook/react-vite"
import { ImageLoadIndicator } from "@/components/library/image-load-indicator"

const meta = {
    title: "Library/Image loading",
    component: ImageLoadIndicator,
    tags: ["autodocs"],
    parameters: {
        docs: {
            description: {
                component:
                    "image-details-modal.tsx and image-comparison-workspace.tsx loading/reveal overlay."
            }
        }
    },
    args: { complete: false }
} satisfies Meta<typeof ImageLoadIndicator>
export default meta
type Story = StoryObj<typeof meta>
export const Playground: Story = {}
export const Revealing: Story = { args: { complete: true } }
