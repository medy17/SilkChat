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
    "sync openrouter model metadata",
    { hours: 12 },
    internal.model_provider_metadata_node.syncOpenRouterModelMetadata
)

export default crons
