import type { Meta, StoryObj } from "@storybook/react-vite"
import { Progress } from "@/components/ui/progress"

const meta = {
    title: "UI/Progress",
    component: Progress,
    tags: ["autodocs"],
    parameters: {
        docs: {
            description: {
                component:
                    "Import progress in threads/sidebar-import-jobs.tsx uses a h-1.5 bar. AttachmentTile has its own progress UI."
            }
        }
    },
    args: { value: 45, "aria-label": "Import progress", className: "h-1.5" },
    render: (args) => (
        <div className="flex w-72 flex-col gap-2 rounded-md border bg-sidebar-accent/20 px-3 py-2">
            <div className="flex justify-between text-sm">
                <span>Importing</span>
                <span>9/20</span>
            </div>
            <Progress {...args} />
            <p className="text-muted-foreground text-xs">Mirror attachments</p>
        </div>
    )
} satisfies Meta<typeof Progress>
export default meta
type Story = StoryObj<typeof meta>
export const Playground: Story = {}
export const Complete: Story = { args: { value: 100 } }
