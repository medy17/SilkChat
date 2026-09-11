import type { Meta, StoryObj } from "@storybook/react-vite"
import { fn } from "storybook/test"
import { AttachmentTile } from "@/components/attachment-tile"

const meta = {
    title: "Chat/Attachment tile",
    component: AttachmentTile,
    tags: ["autodocs"],
    parameters: {
        docs: {
            description: {
                component:
                    "The real SilkChat attachment component. Select Playground and edit Controls to change its state without uploading a file. Use the toolbar to switch themes."
            }
        }
    },
    args: {
        fileName: "report.pdf",
        detail: "PDF · 2.4 MB",
        status: "ready",
        progress: 45,
        disabled: false,
        onClick: fn()
    },
    argTypes: {
        status: { control: "select", options: ["ready", "uploading", "success", "error"] },
        kind: { control: "select", options: ["attachment", "large-paste"] },
        progress: { control: { type: "range", min: 0, max: 100, step: 1 } },
        fileName: { control: "text" },
        detail: { control: "text" },
        error: { control: "text" },
        icon: { control: false },
        secondaryAction: { control: false }
    }
} satisfies Meta<typeof AttachmentTile>

export default meta
type Story = StoryObj<typeof meta>

export const Playground: Story = {}
export const Uploading: Story = { args: { status: "uploading" } }
export const UploadFailed: Story = { args: { status: "error", error: "Connection lost" } }
export const Success: Story = { args: { status: "success", progress: 100 } }
export const LongFilename: Story = {
    args: { fileName: "quarterly-financial-report-final-revised-september-2026.pdf" }
}
export const Disabled: Story = { args: { disabled: true } }

export const AllStates: Story = {
    render: (args) => (
        <div className="flex flex-wrap gap-8">
            {(["ready", "uploading", "success", "error"] as const).map((status) => (
                <section key={status} className="flex flex-col gap-3">
                    <h2 className="font-medium text-sm capitalize">{status}</h2>
                    <AttachmentTile {...args} status={status} />
                </section>
            ))}
        </div>
    )
}
