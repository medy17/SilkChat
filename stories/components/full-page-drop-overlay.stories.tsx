import type { Meta, StoryObj } from "@storybook/react-vite"
import { fn } from "storybook/test"
import { FullPageDropOverlay } from "@/components/full-page-drop-overlay"
const meta = {
    title: "Chat/File drop overlay",
    component: FullPageDropOverlay,
    tags: ["autodocs"],
    args: { enabled: true, onDrop: fn() },
    render: (args) => (
        <div className="min-h-96 p-8">
            <p>
                Drag a file into this preview to reveal the chat upload overlay. Dropped files
                appear in Actions.
            </p>
            <FullPageDropOverlay {...args} />
        </div>
    ),
    parameters: {
        docs: {
            description: {
                component:
                    "chat.tsx mounts this window-level drop target while its route is active."
            }
        }
    }
} satisfies Meta<typeof FullPageDropOverlay>
export default meta
type Story = StoryObj<typeof meta>
export const ActiveChat: Story = {}
export const InactiveRoute: Story = { args: { enabled: false } }
