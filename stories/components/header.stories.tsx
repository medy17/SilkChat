import type { Meta, StoryObj } from "@storybook/react-vite"
import { Header } from "@/components/header"
import { SidebarProvider } from "@/components/ui/sidebar"
const meta = {
    title: "Chat/Header",
    component: Header,
    parameters: { layout: "fullscreen" },
    args: {},
    decorators: [
        (Story) => (
            <SidebarProvider>
                <Story />
            </SidebarProvider>
        )
    ]
} satisfies Meta<typeof Header>
export default meta
type Story = StoryObj<typeof meta>
export const Playground: Story = {}
