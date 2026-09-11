import type { Meta, StoryObj } from "@storybook/react-vite"
import { PdfFilePreview } from "@/components/pdf-file-preview"
import { SidebarProvider } from "@/components/ui/sidebar"
const meta = {
    title: "Files/PDF preview",
    component: PdfFilePreview,
    args: { url: "/storybook/sample.pdf", filename: "sample.pdf" },
    decorators: [
        (Story) => (
            <SidebarProvider className="min-h-0">
                <div className="relative h-[70vh] w-full">
                    <Story />
                </div>
            </SidebarProvider>
        )
    ]
} satisfies Meta<typeof PdfFilePreview>
export default meta
type Story = StoryObj<typeof meta>
export const Playground: Story = {}
