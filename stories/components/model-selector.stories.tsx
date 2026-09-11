import type { Meta, StoryObj } from "@storybook/react-vite"
import { fn } from "storybook/test"
import { ModelSelector } from "@/components/model-selector"
import { demoModels } from "../../.storybook/fixtures"

const meta = {
    title: "Chat/Model selector",
    component: ModelSelector,
    tags: ["autodocs"],
    parameters: {
        docs: {
            description: {
                component:
                    "multimodal-input.tsx model picker; actual shared model catalog with fixture settings."
            }
        }
    },

    args: {
        selectedModel: demoModels[0].id,
        onModelChange: fn(),
        telemetrySurface: "composer",
        shortcutTarget: "composer"
    }
} satisfies Meta<typeof ModelSelector>
export default meta
type Story = StoryObj<typeof meta>
export const Playground: Story = {}
export const Open: Story = { args: { open: true } }
export const PdfRequired: Story = { args: { requiresNativePdf: true, open: true } }
