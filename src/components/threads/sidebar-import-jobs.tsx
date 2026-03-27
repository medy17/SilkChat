import { Progress } from "@/components/ui/progress"
import {
    SidebarGroup,
    SidebarGroupContent,
    SidebarGroupLabel,
    SidebarMenu
} from "@/components/ui/sidebar"
import type { api } from "@/convex/_generated/api"
import type { Id } from "@/convex/_generated/dataModel"
import { cn } from "@/lib/utils"
import type { useQuery } from "convex/react"
import { CheckCheck, CircleAlert, Clock3, Loader2 } from "lucide-react"

type ImportJobListItem = ReturnType<typeof useQuery<typeof api.import_jobs.listImportJobs>> extends
    | infer TResult
    | undefined
    ? TResult extends Array<infer Item>
        ? Item
        : never
    : never

const importJobSidebarLabel: Record<
    ImportJobListItem["status"],
    { label: string; icon: typeof Clock3 }
> = {
    queued: { label: "Queued", icon: Clock3 },
    preparing: { label: "Preparing", icon: Loader2 },
    importing: { label: "Importing", icon: Loader2 },
    completed: { label: "Completed", icon: CheckCheck },
    completed_with_errors: { label: "Completed with issues", icon: CircleAlert },
    failed: { label: "Failed", icon: CircleAlert }
}

const attachmentModeLabel = (mode: "mirror" | "external" | "skip") => {
    switch (mode) {
        case "mirror":
            return "Mirror attachments"
        case "external":
            return "Keep external links"
        case "skip":
            return "Skip attachments"
    }
}

export function ImportJobsGroup({
    jobs,
    onOpenJob
}: {
    jobs: ImportJobListItem[]
    onOpenJob: (jobId: Id<"importJobs">) => void
}) {
    if (jobs.length === 0) return null

    return (
        <SidebarGroup>
            <SidebarGroupLabel>Imports</SidebarGroupLabel>
            <SidebarGroupContent>
                <SidebarMenu>
                    {jobs.map((job) => {
                        const statusMeta = importJobSidebarLabel[job.status]
                        const StatusIcon = statusMeta.icon
                        const progressValue =
                            job.totalThreads > 0
                                ? Math.round((job.processedThreads / job.totalThreads) * 100)
                                : job.totalSourceFiles > 0
                                  ? Math.round(
                                        (job.preparedSourceFiles / job.totalSourceFiles) * 100
                                    )
                                  : job.status === "completed" ||
                                      job.status === "completed_with_errors"
                                    ? 100
                                    : 0

                        return (
                            <li key={job._id}>
                                <button
                                    type="button"
                                    onClick={() => onOpenJob(job._id)}
                                    className="flex w-full flex-col gap-2 rounded-md border bg-sidebar-accent/20 px-3 py-2 text-left transition-colors hover:bg-sidebar-accent"
                                >
                                    <div className="flex items-center gap-2">
                                        <StatusIcon
                                            className={cn(
                                                "h-4 w-4 shrink-0",
                                                (job.status === "preparing" ||
                                                    job.status === "importing") &&
                                                    "animate-spin"
                                            )}
                                        />
                                        <span className="font-medium text-sm">
                                            {statusMeta.label}
                                        </span>
                                        <span className="ml-auto text-muted-foreground text-xs">
                                            {job.importedThreads}/{job.totalThreads || "?"}
                                        </span>
                                    </div>
                                    <Progress value={progressValue} className="h-1.5" />
                                    <div className="flex items-center justify-between text-muted-foreground text-xs">
                                        <span>{attachmentModeLabel(job.attachmentMode)}</span>
                                        <span>
                                            {job.errorCount + job.warningCount} issue
                                            {job.errorCount + job.warningCount === 1 ? "" : "s"}
                                        </span>
                                    </div>
                                </button>
                            </li>
                        )
                    })}
                </SidebarMenu>
            </SidebarGroupContent>
        </SidebarGroup>
    )
}
