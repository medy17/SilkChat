import type { Meta, StoryObj } from "@storybook/react-vite"
import { OgCaptureGallery } from "@/components/og-capture-gallery"
const meta = {
    title: "Brand/OG gallery",
    component: OgCaptureGallery,
    parameters: { layout: "fullscreen" },
    args: {
        heading: "Open Graph backgrounds",
        description: "Capture backgrounds for shared links.",
        showLogo: true
    },
    decorators: [
        (Story) => (
            <div className="relative min-h-80">
                <Story />
            </div>
        )
    ]
} satisfies Meta<typeof OgCaptureGallery>
export default meta
type Story = StoryObj<typeof meta>
export const Playground: Story = {}
