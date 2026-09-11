import type { Meta, StoryObj } from "@storybook/react-vite"
import * as C from "@/components/ui/navigation-menu"

const meta = {
    title: "Available primitives/Navigation Menu",
    parameters: { layout: "padded" },
    render: () => (
        <C.NavigationMenu>
            <C.NavigationMenuList>
                <C.NavigationMenuItem>
                    <C.NavigationMenuTrigger>Explore</C.NavigationMenuTrigger>
                    <C.NavigationMenuContent>
                        <div className="w-64 p-4">
                            <C.NavigationMenuLink href="#library">
                                Image library
                            </C.NavigationMenuLink>
                            <C.NavigationMenuLink href="#personas">Personas</C.NavigationMenuLink>
                        </div>
                    </C.NavigationMenuContent>
                </C.NavigationMenuItem>
            </C.NavigationMenuList>
        </C.NavigationMenu>
    )
} satisfies Meta
export default meta
type Story = StoryObj<typeof meta>
export const UnusedInApp: Story = {
    parameters: {
        docs: {
            description: {
                story: "No current app call site. This is an available primitive API example, not a SilkChat screen."
            }
        }
    }
}
