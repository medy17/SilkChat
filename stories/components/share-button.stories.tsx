import type { Meta, StoryObj } from "@storybook/react-vite"
import { ShareButton } from "@/components/share-button"
import { demoThread } from "../../.storybook/fixtures"

const meta = {
    title: "Chat/Share",
    component: ShareButton,
    tags: ["autodocs"],
    parameters: {
        docs: {
            description: {
                component:
                    "chat-actions.tsx and thread-item.tsx sharing dialog; share action is mocked."
            }
        }
    },

    args: { threadId: demoThread._id }
} satisfies Meta<typeof ShareButton>
export default meta
type Story = StoryObj<typeof meta>
export const Playground: Story = {}
export const Open: Story = { args: { open: true } }
