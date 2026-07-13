import { SettingsLayout } from "@/components/settings/settings-layout"
import { Alert, AlertDescription } from "@/components/ui/alert"
import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
    AlertDialogTrigger
} from "@/components/ui/alert-dialog"
import { Button } from "@/components/ui/button"
import {
    Pagination,
    PaginationContent,
    PaginationItem,
    PaginationLink,
    PaginationNext,
    PaginationPrevious
} from "@/components/ui/pagination"
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue
} from "@/components/ui/select"
import { Skeleton } from "@/components/ui/skeleton"
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow
} from "@/components/ui/table"
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip"
import { api } from "@/convex/_generated/api"
import { useSession } from "@/hooks/auth-hooks"
import { getFileThumbnailSources } from "@/lib/generated-image-urls"
import { getPublicR2AssetUrl } from "@/lib/r2-public-url"
import { createFileRoute, useNavigate } from "@tanstack/react-router"
import { useMutation, useQuery } from "convex/react"
import {
    ArrowDown,
    ArrowUp,
    ExternalLink,
    File,
    FileImage,
    FileText,
    Music,
    Trash2,
    Video
} from "lucide-react"
import { type ComponentType, useCallback, useEffect, useMemo, useState } from "react"
import { toast } from "sonner"

type FileTypeFilter = "all" | "image" | "pdf" | "text" | "other"
type FileSort = "newest" | "oldest"

const PAGE_SIZE = 20

const FILE_FILTERS: { value: FileTypeFilter; label: string }[] = [
    { value: "all", label: "All files" },
    { value: "image", label: "Images" },
    { value: "pdf", label: "PDF documents" },
    { value: "text", label: "Text documents" },
    { value: "other", label: "Other files" }
]

const parsePositiveInteger = (value: unknown, fallback: number) => {
    const parsed = typeof value === "number" ? value : Number(value)
    return Number.isSafeInteger(parsed) && parsed > 0 ? parsed : fallback
}

export const Route = createFileRoute("/settings/files")({
    validateSearch: (search: Record<string, unknown>) => ({
        type: FILE_FILTERS.some((option) => option.value === search.type)
            ? (search.type as FileTypeFilter)
            : "all",
        sort: search.sort === "oldest" ? ("oldest" as const) : ("newest" as const),
        page: parsePositiveInteger(search.page, 1)
    }),
    component: FilesSettingsRoute
})

interface FileMetadata {
    key: string
    contentType?: string
    size?: number
    lastModified: string
}

const formatFileSize = (bytes: number | undefined) => {
    if (bytes === undefined) return "Unknown size"
    if (bytes === 0) return "0 B"

    const units = ["B", "KB", "MB", "GB"]
    const unitIndex = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), units.length - 1)
    const value = bytes / 1024 ** unitIndex
    return `${value.toFixed(unitIndex === 0 ? 0 : 1)} ${units[unitIndex]}`
}

const getFileName = (key: string) => {
    const lastSegment = key.split("/").at(-1) ?? "Unknown file"
    const match = lastSegment.match(/^\d+-[a-f0-9-]{36}-(.+)$/i)
    return match?.[1] || lastSegment
}

const getFileIcon = (contentType: string | undefined): ComponentType<{ className?: string }> => {
    if (contentType?.startsWith("image/")) return FileImage
    if (contentType?.startsWith("video/")) return Video
    if (contentType?.startsWith("audio/")) return Music
    if (contentType === "application/pdf" || contentType?.startsWith("text/")) return FileText
    return File
}

function FilePreview({ file }: { file: FileMetadata }) {
    const Icon = getFileIcon(file.contentType)
    const [imagePhase, setImagePhase] = useState<"optimized" | "direct" | "error">("optimized")

    if (file.contentType?.startsWith("image/") && imagePhase !== "error") {
        const optimizedSources = getFileThumbnailSources(file.key)
        const isOptimized = imagePhase === "optimized"

        return (
            <img
                src={isOptimized ? optimizedSources.src : getPublicR2AssetUrl(file.key)}
                srcSet={isOptimized ? optimizedSources.srcSet : undefined}
                sizes={isOptimized ? optimizedSources.sizes : undefined}
                alt=""
                className="size-12 shrink-0 rounded-md border bg-muted object-cover"
                loading="lazy"
                decoding="async"
                onError={() => {
                    setImagePhase((current) => (current === "optimized" ? "direct" : "error"))
                }}
            />
        )
    }

    return (
        <div className="flex size-12 shrink-0 items-center justify-center rounded-md border bg-muted">
            <Icon className="size-5 text-muted-foreground" />
        </div>
    )
}

function FilesTableSkeleton() {
    return (
        <div className="overflow-hidden rounded-lg border">
            {Array.from({ length: 6 }).map((_, index) => (
                <div key={index} className="flex items-center gap-4 border-b p-4 last:border-b-0">
                    <Skeleton className="size-12 rounded-md" />
                    <div className="flex-1 space-y-2">
                        <Skeleton className="h-4 w-48 max-w-full" />
                        <Skeleton className="h-3 w-32 max-w-full" />
                    </div>
                    <Skeleton className="hidden h-4 w-24 sm:block" />
                    <Skeleton className="size-9" />
                </div>
            ))}
        </div>
    )
}

function FilesSettingsRoute() {
    const navigate = useNavigate({ from: "/settings/files" })
    const search = Route.useSearch()
    const session = useSession()
    const deleteFile = useMutation(api.attachments.deleteFile)
    const cursor = search.page > 1 ? String((search.page - 1) * PAGE_SIZE) : null
    const filesResult = useQuery(
        api.attachments.listFiles,
        session.user?.id
            ? {
                  paginationOpts: { numItems: PAGE_SIZE, cursor },
                  type: search.type,
                  sort: search.sort
              }
            : "skip"
    )

    const files = useMemo(() => filesResult?.page ?? [], [filesResult])
    const canGoPrevious = search.page > 1
    const canGoNext = filesResult ? !filesResult.isDone : false

    useEffect(() => {
        if (!filesResult || search.page <= 1) return
        if (filesResult.page.length > 0 || !filesResult.isDone) return

        navigate({
            replace: true,
            search: (previous) => ({ ...previous, page: Math.max(1, previous.page - 1) })
        })
    }, [filesResult, navigate, search.page])

    const handleDelete = useCallback(
        async (key: string) => {
            try {
                const result = await deleteFile({ key })
                if (result.success) toast.success("File deleted")
                else toast.error(result.error || "Failed to delete file")
            } catch (error) {
                console.error("Delete error:", error)
                toast.error("Failed to delete file")
            }
        },
        [deleteFile]
    )

    const handleFilterChange = (type: FileTypeFilter) => {
        navigate({ replace: true, search: (previous) => ({ ...previous, type, page: 1 }) })
    }

    const handleSortToggle = () => {
        navigate({
            replace: true,
            search: (previous) => ({
                ...previous,
                sort: previous.sort === "newest" ? "oldest" : "newest",
                page: 1
            })
        })
    }

    if (!session.user?.id) {
        return (
            <SettingsLayout
                title="Files"
                description="Review and manage the files stored by Silkchat."
            >
                <Alert>
                    <AlertDescription>Sign in to view and manage your files.</AlertDescription>
                </Alert>
            </SettingsLayout>
        )
    }

    return (
        <SettingsLayout
            title="Files"
            description="Manage files uploaded or created in Silkchat. Deleting a file makes it unavailable anywhere it is used, but does not delete the related conversation."
        >
            <div className="space-y-5">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                    <Select value={search.type} onValueChange={handleFilterChange}>
                        <SelectTrigger className="w-full sm:w-56" aria-label="Filter files by type">
                            <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                            {FILE_FILTERS.map((filter) => (
                                <SelectItem key={filter.value} value={filter.value}>
                                    {filter.label}
                                </SelectItem>
                            ))}
                        </SelectContent>
                    </Select>

                    <Button variant="outline" onClick={handleSortToggle}>
                        {search.sort === "newest" ? (
                            <ArrowDown className="size-4" />
                        ) : (
                            <ArrowUp className="size-4" />
                        )}
                        {search.sort === "newest" ? "Newest first" : "Oldest first"}
                    </Button>
                </div>

                {filesResult === undefined ? (
                    <FilesTableSkeleton />
                ) : files.length === 0 ? (
                    <div className="rounded-lg border py-16 text-center">
                        <File className="mx-auto mb-4 size-10 text-muted-foreground" />
                        <h3 className="font-medium">No files found</h3>
                        <p className="mt-1 text-muted-foreground text-sm">
                            {search.type === "all"
                                ? "Files you upload or create will appear here."
                                : "No files match this type filter."}
                        </p>
                    </div>
                ) : (
                    <div className="overflow-hidden rounded-lg border">
                        <Table className="table-fixed">
                            <TableHeader>
                                <TableRow className="hover:bg-transparent">
                                    <TableHead className="pl-4">Name</TableHead>
                                    <TableHead className="hidden w-32 sm:table-cell">
                                        Size
                                    </TableHead>
                                    <TableHead className="hidden w-40 md:table-cell">
                                        Created
                                    </TableHead>
                                    <TableHead className="w-16 pr-4 text-right">
                                        <span className="sr-only">Actions</span>
                                    </TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {files.map((file) => {
                                    const fileName = getFileName(file.key)
                                    const fileUrl = getPublicR2AssetUrl(file.key)

                                    return (
                                        <TableRow key={file.key}>
                                            <TableCell className="min-w-0 py-3 pl-4">
                                                <div className="flex min-w-0 items-center gap-3">
                                                    <FilePreview file={file} />
                                                    <div className="min-w-0 flex-1">
                                                        <Tooltip>
                                                            <TooltipTrigger asChild>
                                                                <a
                                                                    href={fileUrl}
                                                                    target="_blank"
                                                                    rel="noreferrer"
                                                                    className="flex min-w-0 max-w-full items-center gap-1 font-medium hover:underline"
                                                                >
                                                                    <span className="block min-w-0 truncate">
                                                                        {fileName}
                                                                    </span>
                                                                    <ExternalLink className="size-3.5 shrink-0 text-muted-foreground" />
                                                                </a>
                                                            </TooltipTrigger>
                                                            <TooltipContent
                                                                side="top"
                                                                sideOffset={6}
                                                                className="max-w-sm break-all"
                                                            >
                                                                {fileName}
                                                            </TooltipContent>
                                                        </Tooltip>
                                                        <p className="truncate text-muted-foreground text-xs">
                                                            {file.contentType || "Unknown type"}
                                                            <span className="sm:hidden">
                                                                {` · ${formatFileSize(file.size)}`}
                                                            </span>
                                                        </p>
                                                    </div>
                                                </div>
                                            </TableCell>
                                            <TableCell className="hidden text-muted-foreground sm:table-cell">
                                                {formatFileSize(file.size)}
                                            </TableCell>
                                            <TableCell className="hidden text-muted-foreground md:table-cell">
                                                {new Date(file.lastModified).toLocaleDateString()}
                                            </TableCell>
                                            <TableCell className="pr-4 text-right">
                                                <AlertDialog>
                                                    <AlertDialogTrigger asChild>
                                                        <Button
                                                            variant="ghost"
                                                            size="icon"
                                                            className="text-destructive hover:text-destructive"
                                                            aria-label={`Delete ${fileName}`}
                                                        >
                                                            <Trash2 className="size-4" />
                                                        </Button>
                                                    </AlertDialogTrigger>
                                                    <AlertDialogContent>
                                                        <AlertDialogHeader>
                                                            <AlertDialogTitle>
                                                                Delete file?
                                                            </AlertDialogTitle>
                                                            <AlertDialogDescription>
                                                                “{fileName}” will become unavailable
                                                                in conversations and other places
                                                                where it is used. This cannot be
                                                                undone.
                                                            </AlertDialogDescription>
                                                        </AlertDialogHeader>
                                                        <AlertDialogFooter>
                                                            <AlertDialogCancel>
                                                                Cancel
                                                            </AlertDialogCancel>
                                                            <AlertDialogAction
                                                                onClick={() =>
                                                                    handleDelete(file.key)
                                                                }
                                                                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                                                            >
                                                                Delete file
                                                            </AlertDialogAction>
                                                        </AlertDialogFooter>
                                                    </AlertDialogContent>
                                                </AlertDialog>
                                            </TableCell>
                                        </TableRow>
                                    )
                                })}
                            </TableBody>
                        </Table>
                    </div>
                )}

                {(canGoPrevious || canGoNext) && (
                    <Pagination>
                        <PaginationContent>
                            <PaginationItem>
                                <PaginationPrevious
                                    href="#files-list"
                                    className={
                                        canGoPrevious ? undefined : "pointer-events-none opacity-50"
                                    }
                                    onClick={(event) => {
                                        event.preventDefault()
                                        if (!canGoPrevious) return
                                        navigate({
                                            search: (previous) => ({
                                                ...previous,
                                                page: previous.page - 1
                                            })
                                        })
                                    }}
                                />
                            </PaginationItem>
                            <PaginationItem>
                                <PaginationLink
                                    href="#files-list"
                                    isActive
                                    size="default"
                                    className="min-w-10"
                                    onClick={(event) => event.preventDefault()}
                                >
                                    {search.page}
                                </PaginationLink>
                            </PaginationItem>
                            <PaginationItem>
                                <PaginationNext
                                    href="#files-list"
                                    className={
                                        canGoNext ? undefined : "pointer-events-none opacity-50"
                                    }
                                    onClick={(event) => {
                                        event.preventDefault()
                                        if (!canGoNext) return
                                        navigate({
                                            search: (previous) => ({
                                                ...previous,
                                                page: previous.page + 1
                                            })
                                        })
                                    }}
                                />
                            </PaginationItem>
                        </PaginationContent>
                    </Pagination>
                )}
            </div>
        </SettingsLayout>
    )
}
