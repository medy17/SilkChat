export type CanonicalChatRouteTarget =
    | {
          pathname: string
          to: "/thread/$threadId"
          params: {
              threadId: string
          }
      }
    | {
          pathname: string
          to: "/folder/$folderId/thread/$threadId"
          params: {
              folderId: string
              threadId: string
          }
      }

export const getCanonicalChatRouteTarget = ({
    pathname,
    threadId,
    folderId
}: {
    pathname: string
    threadId: string
    folderId?: string
}): CanonicalChatRouteTarget | null => {
    if (folderId) {
        const folderThreadPath = `/folder/${folderId}/thread/${threadId}`

        if (pathname === folderThreadPath) {
            return null
        }

        return {
            pathname: folderThreadPath,
            to: "/folder/$folderId/thread/$threadId",
            params: {
                folderId,
                threadId
            }
        }
    }

    const threadPath = `/thread/${threadId}`

    if (pathname === threadPath) {
        return null
    }

    return {
        pathname: threadPath,
        to: "/thread/$threadId",
        params: {
            threadId
        }
    }
}
