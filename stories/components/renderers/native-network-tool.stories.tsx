import type { Meta, StoryObj } from "@storybook/react-vite"
import { NativeNetworkRenderer } from "@/components/renderers/native-network-tool"

const meta = {
    title: "Tools/Network",
    component: NativeNetworkRenderer,
    tags: ["autodocs"],
    parameters: {
        docs: {
            description: {
                component:
                    "NativeNetworkToolRenderer in messages.tsx renders validated network output."
            }
        }
    },
    args: {
        network: {
            title: "Project dependencies",
            directed: true,
            layout: "circle",
            nodes: [
                { id: "app", label: "App" },
                { id: "api", label: "API" },
                { id: "db", label: "Database" }
            ],
            edges: [
                { source: "app", target: "api" },
                { source: "api", target: "db" }
            ]
        }
    }
} satisfies Meta<typeof NativeNetworkRenderer>
export default meta
type Story = StoryObj<typeof meta>
export const Playground: Story = {}
