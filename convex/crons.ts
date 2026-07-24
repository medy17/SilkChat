import { cronJobs } from "convex/server"
import { internal } from "./_generated/api"

const crons = cronJobs()

crons.interval(
    "cleanup stale import jobs",
    { hours: 1 },
    internal.import_jobs.cleanupStaleImportData
)

crons.interval(
    "process pending account deletion jobs",
    { minutes: 5 },
    internal.account_deletion.processPendingAccountDeletionJobs
)

crons.interval(
    "reconcile persistent sandboxes",
    { minutes: 1 },
    internal.persistent_sandboxes_node.reconcilePersistentSandboxes
)

crons.interval(
    "sweep orphaned persistent sandboxes",
    { minutes: 5 },
    internal.persistent_sandboxes_node.sweepOrphanedPersistentSandboxes
)

crons.interval(
    "sync openrouter model metadata",
    { hours: 12 },
    internal.model_provider_metadata_node.syncOpenRouterModelMetadata
)

crons.weekly(
    "queue inactive account notices",
    { dayOfWeek: "monday", hourUTC: 9, minuteUTC: 0 },
    internal.account_activity.queueInactiveAccountNotices
)

export default crons
