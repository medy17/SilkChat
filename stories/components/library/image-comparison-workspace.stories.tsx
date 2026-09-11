import type { Meta, StoryObj } from "@storybook/react-vite"
import { ImageComparisonWorkspace } from "@/components/library/image-comparison-workspace"
import { demoImage } from "../../../.storybook/fixtures"
const meta = {
    title: "Library/Image comparison",
    component: ImageComparisonWorkspace,
    parameters: {
        docs: {
            description: { component: "routes/compare.tsx side-by-side and slider comparison." }
        }
    },
    args: {
        images: [
            demoImage,
            {
                ...demoImage,
                _id: "storybook-image-2" as typeof demoImage._id,
                prompt: "A second image for comparison"
            }
        ]
    }
} satisfies Meta<typeof ImageComparisonWorkspace>
export default meta
type Story = StoryObj<typeof meta>
export const Playground: Story = {}
