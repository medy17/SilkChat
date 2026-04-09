import { api } from "@/convex/_generated/api"
import { useConvex } from "convex/react"
import { type ReactNode, createContext, useContext, useEffect, useMemo, useState } from "react"

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
    const convex = useConvex()
    // eslint-disable-next-line react-hooks/exhaustive-deps
    const stableKeys = useMemo(() => [...storageKeys], [storageKeys.join(",")])
    const [batchResult, setBatchResult] = useState<ImageMetadataMap>({})

    useEffect(() => {
        let cancelled = false

        if (stableKeys.length === 0) {
            setBatchResult({})
            return
        }

        convex
            .query(api.attachments.getFilesMetadataBatch, { keys: stableKeys })
            .then((result) => {
                if (!cancelled) {
                    setBatchResult(result)
                }
            })
            .catch((error) => {
                console.error("Failed to load image metadata batch:", error)
                if (!cancelled) {
                    setBatchResult({})
                }
            })

        return () => {
            cancelled = true
        }
    }, [convex, stableKeys])

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
