import type { Meta, StoryObj } from "@storybook/react-vite"
import { SplashScreen } from "@/components/splash-screen"
const meta = {
    title: "Brand/Splash",
    component: SplashScreen,
    tags: ["autodocs"],
    parameters: {
        docs: { description: { component: "routes/_chat.tsx and persona landing initial splash." } }
    },
    args: { isExiting: false, label: "Loading" },
    decorators: [
        (Story) => (
            <div className="w-full max-w-3xl">
                <Story />
            </div>
        )
    ]
} satisfies Meta<typeof SplashScreen>
export default meta
type Story = StoryObj<typeof meta>
export const Playground: Story = {}
export const Exiting: Story = { args: { isExiting: true } }
