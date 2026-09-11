import type { Meta, StoryObj } from "@storybook/react-vite"
import * as C from "@/components/ui/select"

const meta = {
    title: "UI/select",
    parameters: {
        docs: { description: { component: "routes/settings/files.tsx file type filter." } }
    },
    render: () => (
        <C.Select defaultValue="all">
            <C.SelectTrigger className="w-full sm:w-56" aria-label="Filter files by type">
                <C.SelectValue />
            </C.SelectTrigger>
            <C.SelectContent>
                {[
                    ["all", "All files"],
                    ["image", "Images"],
                    ["pdf", "PDF documents"],
                    ["text", "Text documents"],
                    ["other", "Other files"]
                ].map(([value, label]) => (
                    <C.SelectItem key={value} value={value}>
                        {label}
                    </C.SelectItem>
                ))}
            </C.SelectContent>
        </C.Select>
    )
} satisfies Meta
export default meta
type Story = StoryObj<typeof meta>
export const Playground: Story = {}
