import { cronJobs } from "convex/server"
import { internal } from "./_generated/api"

const crons = cronJobs()
crons.interval(
    "cleanup image search candidates",
    { hours: 1 },
    internal.visuals_node.cleanupExpired
)

crons.interval(
    "cleanup stale import jobs",
    { hours: 1 },
    internal.import_jobs.cleanupStaleImportData
)

crons.interval(
    "sweep expired temporary chats",
    { hours: 24 },
    internal.threads.sweepExpiredTemporaryThreads,
    {}
)

crons.interval(
    "process pending account deletion jobs",
    { minutes: 5 },
    internal.account_deletion.processPendingAccountDeletionJobs,
    {}
)

crons.interval("reconcile computers", { minutes: 15 }, internal.computers_node.reconcileComputers)

// What each computer stored since the last run, against the owner's monthly allowance.
crons.interval(
    "charge computer storage",
    { hours: 24 },
    internal.computers.chargeComputerStorage,
    {}
)

// Archiving, warning emails, and deletion for dormant computers.
crons.interval(
    "run computer retention",
    { hours: 24 },
    internal.computers_node.runComputerRetention
)

crons.interval(
    "sync openrouter model metadata",
    { hours: 12 },
    internal.model_provider_metadata_node.syncOpenRouterModelMetadata
)

crons.daily(
    "sweep stale unused reference uploads",
    { hourUTC: 4, minuteUTC: 0 },
    internal.reference_uploads.sweepStaleReferenceUploads
)

crons.weekly(
    "queue inactive account notices",
    { dayOfWeek: "monday", hourUTC: 9, minuteUTC: 0 },
    internal.account_activity.queueInactiveAccountNotices
)

export default crons
