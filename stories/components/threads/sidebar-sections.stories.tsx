import type { Meta, StoryObj } from "@storybook/react-vite"
import { ThreadSections } from "@/components/threads/sidebar-sections"
import { SidebarProvider } from "@/components/ui/sidebar"
import { demoThread } from "../../../.storybook/fixtures"
const meta = {
    title: "Sidebar/Thread groups",
    component: ThreadSections,
    args: {
        groupedThreads: {
            pinned: [
                {
                    ...demoThread,
                    _id: "storybook-pinned" as typeof demoThread._id,
                    title: "Project notes",
                    pinned: true
                }
            ],
            today: [demoThread],
            yesterday: [],
            lastSevenDays: [],
            lastThirtyDays: [],
            older: []
        },
        selectedThreadIds: [],
        activeThreadId: demoThread._id
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
    parameters: {
        docs: {
            description: {
                component:
                    "Pinned and chronological groups from threads-sidebar.tsx, using real thread rows and the active conversation indicator."
            }
        }
    }
} satisfies Meta<typeof ThreadSections>
export default meta
export const Grouped: StoryObj<typeof meta> = {}
