import type { Meta, StoryObj } from "@storybook/react-vite"
import { ArtifactPreview } from "@/components/artifact-preview"
const meta = {
    title: "Chat/Artifact preview",
    component: ArtifactPreview,
    tags: ["autodocs"],
    parameters: { docs: { description: { component: "codeblock.tsx lazy artifact rendering." } } },
    args: {
        language: "html",
        code: "<main><h1>Hello from your artifact</h1><p>A standalone HTML preview.</p></main>"
    },
    decorators: [
        (Story) => (
            <div className="w-full max-w-3xl">
                <Story />
            </div>
        )
    ]
} satisfies Meta<typeof ArtifactPreview>
export default meta
type Story = StoryObj<typeof meta>
export const Playground: Story = {}
export const Diagram: Story = {
    args: { language: "mermaid", code: "flowchart LR\n A[Question] --> B[Model]\n B --> C[Answer]" }
}
