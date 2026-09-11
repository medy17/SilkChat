import type { Meta, StoryObj } from "@storybook/react-vite"
import { ModelCostIndicator } from "@/components/model-cost-indicator"
import { demoModels } from "../../.storybook/fixtures"
const meta = {
    title: "Chat/Model cost",
    component: ModelCostIndicator,
    parameters: { layout: "fullscreen" },
    args: { model: demoModels[0] },
    decorators: [
        (Story) => (
            <div className="relative min-h-80">
                <Story />
            </div>
        )
    ]
} satisfies Meta<typeof ModelCostIndicator>
export default meta
type Story = StoryObj<typeof meta>
export const Playground: Story = {}
