export const MESSAGE_DIRECT_RENDER_LIMIT = 40

export const getVirtualizedMessageCount = (messageCount: number) =>
    Math.max(0, messageCount - MESSAGE_DIRECT_RENDER_LIMIT)

export const shouldVirtualizeMessageList = (messageCount: number) =>
    getVirtualizedMessageCount(messageCount) > 0
