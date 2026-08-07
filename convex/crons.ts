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
    internal.account_deletion.processPendingAccountDeletionJobs,
    {}
)

// Per-sandbox expiry and retry work is scheduled when the sandbox is created.
// This is only a fallback for missed or interrupted lifecycle work.
crons.interval(
    "reconcile persistent sandboxes",
    { hours: 1 },
    internal.persistent_sandboxes_node.reconcilePersistentSandboxes
)

// Provider-wide listing is a last-resort guard for sandboxes with no usable DB record.
crons.interval(
    "sweep orphaned persistent sandboxes",
    { hours: 6 },
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
