import { describe, expect, it, vi } from "vitest"

vi.mock("../../convex/_generated/server", () => ({
    internalAction: (config: { handler: unknown }) => config.handler
}))
vi.mock("../../convex/_generated/api", () => ({
    internal: {
        import_jobs: {
            getImportJobInternal: "getJob",
            claimNextImportJobThread: "claim",
            failImportJobThread: "fail",
            completeImportJobThread: "complete"
        },
        threads: { importPreparedThread: "import" },
        import_jobs_node: { processImportJobThread: "next" }
    }
}))
vi.mock("../../convex/attachments", () => ({ r2: {} }))

import { processImportJobThread } from "../../convex/import_jobs_node"
import { PDF_IMPORT_ERROR } from "@/lib/import-attachment-policy"

describe("queued PDF imports", () => {
    it.each(["mirror", "external", "skip"])(
        "rejects the conversation before attachment I/O in %s mode",
        async (attachmentMode) => {
            const fetchMock = vi.fn()
            vi.stubGlobal("fetch", fetchMock)
            const ctx = {
                runQuery: vi.fn(async () => ({ status: "importing", attachmentMode })),
                runMutation: vi.fn(async (ref) =>
                    ref === "claim"
                        ? {
                              _id: "import-thread",
                              messages: [
                                  {
                                      text: "Hello",
                                      attachments: [
                                          {
                                              filename: "download",
                                              url: "https://example.com/large.pdf?token=1"
                                          }
                                      ]
                                  }
                              ]
                          }
                        : undefined
                ),
                scheduler: { runAfter: vi.fn() }
            }
            await (
                processImportJobThread as unknown as (ctx: unknown, args: unknown) => Promise<void>
            )(ctx, { jobId: "job" })
            expect(ctx.runMutation).toHaveBeenCalledWith(
                "fail",
                expect.objectContaining({ error: PDF_IMPORT_ERROR })
            )
            expect(ctx.runMutation).not.toHaveBeenCalledWith("import", expect.anything())
            expect(fetchMock).not.toHaveBeenCalled()
        }
    )
})
