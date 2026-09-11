import type { Meta, StoryObj } from "@storybook/react-vite"
import * as C from "@/components/ui/tabs"

const meta = {
    title: "UI/tabs",
    parameters: {
        docs: { description: { component: "analytics/usage-dashboard.tsx timeframe selector." } }
    },
    render: () => (
        <C.Tabs defaultValue="7d">
            <C.TabsList>
                <C.TabsTrigger value="1d">1 Day</C.TabsTrigger>
                <C.TabsTrigger value="7d">7 Days</C.TabsTrigger>
                <C.TabsTrigger value="30d">30 Days</C.TabsTrigger>
            </C.TabsList>
        </C.Tabs>
    )
} satisfies Meta
export default meta
type Story = StoryObj<typeof meta>
export const Playground: Story = {}
