import type { Meta, StoryObj } from "@storybook/react-vite"
import { SettingsBackButton } from "@/components/settings/settings-back-button"
const meta = {
    title: "Settings/Back button",
    component: SettingsBackButton,
    tags: ["autodocs"],
    parameters: { docs: { description: { component: "settings route layout navigation." } } },
    args: {},
    decorators: [
        (Story) => (
            <div className="w-full max-w-3xl">
                <Story />
            </div>
        )
    ]
} satisfies Meta<typeof SettingsBackButton>
export default meta
type Story = StoryObj<typeof meta>
export const Playground: Story = {}
