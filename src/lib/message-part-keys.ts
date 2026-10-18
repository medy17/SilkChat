import type { UIMessage } from "ai"

type MessagePart = UIMessage["parts"][number]

export const getMessagePartKey = (messageId: string, part: MessagePart, index: number) => {
    if ("toolCallId" in part && typeof part.toolCallId === "string" && part.toolCallId.length > 0) {
        return `${messageId}-tool-${part.toolCallId}`
    }

    return `${messageId}-${part.type}-${index}`
}

// Keys parts by their position among parts of the same type, not their index in
// message.parts. A streamed message carries SDK step-start markers that Convex doesn't
// persist, so when the saved reply is adopted at the end of a stream every index shifts,
// and index keys would remount the whole reply.
export const getInlinePartKeys = (messageId: string, parts: MessagePart[]) => {
    const seen = new Map<string, number>()
    return parts.map((part) => {
        const ordinal = seen.get(part.type) ?? 0
        seen.set(part.type, ordinal + 1)
        return getMessagePartKey(messageId, part, ordinal)
    })
}
