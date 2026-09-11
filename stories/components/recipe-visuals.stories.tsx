import type { Meta, StoryObj } from "@storybook/react-vite"
import { RecipeVisuals } from "@/components/recipe-visuals"
import { SidebarProvider } from "@/components/ui/sidebar"
const meta = {
    title: "Chat/Recipe visuals",
    component: RecipeVisuals,
    args: { cue: "tomato pasta", limit: 3, variant: "gallery" },
    decorators: [
        (Story) => (
            <SidebarProvider className="min-h-0">
                <div className="relative h-[70vh] w-full">
                    <Story />
                </div>
            </SidebarProvider>
        )
    ]
} satisfies Meta<typeof RecipeVisuals>
export default meta
type Story = StoryObj<typeof meta>
export const Playground: Story = {}
