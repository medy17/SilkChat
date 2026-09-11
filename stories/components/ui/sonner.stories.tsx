import type { Meta, StoryObj } from "@storybook/react-vite"
import * as C from "@/components/ui/sonner"
import { Button } from "@/components/ui/button"
import { toast } from "sonner"
const meta = {
    title: "UI/sonner",
    parameters: {
        docs: {
            description: {
                component: "Toaster from providers.tsx; notification examples used by app actions."
            }
        }
    },
    render: () => (
        <>
            <C.Toaster />
            <div className="flex flex-wrap gap-3">
                <Button onClick={() => toast.success("Copied to clipboard")}>Copy success</Button>
                <Button variant="outline" onClick={() => toast.error("Upload failed")}>
                    Upload error
                </Button>
            </div>
        </>
    )
} satisfies Meta
export default meta
type Story = StoryObj<typeof meta>
export const Playground: Story = {}
