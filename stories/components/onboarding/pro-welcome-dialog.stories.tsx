import type { Meta, StoryObj } from "@storybook/react-vite"
import { fn } from "storybook/test"
import { ProWelcomeDialog } from "@/components/onboarding/pro-welcome-dialog"

const meta = {
    title: "Onboarding/Pro welcome",
    component: ProWelcomeDialog,
    tags: ["autodocs"],
    parameters: { docs: { description: { component: "OnboardingProvider after upgrading." } } },

    args: { isOpen: true, onDismiss: fn() }
} satisfies Meta<typeof ProWelcomeDialog>
export default meta
type Story = StoryObj<typeof meta>
export const Playground: Story = {}
