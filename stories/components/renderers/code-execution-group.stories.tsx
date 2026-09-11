import type { Meta, StoryObj } from "@storybook/react-vite"
import { CodeExecutionGroupRenderer } from "@/components/renderers/code-execution-group"
const meta = {
    title: "Tools/Code execution",
    component: CodeExecutionGroupRenderer,
    tags: ["autodocs"],
    parameters: {
        docs: { description: { component: "messages.tsx grouped sandbox execution output." } }
    },
    args: {
        kind: "code",
        executions: [
            {
                kind: "code",
                toolCallId: "code",
                state: "output-available",
                title: "Calculate total",
                status: "succeeded",
                input: { language: "python", code: "print(sum([1, 2, 3]))", dependencies: [] },
                output: {
                    success: true,
                    stdout: "6",
                    exitCode: 0,
                    durationMs: 240,
                    dependencies: [],
                    artifacts: [],
                    artifactErrors: []
                }
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
} satisfies Meta<typeof CodeExecutionGroupRenderer>
export default meta
type Story = StoryObj<typeof meta>
export const Playground: Story = {}
