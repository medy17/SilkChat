import type { Meta, StoryObj } from "@storybook/react-vite"
import { fn } from "storybook/test"
import { PastDueRenewalDialog } from "@/components/onboarding/past-due-renewal-dialog"

const meta = {
    title: "Onboarding/Renewal",
    component: PastDueRenewalDialog,
    tags: ["autodocs"],
    parameters: {
        docs: {
            description: {
                component: "OnboardingProvider past-due account notice; no billing URL is supplied."
            }
        }
    },

    args: { isOpen: true, onDismiss: fn() }
} satisfies Meta<typeof PastDueRenewalDialog>
export default meta
type Story = StoryObj<typeof meta>
export const Playground: Story = {}
