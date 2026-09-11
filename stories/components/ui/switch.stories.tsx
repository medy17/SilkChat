import type { Meta, StoryObj } from "@storybook/react-vite"
import { Switch } from "@/components/ui/switch"

const meta = {
    title: "UI/Switch",
    component: Switch,
    tags: ["autodocs"],
    parameters: {
        docs: {
            description: { component: "Haptics preference in routes/settings/customization.tsx." }
        }
    },
    args: { "aria-label": "Enable haptics", disabled: false },
    render: (args) => (
        <div className="flex max-w-lg items-center justify-between gap-6">
            <div>
                <label htmlFor="story-haptics" className="font-medium">
                    Haptics
                </label>
                <p className="text-muted-foreground text-sm">
                    Feel response and gesture feedback on supported devices.
                </p>
            </div>
            <Switch {...args} id="story-haptics" />
        </div>
    )
} satisfies Meta<typeof Switch>
export default meta
type Story = StoryObj<typeof meta>
export const Playground: Story = {}
export const Enabled: Story = { args: { defaultChecked: true } }
