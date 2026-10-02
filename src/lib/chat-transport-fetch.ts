const RECONNECT_REQUEST_TIMEOUT_MS = 15_000
import { CHAT_ACCEPTED_HEADER, settleChatSubmission } from "./chat-submission"

type FetchImplementation = typeof globalThis.fetch

export const createChatTransportFetch = (
    fetchImplementation: FetchImplementation = globalThis.fetch,
    reconnectTimeoutMs = RECONNECT_REQUEST_TIMEOUT_MS
): FetchImplementation => {
    return async (input, init) => {
        if (init?.method?.toUpperCase() !== "GET") {
            let submissionId: string | undefined
            if (typeof init?.body === "string") {
                try {
                    submissionId = JSON.parse(init.body).submissionId
                } catch {
                    /* Not a chat payload. */
                }
            }
            try {
                const response = await fetchImplementation(input, init)
                if (submissionId) {
                    const threadId = response.headers.get(CHAT_ACCEPTED_HEADER)
                    settleChatSubmission(submissionId, {
                        accepted: Boolean(threadId),
                        ...(threadId && !response.ok ? { streamSetupFailed: true } : {}),
                        ...(threadId ? { threadId } : {})
                    })
                }
                return response
            } catch (error) {
                if (submissionId) settleChatSubmission(submissionId, { accepted: false })
                throw error
            }
        }

        const controller = new AbortController()
        const parentSignal = init.signal
        const abortFromParent = () => controller.abort(parentSignal?.reason)

        if (parentSignal?.aborted) {
            abortFromParent()
        } else {
            parentSignal?.addEventListener("abort", abortFromParent, { once: true })
        }

        const timeout = globalThis.setTimeout(() => controller.abort(), reconnectTimeoutMs)

        try {
            return await fetchImplementation(input, {
                ...init,
                signal: controller.signal
            })
        } finally {
            globalThis.clearTimeout(timeout)
            parentSignal?.removeEventListener("abort", abortFromParent)
        }
    }
}
