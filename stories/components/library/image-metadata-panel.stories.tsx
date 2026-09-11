import type { Meta, StoryObj } from "@storybook/react-vite"
import { ImageMetadataPanel } from "@/components/library/image-metadata-panel"
import { demoImage } from "../../../.storybook/fixtures"
const meta = {
    title: "Library/Image metadata",
    component: ImageMetadataPanel,
    parameters: {
        docs: {
            description: {
                component: "ImageDetailsModal metadata panel with a local sample image."
            }
        }
    },
    args: { image: demoImage, modelName: "Demo image model" }
} satisfies Meta<typeof ImageMetadataPanel>
export default meta
type Story = StoryObj<typeof meta>
export const Playground: Story = {}
