import type { Meta, StoryObj } from "@storybook/react-vite"
import { SettingsLayout } from "@/components/settings/settings-layout"

const meta = {
    title: "Settings/Layout",
    component: SettingsLayout,
    tags: ["autodocs"],
    parameters: {
        docs: {
            description: {
                component: "routes/settings/files.tsx page shell; content is a fixture."
            }
        }
    },
    args: {
        title: "Files",
        description: "Review and manage the files stored by Silkchat.",
        children: <p className="text-muted-foreground">No files uploaded yet.</p>
    }
} satisfies Meta<typeof SettingsLayout>
export default meta
type Story = StoryObj<typeof meta>
export const Playground: Story = {}
