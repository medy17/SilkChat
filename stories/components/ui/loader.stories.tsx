import type { Meta, StoryObj } from "@storybook/react-vite"
import { Loader } from "@/components/ui/loader"

const meta = {
    title: "UI/Loader",
    component: Loader,
    tags: ["autodocs"],
    parameters: {
        docs: {
            description: {
                component:
                    "Used in messages.tsx for the assistant typing state (typing/md), PDF previews and message loading (circular/sm), and ChatLoadingOverlay (circular/lg). Other variants are available primitives, not current app usage."
            }
        }
    },
    args: { variant: "typing", size: "md" }
} satisfies Meta<typeof Loader>
export default meta
type Story = StoryObj<typeof meta>
export const Playground: Story = {}
export const AssistantTyping: Story = {
    render: (args) => (
        <div className="max-w-3xl px-3 py-6">
            <Loader {...args} />
        </div>
    )
}
export const PdfLoading: Story = { args: { variant: "circular", size: "sm" } }
export const ChatLoading: Story = { args: { variant: "circular", size: "lg" } }
