import type { Meta, StoryObj } from "@storybook/react-vite"
import * as C from "@/components/ui/resizable"

const meta = {
    title: "Available primitives/Resizable",
    parameters: { layout: "padded" },
    render: () => (
        <div className="h-64">
            <C.ResizablePanelGroup orientation="horizontal">
                <C.ResizablePanel defaultSize="35%">
                    <div className="p-6">Drag the divider</div>
                </C.ResizablePanel>
                <C.ResizableHandle withHandle />
                <C.ResizablePanel>
                    <div className="p-6">Conversation preview</div>
                </C.ResizablePanel>
            </C.ResizablePanelGroup>
        </div>
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
