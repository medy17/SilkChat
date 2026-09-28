import { Card } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"
import { cn } from "@/lib/utils"
import type { ReactNode } from "react"

/*
 * Settings loading convention:
 * - The section's SettingsLayout header is static, so it always renders; only the
 *   data-dependent body is swapped for a skeleton.
 * - Skeletons mirror the real layout (same cards, grids, and row shapes) so nothing
 *   jumps when data arrives.
 * - Spinners are reserved for in-flight actions (e.g. a Save button), never for
 *   first loads.
 * - Refetches after a mutation keep the current content mounted instead of
 *   returning to the skeleton.
 */

export function SettingsSkeleton({
    label,
    className,
    children
}: {
    label: string
    className?: string
    children: ReactNode
}) {
    return (
        <div role="status" aria-busy="true">
            <span className="sr-only">{label}</span>
            <div aria-hidden="true" className={cn("space-y-6", className)}>
                {children}
            </div>
        </div>
    )
}

export function SkeletonSectionHeading({ description = false }: { description?: boolean }) {
    return (
        <div className="space-y-2">
            <Skeleton className="h-5 w-36" />
            {description ? <Skeleton className="h-4 w-64 max-w-full" /> : null}
        </div>
    )
}

export function SkeletonField({ multiline = false }: { multiline?: boolean }) {
    return (
        <div className="space-y-2">
            <Skeleton className="h-4 w-28" />
            <Skeleton className={cn("w-full", multiline ? "h-24" : "h-9")} />
        </div>
    )
}

type SkeletonRowLeading = "icon" | "avatar" | "none"
type SkeletonRowTrailing = "switch" | "button" | "actions" | "none"

export function SkeletonCardRow({
    leading = "icon",
    trailing = "none",
    className
}: {
    leading?: SkeletonRowLeading
    trailing?: SkeletonRowTrailing
    className?: string
}) {
    return (
        <Card className={cn("flex-row items-center gap-3 p-4 shadow-none", className)}>
            {leading === "icon" ? <Skeleton className="size-8 shrink-0" /> : null}
            {leading === "avatar" ? <Skeleton className="size-10 shrink-0 rounded-full" /> : null}
            <div className="min-w-0 flex-1 space-y-2">
                <Skeleton className="h-4 w-40 max-w-full" />
                <Skeleton className="h-3 w-64 max-w-full" />
            </div>
            {trailing === "switch" ? <Skeleton className="h-5 w-9 shrink-0 rounded-full" /> : null}
            {trailing === "button" ? <Skeleton className="h-9 w-20 shrink-0" /> : null}
            {trailing === "actions" ? (
                <div className="flex shrink-0 gap-1">
                    <Skeleton className="size-9" />
                    <Skeleton className="size-9" />
                </div>
            ) : null}
        </Card>
    )
}

function SkeletonRows({ count, children }: { count: number; children: ReactNode }) {
    return (
        <div className="space-y-3">
            {Array.from({ length: count }, (_, index) => (
                <div key={index}>{children}</div>
            ))}
        </div>
    )
}

export function AccountSettingsSkeleton() {
    return (
        <SettingsSkeleton label="Loading account">
            <div className="grid gap-6 lg:grid-cols-2">
                <Card className="gap-6 p-6">
                    <Skeleton className="h-5 w-40" />
                    <Skeleton className="size-20 rounded-full" />
                    <div className="grid gap-4">
                        {["w-32", "w-48", "w-56"].map((width) => (
                            <div key={width} className="space-y-2">
                                <Skeleton className="h-4 w-16" />
                                <Skeleton className={cn("h-4", width)} />
                            </div>
                        ))}
                    </div>
                </Card>
                <Card className="gap-6 p-6">
                    <Skeleton className="h-5 w-32" />
                    <div className="space-y-4">
                        {[0, 1].map((index) => (
                            <div key={index} className="space-y-1.5">
                                <div className="flex justify-between">
                                    <Skeleton className="h-3 w-10" />
                                    <Skeleton className="h-3 w-12" />
                                </div>
                                <Skeleton className="h-2 w-full" />
                            </div>
                        ))}
                    </div>
                </Card>
            </div>
            <Card className="gap-6 p-6">
                <div className="space-y-2">
                    <Skeleton className="h-5 w-36" />
                    <Skeleton className="h-4 w-64 max-w-full" />
                </div>
                <SessionListSkeleton />
            </Card>
        </SettingsSkeleton>
    )
}

export function SessionListSkeleton() {
    return (
        <div className="space-y-3">
            {[0, 1].map((index) => (
                <div
                    key={index}
                    className="flex items-center justify-between gap-3 rounded-lg border p-3"
                >
                    <div className="flex flex-1 items-start gap-3">
                        <Skeleton className="size-5 shrink-0" />
                        <div className="flex-1 space-y-2">
                            <Skeleton className="h-4 w-32" />
                            <Skeleton className="h-3 w-44 max-w-full" />
                        </div>
                    </div>
                    <Skeleton className="h-8 w-20 shrink-0" />
                </div>
            ))}
        </div>
    )
}

export function BehaviorSettingsSkeleton() {
    return (
        <SettingsSkeleton label="Loading behavior settings" className="space-y-8">
            <div className="space-y-6">
                <SkeletonSectionHeading />
                <SkeletonField />
                <SkeletonField multiline />
                <SkeletonField multiline />
            </div>
            <div className="space-y-4">
                <SkeletonSectionHeading />
                <div className="grid gap-3 sm:grid-cols-3">
                    {[0, 1, 2].map((index) => (
                        <Skeleton key={index} className="h-24 w-full" />
                    ))}
                </div>
            </div>
            <div className="space-y-4">
                <SkeletonSectionHeading />
                <SkeletonCardRow leading="none" trailing="switch" />
            </div>
        </SettingsSkeleton>
    )
}

export function PrivacySettingsSkeleton() {
    return (
        <SettingsSkeleton label="Loading privacy settings" className="space-y-4">
            <div className="space-y-4 border-border border-b pb-6">
                <SkeletonSectionHeading />
                <div className="grid max-w-3xl grid-cols-1 gap-2 sm:grid-cols-3 sm:gap-3">
                    {[0, 1, 2].map((index) => (
                        <Skeleton key={index} className="h-24 w-full" />
                    ))}
                </div>
            </div>
            <div className="flex items-center justify-between gap-4">
                <div className="flex-1 space-y-2">
                    <Skeleton className="h-5 w-36" />
                    <Skeleton className="h-4 w-80 max-w-full" />
                </div>
                <Skeleton className="h-5 w-9 shrink-0 rounded-full" />
            </div>
        </SettingsSkeleton>
    )
}

export function PersonasSettingsSkeleton() {
    return (
        <SettingsSkeleton label="Loading personas" className="space-y-8">
            <div className="space-y-4">
                <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                    <SkeletonSectionHeading description />
                    <Skeleton className="h-9 w-32" />
                </div>
                <SkeletonRows count={2}>
                    <SkeletonCardRow
                        leading="avatar"
                        trailing="actions"
                        className="rounded-[var(--radius-xl)]"
                    />
                </SkeletonRows>
            </div>
            <div className="space-y-4">
                <SkeletonSectionHeading description />
                <div className="grid gap-4 md:grid-cols-2">
                    {[0, 1, 2, 3].map((index) => (
                        <Card
                            key={index}
                            className="gap-3 rounded-[var(--radius-xl)] p-4 shadow-none"
                        >
                            <div className="flex items-center gap-3">
                                <Skeleton className="size-10 shrink-0 rounded-full" />
                                <Skeleton className="h-4 w-32" />
                            </div>
                            <Skeleton className="h-3 w-full" />
                            <Skeleton className="h-3 w-2/3" />
                            <Skeleton className="h-5 w-24" />
                        </Card>
                    ))}
                </div>
            </div>
        </SettingsSkeleton>
    )
}

export function ProviderListSkeleton() {
    return (
        <SettingsSkeleton label="Loading providers">
            <div className="space-y-1.5">
                <SkeletonSectionHeading description />
                <SkeletonCardRow />
            </div>
            <div className="space-y-1.5">
                <SkeletonSectionHeading description />
                <SkeletonRows count={4}>
                    <SkeletonCardRow trailing="switch" />
                </SkeletonRows>
            </div>
        </SettingsSkeleton>
    )
}

export function ModelListSkeleton() {
    return (
        <SettingsSkeleton label="Loading models">
            <div className="space-y-1.5">
                <SkeletonSectionHeading description />
                <SkeletonRows count={5}>
                    <SkeletonCardRow trailing="switch" />
                </SkeletonRows>
            </div>
        </SettingsSkeleton>
    )
}

export function ThemeGridSkeleton() {
    return (
        <SettingsSkeleton label="Loading themes" className="space-y-3">
            <Skeleton className="h-4 w-16" />
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                {[0, 1, 2, 3].map((index) => (
                    <Card key={index} className="gap-3 overflow-hidden p-4 pb-0 shadow-none">
                        <Skeleton className="h-4 w-28" />
                        <Skeleton className="h-3 w-48 max-w-full" />
                        <Skeleton className="-mx-4 h-3 rounded-none" />
                    </Card>
                ))}
            </div>
        </SettingsSkeleton>
    )
}

export function FilesTableSkeleton() {
    return (
        <SettingsSkeleton label="Loading files">
            <div className="overflow-hidden rounded-lg border">
                {Array.from({ length: 6 }, (_, index) => (
                    <div
                        key={index}
                        className="flex items-center gap-4 border-b p-4 last:border-b-0"
                    >
                        <Skeleton className="size-12" />
                        <div className="flex-1 space-y-2">
                            <Skeleton className="h-4 w-48 max-w-full" />
                            <Skeleton className="h-3 w-32 max-w-full" />
                        </div>
                        <Skeleton className="hidden h-4 w-24 sm:block" />
                        <Skeleton className="size-9" />
                    </div>
                ))}
            </div>
        </SettingsSkeleton>
    )
}

export function MemoryListSkeleton() {
    return (
        <SettingsSkeleton label="Loading memories" className="space-y-3">
            <Skeleton className="h-4 w-32" />
            {[0, 1, 2].map((index) => (
                <Card key={index} className="flex-row items-start gap-4 rounded-lg p-4 shadow-xs">
                    <div className="min-w-0 flex-1 space-y-2">
                        <Skeleton className="h-4 w-full" />
                        <Skeleton className="h-4 w-3/4" />
                        <Skeleton className="mt-3 h-3 w-24" />
                    </div>
                    <div className="flex shrink-0 gap-1">
                        <Skeleton className="size-9" />
                        <Skeleton className="size-9" />
                    </div>
                </Card>
            ))}
        </SettingsSkeleton>
    )
}

export function UsageDashboardSkeleton() {
    return (
        <SettingsSkeleton label="Loading usage" className="space-y-4">
            <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                {[0, 1, 2, 3].map((index) => (
                    <Card key={index} className="gap-3 p-4">
                        <Skeleton className="h-4 w-28" />
                        <Skeleton className="h-7 w-20" />
                        <Skeleton className="h-3 w-24" />
                    </Card>
                ))}
            </div>
            {[0, 1].map((index) => (
                <Card key={index} className="gap-3 p-4">
                    <div className="space-y-2 pb-3">
                        <Skeleton className="h-5 w-48" />
                        <Skeleton className="h-4 w-64 max-w-full" />
                    </div>
                    <Skeleton className="h-[250px] w-full sm:h-[300px]" />
                </Card>
            ))}
        </SettingsSkeleton>
    )
}
