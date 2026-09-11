import type { Meta, StoryObj } from "@storybook/react-vite"
import { fn } from "storybook/test"
import { ImportThreadDialog } from "@/components/threads/import-thread-button"
import { demoProject } from "../../../.storybook/fixtures"
import { SidebarProvider } from "@/components/ui/sidebar"
const meta = {
    title: "Sidebar/Import",
    component: ImportThreadDialog,
    tags: ["autodocs"],
    parameters: {
        docs: {
            description: {
                component:
                    "SidebarDialogsContainer import flow. File uploads are not connected to a deployment."
            }
        }
    },
    decorators: [
        (Story) => (
            <SidebarProvider className="min-h-0">
                <div className="w-80 max-w-full">
                    <Story />
                </div>
            </SidebarProvider>
        )
    ],
    args: {
        open: true,
        onOpenChange: fn(),
        projects: [demoProject],
        jobId: null,
        onJobIdChange: fn()
    }
} satisfies Meta<typeof ImportThreadDialog>
export default meta
type Story = StoryObj<typeof meta>
export const Playground: Story = {}
