import type { Meta, StoryObj } from "@storybook/react-vite"
import { fn } from "storybook/test"
import { OnboardingDialog } from "@/components/onboarding/onboarding-dialog"

const meta = {
    title: "Onboarding/Walkthrough",
    component: OnboardingDialog,
    tags: ["autodocs"],
    parameters: {
        docs: { description: { component: "OnboardingProvider first-run walkthrough." } }
    },

    args: { isOpen: true, onComplete: fn() }
} satisfies Meta<typeof OnboardingDialog>
export default meta
type Story = StoryObj<typeof meta>
export const Playground: Story = {}
