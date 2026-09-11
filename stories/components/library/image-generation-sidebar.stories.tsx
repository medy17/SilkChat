import type { Meta, StoryObj } from "@storybook/react-vite"
import { ImageGenerationSidebar } from "@/components/library/image-generation-sidebar"
import { SidebarProvider } from "@/components/ui/sidebar"
const meta = {
    title: "Library/Generation sidebar",
    component: ImageGenerationSidebar,
    parameters: { layout: "fullscreen" },
    args: { disabled: false },
    decorators: [
        (Story) => (
            <SidebarProvider>
                <Story />
            </SidebarProvider>
        )
    ]
} satisfies Meta<typeof ImageGenerationSidebar>
export default meta
type Story = StoryObj<typeof meta>
export const Playground: Story = {}
