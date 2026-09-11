import type { Meta, StoryObj } from "@storybook/react-vite"
import * as C from "@/components/ui/alert"

const meta = {
    title: "UI/alert",
    parameters: {
        docs: { description: { component: "routes/settings/files.tsx signed-out notice." } }
    },
    render: () => (
        <C.Alert>
            <C.AlertDescription>Sign in to view and manage your files.</C.AlertDescription>
        </C.Alert>
    )
} satisfies Meta
export default meta
type Story = StoryObj<typeof meta>
export const Playground: Story = {}
