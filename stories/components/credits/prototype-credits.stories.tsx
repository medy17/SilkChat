import type { Meta, StoryObj } from "@storybook/react-vite"
import { fn } from "storybook/test"
import { PrototypeCreditsCard } from "@/components/credits/prototype-credits"
import { demoCredits } from "../../../.storybook/fixtures"
const meta = {
    title: "Account/Included usage",
    component: PrototypeCreditsCard,
    parameters: {
        docs: {
            description: {
                component: "settings/billing.tsx and settings/profile.tsx included usage card."
            }
        }
    },
    args: {
        summary: demoCredits,
        isLoading: false,
        isRefreshing: false,
        shouldShowDevCreditPlanToggle: false,
        devCreditState: null,
        isUpdatingDevCreditState: false,
        onSetDevCreditState: fn().mockResolvedValue(undefined),
        onRefresh: fn().mockResolvedValue(undefined)
    }
} satisfies Meta<typeof PrototypeCreditsCard>
export default meta
type Story = StoryObj<typeof meta>
export const Playground: Story = {}
