let nextSuppressedChatTransitionPath: string | null = null

export const suppressNextChatTransitionForPath = (pathname: string) => {
    nextSuppressedChatTransitionPath = pathname
}

export const consumeSuppressedChatTransitionForPath = (pathname: string) => {
    if (nextSuppressedChatTransitionPath !== pathname) {
        return false
    }

    nextSuppressedChatTransitionPath = null
    return true
}
