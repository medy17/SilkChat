import type { Meta, StoryObj } from "@storybook/react-vite"
import { TabularFilePreview } from "@/components/tabular-file-preview"
const meta = {
    title: "Files/Table preview",
    component: TabularFilePreview,
    tags: ["autodocs"],
    parameters: {
        docs: {
            description: { component: "messages.tsx and multimodal-input.tsx CSV/TSV preview." }
        }
    },
    args: {
        filename: "usage.csv",
        content: "Model,Requests,Tokens\nDemo model,24,18500\nAnother model,8,6200",
        mediaType: "text/csv"
    },
    decorators: [
        (Story) => (
            <div className="w-full max-w-3xl">
                <Story />
            </div>
        )
    ]
} satisfies Meta<typeof TabularFilePreview>
export default meta
type Story = StoryObj<typeof meta>
export const Playground: Story = {}
export const Empty: Story = { args: { content: "" } }
