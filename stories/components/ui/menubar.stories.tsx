import type { Meta, StoryObj } from "@storybook/react-vite"
import * as C from "@/components/ui/menubar"

const meta = {
    title: "Available primitives/Menubar",
    parameters: { layout: "padded" },
    render: () => (
        <C.Menubar>
            <C.MenubarMenu>
                <C.MenubarTrigger>Conversation</C.MenubarTrigger>
                <C.MenubarContent>
                    <C.MenubarItem>Rename</C.MenubarItem>
                    <C.MenubarItem>Export</C.MenubarItem>
                    <C.MenubarSeparator />
                    <C.MenubarItem disabled>Delete locked conversation</C.MenubarItem>
                </C.MenubarContent>
            </C.MenubarMenu>
        </C.Menubar>
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
