import type { Meta, StoryObj } from "@storybook/react-vite"
import { HighlightedCodeblock } from "@/components/highlighted-codeblock"

const meta = {
    title: "Chat/Highlighted code",
    component: HighlightedCodeblock,
    tags: ["autodocs"],
    parameters: {
        docs: {
            description: {
                component: "artifact-preview.tsx source preview and code execution output."
            }
        }
    },
    args: {
        source: 'const greeting = "Hello, SilkChat";\nconsole.log(greeting);',
        language: "typescript"
    }
} satisfies Meta<typeof HighlightedCodeblock>
export default meta
type Story = StoryObj<typeof meta>
export const Playground: Story = {}
export const Python: Story = {
    args: { source: "for item in range(5):\n    print(item)", language: "python" }
}
