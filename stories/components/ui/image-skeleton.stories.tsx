import type { Meta, StoryObj } from "@storybook/react-vite"
import { ImageSkeleton } from "@/components/ui/image-skeleton"
const meta = {
    title: "UI/Image skeleton",
    component: ImageSkeleton,
    parameters: {
        docs: {
            description: {
                component:
                    "Pending generation tile from renderers/image-generation-ui.tsx. It uses 3px dots, 4px gaps, no loop, and a long loading duration while the job runs."
            }
        }
    },
    args: {
        rows: 30,
        cols: 40,
        dotSize: 3,
        gap: 4,
        loadingDuration: 99999,
        autoLoop: false,
        className: "h-full w-full border-0 bg-transparent",
        imageUrl: "/storybook/sample.svg"
    },
    decorators: [
        (Story) => (
            <div className="relative h-60 w-80 max-w-full overflow-hidden rounded-[var(--radius-xl)] bg-muted/40">
                <Story />
            </div>
        )
    ]
} satisfies Meta<typeof ImageSkeleton>
export default meta
type Story = StoryObj<typeof meta>
export const Generating: Story = {}
