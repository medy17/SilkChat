import type { Meta, StoryObj } from "@storybook/react-vite"
import { UserButton } from "@/components/user-button"
const meta = {
    title: "Account/User menu",
    component: UserButton,
    parameters: { layout: "fullscreen" },
    args: {},
    decorators: [
        (Story) => (
            <div className="relative min-h-80">
                <Story />
            </div>
        )
    ]
} satisfies Meta<typeof UserButton>
export default meta
type Story = StoryObj<typeof meta>
export const Playground: Story = {}
