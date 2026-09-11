import type { Meta, StoryObj } from "@storybook/react-vite"
import { LandingPage } from "@/components/landing-page"
const meta = {
    title: "Landing/Full page",
    component: LandingPage,
    parameters: { layout: "fullscreen" },
    args: {},
    decorators: [
        (Story) => (
            <div className="relative min-h-80">
                <Story />
            </div>
        )
    ]
} satisfies Meta<typeof LandingPage>
export default meta
type Story = StoryObj<typeof meta>
export const Playground: Story = {}
