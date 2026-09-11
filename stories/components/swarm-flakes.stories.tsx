import type { Meta, StoryObj } from "@storybook/react-vite"
import SwarmFlakes from "@/components/swarm-flakes"
const meta = {
    title: "Available components/Swarm flakes",
    component: SwarmFlakes,
    args: { className: "h-96 w-full" },
    parameters: {
        docs: {
            description: {
                component:
                    "Retained WebGL effect with no current app call site. Requires browser WebGL support."
            }
        }
    }
} satisfies Meta<typeof SwarmFlakes>
export default meta
export const Playground: StoryObj<typeof meta> = {}
