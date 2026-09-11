import type { Meta, StoryObj } from "@storybook/react-vite"
import { SharedChat } from "@/components/shared-chat"
const meta = {
    title: "Chat/Shared conversation",
    component: SharedChat,
    parameters: {
        docs: { description: { component: "Shared conversation route; fixture backend only." } }
    },
    args: { sharedThreadId: "storybook-shared" }
} satisfies Meta<typeof SharedChat>
export default meta
type Story = StoryObj<typeof meta>
export const Playground: Story = {}
