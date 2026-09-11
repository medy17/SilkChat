import type { Meta, StoryObj } from "@storybook/react-vite"
import { fn } from "storybook/test"
import { ImageDetailsModal } from "@/components/library/image-details-modal"
import { demoImage } from "../../../.storybook/fixtures"
const meta = {
    title: "Library/Image details",
    component: ImageDetailsModal,
    parameters: {
        docs: { description: { component: "Library route and image-generation results lightbox." } }
    },
    args: {
        image: demoImage,
        isOpen: true,
        onClose: fn(),
        onPrevious: fn(),
        onNext: fn(),
        canNavigatePrevious: true,
        canNavigateNext: true
    }
} satisfies Meta<typeof ImageDetailsModal>
export default meta
type Story = StoryObj<typeof meta>
export const Playground: Story = {}
