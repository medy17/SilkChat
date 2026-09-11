import type { Meta, StoryObj } from "@storybook/react-vite"
import { LineWaves } from "@/components/line-waves"
import { SidebarProvider } from "@/components/ui/sidebar"
const meta = {
    title: "Brand/OG waves",
    component: LineWaves,
    args: {
        speed: 0.16,
        innerLineCount: 25,
        outerLineCount: 31,
        warpIntensity: 1.35,
        rotation: -38,
        edgeFadeWidth: 0.24,
        colorCycleSpeed: 0.35,
        brightness: 0.18,
        preserveDrawingBuffer: true
    },
    decorators: [
        (Story) => (
            <SidebarProvider className="min-h-0">
                <div className="relative h-[70vh] w-full">
                    <Story />
                </div>
            </SidebarProvider>
        )
    ]
} satisfies Meta<typeof LineWaves>
export default meta
type Story = StoryObj<typeof meta>
export const Playground: Story = {}
