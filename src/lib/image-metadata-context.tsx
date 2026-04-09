import { api } from "@/convex/_generated/api"
import { useQuery } from "convex/react"
import { type ReactNode, createContext, useContext, useMemo } from "react"

type FileMetadata =
    | (Record<string, unknown> & {
          size?: number
          url?: string
      })
    | null

type ImageMetadataMap = Record<string, FileMetadata | undefined>

const ImageMetadataContext = createContext<ImageMetadataMap>({})

export function ImageMetadataProvider({
    storageKeys,
    children
}: {
    storageKeys: string[]
    children: ReactNode
}) {
    // eslint-disable-next-line react-hooks/exhaustive-deps
    const stableKeys = useMemo(() => [...storageKeys], [storageKeys.join(",")])

    const batchResult = useQuery(
        api.attachments.getFilesMetadataBatch,
        stableKeys.length > 0 ? { keys: stableKeys } : "skip"
    )

    const metadataMap = useMemo<ImageMetadataMap>(() => {
        if (!batchResult) return {}
        return batchResult
    }, [batchResult])

    return (
        <ImageMetadataContext.Provider value={metadataMap}>
            {children}
        </ImageMetadataContext.Provider>
    )
}

export function useImageMetadata(storageKey: string): {
    metadata: FileMetadata | undefined
    hasInvalidStoredImage: boolean
} {
    const metadataMap = useContext(ImageMetadataContext)
    const metadata = metadataMap[storageKey]

    const hasInvalidStoredImage =
        metadata !== undefined &&
        (!metadata || (typeof metadata.size === "number" && metadata.size <= 0))

    return { metadata, hasInvalidStoredImage }
}
