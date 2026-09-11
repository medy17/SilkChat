import type { Meta, StoryObj } from "@storybook/react-vite"
import { ImageCostEstimateIndicator } from "@/components/image-cost-indicator"

const meta = {
    title: "Library/Image cost",
    component: ImageCostEstimateIndicator,
    tags: ["autodocs"],
    parameters: {
        docs: {
            description: {
                component:
                    "image-generation-sidebar.tsx and image-generation-ui.tsx generation estimates."
            }
        }
    },
    args: { totalUsd: 0.12, variants: 4, referenceCount: 1 }
} satisfies Meta<typeof ImageCostEstimateIndicator>
export default meta
type Story = StoryObj<typeof meta>
export const Playground: Story = {}
export const SingleImage: Story = { args: { totalUsd: 0.03, variants: 1, referenceCount: 0 } }
