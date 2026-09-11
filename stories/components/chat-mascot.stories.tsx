import type { Meta, StoryObj } from "@storybook/react-vite"
import { ChatMascot } from "@/components/chat-mascot"

const meta = {
    title: "Chat/Mascot",
    component: ChatMascot,
    tags: ["autodocs"],
    parameters: {
        docs: {
            description: {
                component: "chat.tsx empty conversation; curiosity follows composer focus."
            }
        }
    },
    args: { isCurious: false, className: "size-28" }
} satisfies Meta<typeof ChatMascot>
export default meta
type Story = StoryObj<typeof meta>
export const Playground: Story = {}
export const ComposerFocused: Story = { args: { isCurious: true } }
export const ShortViewport: Story = { args: { variant: "face", className: "size-14" } }
