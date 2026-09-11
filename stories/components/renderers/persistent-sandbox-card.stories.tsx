import type { Meta, StoryObj } from "@storybook/react-vite"
import { PersistentSandboxCard } from "@/components/renderers/persistent-sandbox-card"

const meta = {
    title: "Tools/Persistent sandbox",
    component: PersistentSandboxCard,
    tags: ["autodocs"],
    parameters: {
        docs: {
            description: {
                component: "messages.tsx sandbox permission and lifecycle card; actions are mocked."
            }
        }
    },

    args: {
        toolInvocation: {
            toolCallId: "sandbox",
            state: "output-available",
            input: {},
            output: {
                kind: "persistent_sandbox_request",
                status: "pending_confirmation",
                purpose: "Run the project tests",
                runtime: "node",
                ttlMinutes: 30
            }
        }
    }
} satisfies Meta<typeof PersistentSandboxCard>
export default meta
type Story = StoryObj<typeof meta>
export const Playground: Story = {}
