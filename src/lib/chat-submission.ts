export const CHAT_ACCEPTED_HEADER = "X-Silkchat-Accepted-Thread"
export type SubmissionResult = { accepted: boolean; threadId?: string; streamSetupFailed?: boolean }
const pending = new Map<string, (result: SubmissionResult) => void>()

export function settleChatSubmission(id: string, result: SubmissionResult) {
    const settle = pending.get(id)
    if (!settle) return
    pending.delete(id)
    settle(result)
}

// The SDK promise lasts for the whole generation, and may resolve after handling
// an error internally. Only the transport's persistence acknowledgment accepts it.
export function observeChatSubmission(
    id: string,
    send: () => Promise<unknown>
): Promise<SubmissionResult> {
    return new Promise((resolve) => {
        pending.set(id, resolve)
        try {
            Promise.resolve(send()).then(
                () => settleChatSubmission(id, { accepted: false }),
                () => settleChatSubmission(id, { accepted: false })
            )
        } catch {
            settleChatSubmission(id, { accepted: false })
        }
    })
}
