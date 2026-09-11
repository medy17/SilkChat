import type { Meta, StoryObj } from "@storybook/react-vite"
import { SignupMessagePrompt } from "@/components/signup-message-prompt"
const meta = {
    title: "Chat/Signup prompt",
    component: SignupMessagePrompt,
    tags: ["autodocs"],
    parameters: {
        docs: {
            description: {
                component: "chat.tsx and folder-chat.tsx unauthenticated conversation prompt."
            }
        }
    },
    args: {},
    decorators: [
        (Story) => (
            <div className="w-full max-w-3xl">
                <Story />
            </div>
        )
    ]
} satisfies Meta<typeof SignupMessagePrompt>
export default meta
type Story = StoryObj<typeof meta>
export const Playground: Story = {}
