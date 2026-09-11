import type { Meta, StoryObj } from "@storybook/react-vite"
import { UsageDashboard } from "@/components/analytics/usage-dashboard"

const meta = {
    title: "Settings/Usage dashboard",
    component: UsageDashboard,
    tags: ["autodocs"],
    parameters: {
        docs: { description: { component: "settings page usage dashboard with fixture totals." } }
    },

    args: {}
} satisfies Meta<typeof UsageDashboard>
export default meta
type Story = StoryObj<typeof meta>
export const Playground: Story = {}
export const Loading: Story = {
    parameters: {
        queryFixtures: {
            "analytics:getMyUsageStats": undefined,
            "analytics:getMyUsageChartData": undefined
        }
    }
}
