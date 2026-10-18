import type { UIMessage } from "ai"

export const resolveDeferredChatMessages = <TMessage extends UIMessage>(
    currentMessages: TMessage[],
    deferredMessages: TMessage[]
) => {
    if (currentMessages.length < deferredMessages.length) {
        return currentMessages
    }

    // The same messages with newer content (a reply's last tokens landing with the end of
    // its stream, or the saved copy replacing the streamed one) are already on screen;
    // the deferred copy would briefly show older text.
    if (
        currentMessages.length === deferredMessages.length &&
        currentMessages.every((message, index) => message.id === deferredMessages[index]?.id)
    ) {
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
