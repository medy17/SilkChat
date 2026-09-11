import type { Meta, StoryObj } from "@storybook/react-vite"
import { ThemeSwitcher } from "@/components/themes/theme-switcher"
const meta = {
    title: "Themes/Switcher",
    component: ThemeSwitcher,
    parameters: { layout: "fullscreen" },
    args: { buttonVariant: "outline" },
    decorators: [
        (Story) => (
            <div className="relative min-h-80">
                <Story />
            </div>
        )
    ]
} satisfies Meta<typeof ThemeSwitcher>
export default meta
type Story = StoryObj<typeof meta>
export const Playground: Story = {}
