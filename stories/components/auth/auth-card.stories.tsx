import type { Meta, StoryObj } from "@storybook/react-vite"
import { AuthCard } from "@/components/auth/auth-card"
const meta = {
    title: "Account/Sign in",
    component: AuthCard,
    parameters: { layout: "fullscreen", queryFixtures: { $guest: true } },
    args: {},
    decorators: [
        (Story) => (
            <div className="relative min-h-80">
                <Story />
            </div>
        )
    ]
} satisfies Meta<typeof AuthCard>
export default meta
type Story = StoryObj<typeof meta>
export const Playground: Story = {}
