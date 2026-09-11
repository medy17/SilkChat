import type { Meta, StoryObj } from "@storybook/react-vite"
import { Badge } from "@/components/ui/badge"

const meta = {
    title: "UI/Badge",
    component: Badge,
    tags: ["autodocs"],
    parameters: {
        docs: {
            description: {
                component:
                    "Model badge in chat-actions.tsx message footer; model name is fixture text."
            }
        }
    },
    args: { children: "Demo model", variant: "secondary", className: "ml-1 h-7" }
} satisfies Meta<typeof Badge>
export default meta
type Story = StoryObj<typeof meta>
export const Playground: Story = {}
export const Outline: Story = { args: { variant: "outline" } }
