import type { GenerationConfig } from "./assistant-config"
import type { ComposerSession } from "./composer-session"

// A saved edit closes its editor before the backend accepts it. If the request is
// rejected, the reopened editor resumes from this snapshot instead of the saved message.
export type MessageEditRecovery = {
    session: ComposerSession
    text: string
    deletedUrls: string[]
    config: GenerationConfig
}

const recoveries = new Map<string, MessageEditRecovery>()

export const stashMessageEditRecovery = (messageId: string, recovery: MessageEditRecovery) =>
    recoveries.set(messageId, recovery)

export const peekMessageEditRecovery = (messageId: string) => recoveries.get(messageId)

export function takeMessageEditRecovery(messageId: string) {
    const recovery = recoveries.get(messageId)
    recoveries.delete(messageId)
    return recovery
}
