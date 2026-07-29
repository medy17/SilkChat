import type { UIMessage } from "ai"

export const resolveDeferredChatMessages = <TMessage extends UIMessage>(
    currentMessages: TMessage[],
    deferredMessages: TMessage[]
) => {
    if (currentMessages.length < deferredMessages.length) {
        return currentMessages
    }

    const currentLastMessage = currentMessages.at(-1)
    const deferredLastMessage = deferredMessages.at(-1)
    const serverClearedAssistant =
        currentLastMessage?.role === "assistant" &&
        currentLastMessage.parts.length === 0 &&
        deferredLastMessage?.id === currentLastMessage.id &&
        deferredLastMessage.role === "assistant" &&
        deferredLastMessage.parts.length > 0

    return serverClearedAssistant ? currentMessages : deferredMessages
}
