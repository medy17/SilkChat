import type { Meta, StoryObj } from "@storybook/react-vite"
import { fn } from "storybook/test"
import { ImportJobsGroup } from "@/components/threads/sidebar-import-jobs"
import { SidebarProvider } from "@/components/ui/sidebar"
import type { Doc } from "@/convex/_generated/dataModel"
const job: Doc<"importJobs"> = {
    _id: "storybook-import" as Doc<"importJobs">["_id"],
    _creationTime: 1789084800000,
    authorId: "storybook-user",
    status: "importing",
    attachmentMode: "mirror",
    createdAt: 1789084800000,
    updatedAt: 1789084800000,
    totalSourceFiles: 1,
    preparedSourceFiles: 1,
    totalThreads: 20,
    processedThreads: 9,
    importedThreads: 9,
    failedThreads: 0,
    warningCount: 0,
    errorCount: 0,
    recentWarnings: [],
    recentErrors: []
}
const meta = {
    title: "Sidebar/Import jobs",
    component: ImportJobsGroup,
    tags: ["autodocs"],
    args: { jobs: [job], onOpenJob: fn() },
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
                    "The live import progress cards mounted above thread groups in threads-sidebar.tsx."
            }
        }
    }
} satisfies Meta<typeof ImportJobsGroup>
export default meta
type Story = StoryObj<typeof meta>
export const Importing: Story = {}
export const CompletedWithIssues: Story = {
    args: {
        jobs: [
            {
                ...job,
                status: "completed_with_errors",
                processedThreads: 20,
                importedThreads: 18,
                failedThreads: 2,
                errorCount: 2
            }
        ]
    }
}
export const Queued: Story = {
    args: { jobs: [{ ...job, status: "queued", processedThreads: 0, importedThreads: 0 }] }
}
