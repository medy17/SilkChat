import type { Meta, StoryObj } from "@storybook/react-vite"
import { NativeChartRenderer } from "@/components/renderers/native-chart-tool"

const meta = {
    title: "Tools/Chart",
    component: NativeChartRenderer,
    tags: ["autodocs"],
    parameters: {
        docs: {
            description: {
                component: "NativeChartToolRenderer in messages.tsx renders validated chart output."
            }
        }
    },
    args: {
        chart: {
            title: "Requests this week",
            type: "bar",
            xKey: "day",
            xScale: "category",
            showLegend: true,
            stacked: false,
            series: [{ key: "requests", label: "Requests" }],
            data: [
                { day: "Mon", requests: 12 },
                { day: "Tue", requests: 28 },
                { day: "Wed", requests: 19 }
            ]
        }
    }
} satisfies Meta<typeof NativeChartRenderer>
export default meta
type Story = StoryObj<typeof meta>
export const Playground: Story = {}
