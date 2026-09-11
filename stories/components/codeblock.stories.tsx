import type { Meta, StoryObj } from "@storybook/react-vite"
import { Codeblock } from "@/components/codeblock"

const meta = {
    title: "Chat/Code block",
    component: Codeblock,
    tags: ["autodocs"],
    parameters: {
        docs: {
            description: {
                component:
                    "memoized-markdown.tsx code renderer; real copy, wrap and expand controls."
            }
        }
    },
    args: {
        className: "language-typescript",
        children:
            "const values = [1, 2, 3];\nconst total = values.reduce((sum, value) => sum + value, 0);\nconsole.log(total);\n"
    }
} satisfies Meta<typeof Codeblock>
export default meta
type Story = StoryObj<typeof meta>
export const Playground: Story = {}
export const Mermaid: Story = {
    args: {
        className: "language-mermaid",
        children: "graph LR\n  A[User message] --> B[Model]\n  B --> C[Assistant response]"
    }
}
export const Inline: Story = { args: { inline: true, children: "total" } }
export const LongCode: Story = {
    args: { children: 'console.log("A long output line from the model");\n'.repeat(30) }
}
