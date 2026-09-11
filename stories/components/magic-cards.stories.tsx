import type { Meta, StoryObj } from "@storybook/react-vite"
import { MagicCard } from "@/components/magic-cards"
import { SidebarProvider } from "@/components/ui/sidebar"
const meta = {
    title: "Available components/Magic card",
    component: MagicCard,
    args: { children: <p className="p-8">Move your pointer across the card.</p> },
    decorators: [
        (Story) => (
            <SidebarProvider className="min-h-0">
                <div className="relative h-[70vh] w-full">
                    <Story />
                </div>
            </SidebarProvider>
        )
    ]
} satisfies Meta<typeof MagicCard>
export default meta
type Story = StoryObj<typeof meta>
export const Playground: Story = {}
