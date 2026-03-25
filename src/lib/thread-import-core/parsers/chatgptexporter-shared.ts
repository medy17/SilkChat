const CHATGPT_CONVERSATION_ID_REGEX = /\/c\/([a-zA-Z0-9-]+)/

export const extractChatGPTConversationIdFromUrl = (url?: string) => {
    if (!url) return undefined
    const match = url.match(CHATGPT_CONVERSATION_ID_REGEX)
    return match?.[1]
}
