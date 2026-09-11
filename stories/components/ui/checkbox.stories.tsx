import type { Meta, StoryObj } from "@storybook/react-vite"
import { Checkbox } from "@/components/ui/checkbox"

const meta = {
    title: "UI/Checkbox",
    component: Checkbox,
    tags: ["autodocs"],
    parameters: {
        docs: {
            description: { component: "Account export consent in routes/settings/profile.tsx." }
        }
    },
    args: { disabled: false, className: "mt-0.5 rounded-[var(--radius-sm)]" },
    render: (args) => (
        <label
            htmlFor="export-consent"
            className="flex max-w-lg cursor-pointer items-start gap-3 rounded-[var(--radius-lg)] border p-3 text-sm"
        >
            <Checkbox {...args} id="export-consent" />
            <span>
                I understand that my export may contain private conversations and links to files
                I’ve uploaded or created.
            </span>
        </label>
    )
} satisfies Meta<typeof Checkbox>
export default meta
type Story = StoryObj<typeof meta>
export const Playground: Story = {}
export const Checked: Story = { args: { defaultChecked: true } }
export const Disabled: Story = { args: { disabled: true } }
