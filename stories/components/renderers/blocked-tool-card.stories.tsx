import type { Meta, StoryObj } from "@storybook/react-vite"
import { BlockedToolCard } from "@/components/renderers/blocked-tool-card"
const meta = {
    title: "Tools/Blocked tool",
    component: BlockedToolCard,
    tags: ["autodocs"],
    parameters: { docs: { description: { component: "messages.tsx blocked tool attempts." } } },
    args: {
        attempts: [
            {
                ability: "web_search",
                toolName: "web_search",
                toolLabel: "Web Search",
                reason: "user_disabled",
                input: { query: "TypeScript" },
                summary: "TypeScript"
            }
        ]
    },
    decorators: [
        (Story) => (
            <div className="w-full max-w-3xl">
                <Story />
            </div>
        )
    ]
} satisfies Meta<typeof BlockedToolCard>
export default meta
type Story = StoryObj<typeof meta>
export const Playground: Story = {}
export const Unconfigured: Story = {
    args: {
        attempts: [
            {
                ability: "web_search",
                toolName: "web_search",
                toolLabel: "Web Search",
                reason: "not_configured",
                input: {}
            }
        ]
    }
}
