import type { Meta, StoryObj } from "@storybook/react-vite"
import { fn } from "storybook/test"
import { ToolSelectorPopover } from "@/components/tool-selector-popover"
const meta = {
    title: "Chat/Tools selector",
    component: ToolSelectorPopover,
    tags: ["autodocs"],
    parameters: { docs: { description: { component: "multimodal-input.tsx tool toggles." } } },
    args: {
        enabledTools: ["web_search"],
        onEnabledToolsChange: fn(),
        modelSupportsFunctionCalling: true,
        modelSupportsVision: true,
        selectedModel: null
    },
    decorators: [
        (Story) => (
            <div className="w-full max-w-3xl">
                <Story />
            </div>
        )
    ]
} satisfies Meta<typeof ToolSelectorPopover>
export default meta
type Story = StoryObj<typeof meta>
export const Playground: Story = {}
export const Open: Story = { args: { open: true } }
export const UnsupportedModel: Story = { args: { modelSupportsFunctionCalling: false } }
