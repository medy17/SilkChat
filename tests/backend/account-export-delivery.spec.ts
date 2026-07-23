import { beforeEach, describe, expect, it, vi } from "vitest"

const { deleteObject, sendAccountExportEmail } = vi.hoisted(() => ({
    deleteObject: vi.fn(),
    sendAccountExportEmail: vi.fn()
}))

vi.mock("convex/values", () => {
    const passthrough = () => ({})
    return { v: new Proxy({}, { get: () => passthrough }) }
})

vi.mock("../../convex/_generated/server", () => ({
    action: (config: unknown) => config,
    internalAction: (config: unknown) => config
}))

vi.mock("../../convex/_generated/api", () => ({
    internal: {
        account_exports: {
            getAccountExportForDelivery: "getAccountExportForDelivery",
            markAccountExportDelivered: "markAccountExportDelivered",
            failAccountExport: "failAccountExport"
        },
        account_exports_node: {
            deliverAccountExportEmail: "deliverAccountExportEmail"
        }
    }
}))

vi.mock("../../convex/account_exports", () => ({
    ACCOUNT_EXPORT_EMAIL_MAX_RETRIES: 3,
    getAccountExportConfiguration: () => ({ configured: true, missing: [] }),
    getAccountExportEmailRetryDelayMs: (attempt: number) => 300_000 * 2 ** attempt
}))

vi.mock("../../convex/attachments", () => ({
    r2: {
        deleteObject,
        listMetadata: vi.fn(),
        store: vi.fn()
    }
}))

vi.mock("../../convex/auth", () => ({
    authComponent: { adapter: vi.fn() }
}))

vi.mock("../../convex/lib/encryption", () => ({
    decryptKey: vi.fn(),
    encryptKey: vi.fn()
}))

vi.mock("../../convex/lib/file_listing", () => ({
    getUserVisibleFilePrefixes: vi.fn(() => [])
}))

vi.mock("../../convex/lib/identity", () => ({
    getUserIdentity: vi.fn()
}))

vi.mock("../../src/lib/account-export", () => ({
    buildEncryptedAccountExportArchive: vi.fn()
}))

vi.mock("../../src/lib/thread-export", () => ({
    buildThreadExportFileName: vi.fn(),
    serializeThreadToMarkdown: vi.fn()
}))

vi.mock("../../src/lib/email", () => ({
    sendAccountExportEmail
}))

import { deliverAccountExportEmail } from "../../convex/account_exports_node"

const deliveryHandler = (
    deliverAccountExportEmail as unknown as {
        handler: (
            ctx: {
                runMutation: ReturnType<typeof vi.fn>
                scheduler: { runAfter: ReturnType<typeof vi.fn> }
            },
            args: { jobId: string; attempt?: number }
        ) => Promise<void>
    }
).handler

beforeEach(() => {
    vi.clearAllMocks()
})

describe("account export email delivery", () => {
    it("deletes the archive and marks the job failed after the final delivery attempt", async () => {
        const job = {
            email: "person@example.com",
            downloadUrl: "https://files.example.com/account-exports/user-1/job-1.zip",
            objectKey: "account-exports/user-1/job-1.zip"
        }
        const runMutation = vi.fn().mockResolvedValueOnce(job).mockResolvedValueOnce(undefined)
        const scheduler = { runAfter: vi.fn() }
        sendAccountExportEmail.mockRejectedValue(new Error("Resend unavailable"))
        deleteObject.mockResolvedValue(undefined)

        await deliveryHandler(
            {
                runMutation,
                scheduler
            },
            { jobId: "job-1", attempt: 3 }
        )

        expect(deleteObject).toHaveBeenCalledWith(
            expect.anything(),
            "account-exports/user-1/job-1.zip"
        )
        expect(scheduler.runAfter).not.toHaveBeenCalled()
        expect(runMutation).toHaveBeenLastCalledWith("failAccountExport", {
            jobId: "job-1",
            error: "Resend unavailable",
            deliveryAttempts: 4
        })
    })
})
