import type { Meta, StoryObj } from "@storybook/react-vite"
import { PersonaSelector } from "@/components/persona-selector"

const meta = {
    title: "Personas/Selector",
    component: PersonaSelector,
    tags: ["autodocs"],
    parameters: {
        docs: {
            description: {
                component: "multimodal-input.tsx persona picker. Empty account fixture."
            }
        }
    },

    args: {}
} satisfies Meta<typeof PersonaSelector>
export default meta
type Story = StoryObj<typeof meta>
export const Playground: Story = {}
export const Open: Story = { args: { open: true } }
