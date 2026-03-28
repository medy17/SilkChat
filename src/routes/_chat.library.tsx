import { Alert, AlertDescription } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue
} from "@/components/ui/select"
import { Skeleton } from "@/components/ui/skeleton"
import { api } from "@/convex/_generated/api"
import { useSession } from "@/hooks/auth-hooks"
import { browserEnv } from "@/lib/browser-env"
import { createFileRoute } from "@tanstack/react-router"
import { useQuery } from "convex/react"
import { Download, Image as ImageIcon, ImageOff } from "lucide-react"
import { memo, useCallback, useMemo, useRef, useState } from "react"

export const Route = createFileRoute("/_chat/library")({
    component: LibraryPage
})

interface GeneratedAsset {
    key: string
    contentType?: string
    size?: number
    lastModified: string
    url: string
}

const formatFileSize = (bytes: number | undefined): string => {
    if (!bytes) return "Unknown size"
    const sizes = ["B", "KB", "MB", "GB"]
    const i = Math.floor(Math.log(bytes) / Math.log(1024))
    return `${(bytes / 1024 ** i).toFixed(1)} ${sizes[i]}`
}

const GeneratedImage = memo(({ asset }: { asset: GeneratedAsset }) => {
    const [isError, setIsError] = useState(false)
    const [isLoaded, setIsLoaded] = useState(false)

    const imageUrl = useMemo(() => {
        return `${browserEnv("VITE_CONVEX_API_URL")}/r2?key=${asset.key}`
    }, [asset.key])

    const handleDownload = useCallback(() => {
        window.open(imageUrl, "_blank")
    }, [imageUrl])

    const handleImageLoad = useCallback(() => {
        setIsLoaded(true)
    }, [])

    const handleImageError = useCallback(() => {
        setIsError(true)
        setIsLoaded(true)
    }, [])

    if (isError) {
        return (
            <div className="group relative aspect-square overflow-hidden rounded-xl border bg-muted/50">
                <div className="flex h-full items-center justify-center">
                    <div className="text-center">
                        <ImageOff className="mx-auto mb-2 h-8 w-8 text-muted-foreground" />
                        <p className="text-muted-foreground text-sm">Failed to load</p>
                    </div>
                </div>
                <div className="absolute inset-x-0 top-0 flex translate-y-2 justify-end opacity-0 transition-all group-hover:translate-y-0 group-hover:opacity-100">
                    <Button
                        variant="ghost"
                        size="sm"
                        onClick={handleDownload}
                        className="m-2 h-8 w-8 rounded-full bg-background/80 p-0 backdrop-blur-sm hover:bg-background"
                    >
                        <Download className="h-4 w-4" />
                    </Button>
                </div>
            </div>
        )
    }

    return (
        <div className="group relative overflow-hidden rounded-xl border bg-background">
            {!isLoaded && <div className="absolute inset-0 animate-pulse bg-muted" />}
            <img
                src={imageUrl}
                alt="AI generation"
                className="h-auto w-full object-cover transition-transform duration-300 group-hover:scale-105"
                onLoad={handleImageLoad}
                onError={handleImageError}
                loading="lazy"
            />
            <div className="absolute inset-x-0 top-0 flex translate-y-2 justify-end opacity-0 transition-all group-hover:translate-y-0 group-hover:opacity-100">
                <Button
                    variant="ghost"
                    size="sm"
                    onClick={handleDownload}
                    className="m-2 h-8 w-8 rounded-full bg-background/80 p-0 backdrop-blur-sm hover:bg-background"
                >
                    <Download className="h-4 w-4" />
                </Button>
            </div>
            <div className="absolute inset-x-0 bottom-0 translate-y-2 bg-gradient-to-t from-black/50 to-transparent p-2 opacity-0 transition-all group-hover:translate-y-0 group-hover:opacity-100">
                <div className="text-white text-xs">
                    <p>{formatFileSize(asset.size)}</p>
                    <p>{new Date(asset.lastModified).toLocaleDateString()}</p>
                </div>
            </div>
        </div>
    )
})

GeneratedImage.displayName = "GeneratedImage"

const MasonryGrid = memo(({ assets }: { assets: GeneratedAsset[] }) => {
    if (assets.length === 0) {
        return (
            <div className="py-24 text-center">
                <ImageIcon className="mx-auto mb-4 h-16 w-16 text-muted-foreground" />
                <h3 className="mb-2 font-medium text-xl">No generated images yet</h3>
                <p className="mx-auto max-w-sm text-muted-foreground">
                    Generate images through the chat interface to see them appear here.
                </p>
            </div>
        )
    }

    return (
        <div className="columns-1 gap-4 sm:columns-2 md:columns-3 lg:columns-4 xl:columns-5">
            {assets.map((asset) => (
                <div key={asset.key} className="mb-4 break-inside-avoid">
                    <GeneratedImage asset={asset} />
                </div>
            ))}
        </div>
    )
})

MasonryGrid.displayName = "MasonryGrid"

function LibraryPage() {
    const session = useSession()
    const [sortBy, setSortBy] = useState<"newest" | "oldest" | "size">("newest")
    const filesResult = useQuery(
        api.attachments.listGeneratedFiles,
        session.user?.id ? { sortBy } : "skip"
    )

    const generatedAssets = useMemo(() => {
        if (!filesResult) return null

        // Handle the file list data structure
        let files: GeneratedAsset[] = []
        if (Array.isArray(filesResult)) {
            files = filesResult as GeneratedAsset[]
        } else if (
            filesResult &&
            typeof filesResult === "object" &&
            "page" in filesResult &&
            Array.isArray(filesResult.page)
        ) {
            files = filesResult.page as GeneratedAsset[]
        }

        return [...files]
    }, [filesResult])

    const lastResolvedAssetsRef = useRef<GeneratedAsset[] | null>(null)
    if (generatedAssets !== null) {
        lastResolvedAssetsRef.current = generatedAssets
    }

    const visibleAssets = generatedAssets ?? lastResolvedAssetsRef.current

    const stats = useMemo(() => {
        if (!visibleAssets || visibleAssets.length === 0) {
            return { totalSize: 0, count: 0 }
        }

        const totalSize = visibleAssets.reduce((sum, asset) => sum + (asset.size || 0), 0)
        return { totalSize, count: visibleAssets.length }
    }, [visibleAssets])

    if (!session.user?.id) {
        return (
            <div className="container mx-auto max-w-6xl px-4 pt-12 pb-8">
                <div className="mb-8">
                    <h1 className="mb-2 font-bold text-3xl">AI Library</h1>
                    <p className="text-muted-foreground">Your collection of AI-generated images</p>
                </div>
                <Alert>
                    <AlertDescription>
                        Sign in to view your AI-generated image library.
                    </AlertDescription>
                </Alert>
            </div>
        )
    }

    return (
        <div className="max-h-dvh overflow-y-auto p-4 pt-0">
            <div className="container mx-auto max-w-6xl pt-12 pb-16">
                <div className="mb-8">
                    <h1 className="mb-2 font-bold text-3xl">AI Library</h1>
                    <p className="text-muted-foreground">Your collection of AI-generated images</p>
                    {visibleAssets && (
                        <div className="mt-4 flex gap-6 text-muted-foreground text-sm">
                            <span>{stats.count} images</span>
                            <span>{formatFileSize(stats.totalSize)} total</span>
                        </div>
                    )}

                    {/* Sort Controls */}
                    {visibleAssets && visibleAssets.length > 0 && (
                        <div className="mt-6 flex justify-start">
                            <Select
                                value={sortBy}
                                onValueChange={(value: "newest" | "oldest" | "size") =>
                                    setSortBy(value)
                                }
                            >
                                <SelectTrigger className="w-48">
                                    <SelectValue placeholder="Sort by" />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="newest">Newest first</SelectItem>
                                    <SelectItem value="oldest">Oldest first</SelectItem>
                                    <SelectItem value="size">Largest first</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>
                    )}
                </div>

                {!visibleAssets ? (
                    <div className="columns-1 gap-4 sm:columns-2 md:columns-3 lg:columns-4 xl:columns-5">
                        {Array.from({ length: 12 }).map((_, i) => (
                            <div
                                key={i}
                                className="mb-4 break-inside-avoid"
                                style={{ height: `${Math.random() * 150 + 250}px` }}
                            >
                                <Skeleton className="h-full w-full rounded-xl" />
                            </div>
                        ))}
                    </div>
                ) : (
                    <MasonryGrid assets={visibleAssets} />
                )}
            </div>
        </div>
    )
}
