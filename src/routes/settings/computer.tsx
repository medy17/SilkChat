import {
    COMPUTER_STATE_LABELS,
    COMPUTER_STATE_TONES,
    ComputerCover,
    ComputerDetailItem,
    ComputerDisclosure
} from "@/components/computer-ui"
import { ComputerKeysSection } from "@/components/computer-keys"
import { SettingsLayout } from "@/components/settings/settings-layout"
import { SettingsFormActions } from "@/components/settings/settings-section"
import { ComputerSettingsSkeleton } from "@/components/settings/settings-skeletons"
import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle
} from "@/components/ui/alert-dialog"
import { Button, buttonVariants } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { api } from "@/convex/_generated/api"
import { COMPUTER_MAX_NAME_LENGTH } from "@/convex/lib/computer_policy"
import { cn } from "@/lib/utils"
import { createFileRoute } from "@tanstack/react-router"
import { useAction, useMutation, useQuery } from "convex/react"
import { Pencil, Trash2 } from "lucide-react"
import { type ReactNode, useState } from "react"
import { toast } from "sonner"

export const Route = createFileRoute("/settings/computer")({
    component: ComputerSettingsPage
})

const DAY_MS = 24 * 60 * 60_000
const DELETION_NOTICE_DAYS = 7

const formatLastUsed = (timestamp: number) =>
    new Date(timestamp).toLocaleDateString(undefined, {
        day: "numeric",
        month: "short",
        year: "numeric"
    })

const BYTES_PER_GB = 1_000_000_000

const formatGb = (bytes: number) => {
    const gb = bytes / BYTES_PER_GB
    return `${gb < 10 ? gb.toFixed(1) : Math.round(gb)} GB`
}

const formatMonthlyCost = (monthlyMicrousd: number, allowanceMicrousd: number) => {
    if (allowanceMicrousd <= 0) return null
    const percent = (monthlyMicrousd / allowanceMicrousd) * 100
    return percent > 0 && percent < 1 ? "Under 1%" : `${Math.round(percent)}%`
}

const showError = (error: unknown, fallback: string) =>
    toast.error(error instanceof Error ? error.message : fallback)

function ManageRow({
    title,
    description,
    children
}: {
    title: string
    description: string
    children: ReactNode
}) {
    return (
        <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="min-w-0 flex-1 basis-56">
                <p className="font-medium text-sm">{title}</p>
                <p className="text-muted-foreground text-xs">{description}</p>
            </div>
            {children}
        </div>
    )
}

function NameEditor({ name }: { name: string }) {
    const rename = useMutation(api.computers.renameMyComputer)
    const [draft, setDraft] = useState<string | null>(null)
    const [saving, setSaving] = useState(false)

    if (draft === null) {
        return (
            <div className="flex min-w-0 items-center gap-1">
                <span className="min-w-0 truncate font-semibold text-3xl tracking-tight">
                    {name}
                </span>
                <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="size-7 shrink-0 rounded-[var(--radius-md)]"
                    aria-label="Rename computer"
                    onClick={() => setDraft(name)}
                >
                    <Pencil className="size-3.5" aria-hidden="true" />
                </Button>
            </div>
        )
    }

    const canSave = draft.trim().length > 0
    const save = async () => {
        if (!canSave) return
        setSaving(true)
        try {
            await rename({ name: draft })
            setDraft(null)
        } catch (error) {
            showError(error, "Couldn't rename it")
        } finally {
            setSaving(false)
        }
    }

    return (
        <div className="flex flex-wrap items-center gap-2">
            <Input
                autoFocus
                aria-label="Computer name"
                className="h-8 w-56 max-w-full rounded-[var(--radius-md)]"
                maxLength={COMPUTER_MAX_NAME_LENGTH}
                value={draft}
                onChange={(event) => setDraft(event.target.value)}
                onKeyDown={(event) => {
                    if (event.key === "Enter") void save()
                    if (event.key === "Escape") setDraft(null)
                }}
            />
            <SettingsFormActions
                isSaving={saving}
                canSave={canSave}
                onSave={() => void save()}
                onCancel={() => setDraft(null)}
            />
        </div>
    )
}

function ComputerSettingsPage() {
    const computer = useQuery(api.computers.getMyComputer)
    const sleep = useAction(api.computers_node.sleepMyComputer)
    const restart = useAction(api.computers_node.restartMyComputer)
    const reset = useAction(api.computers_node.resetMyComputer)
    const remove = useAction(api.computers_node.deleteMyComputer)
    const [confirming, setConfirming] = useState<"reset" | "delete">("reset")
    const [confirmOpen, setConfirmOpen] = useState(false)
    const [acting, setActing] = useState(false)

    const act = async (run: () => Promise<unknown>) => {
        setActing(true)
        try {
            await run()
        } catch (error) {
            showError(error, "Something went wrong")
        } finally {
            setActing(false)
        }
    }

    const ask = (kind: "reset" | "delete") => {
        setConfirming(kind)
        setConfirmOpen(true)
    }

    const deleting = confirming === "delete"
    const now = Date.now()
    const daysUntilDeletion = computer
        ? Math.max(1, Math.ceil((computer.deletesAt - now) / DAY_MS))
        : 0
    const daysUntilPurge = computer?.overLimitDeletesAt
        ? Math.max(1, Math.ceil((computer.overLimitDeletesAt - now) / DAY_MS))
        : 0
    const storageShare = computer?.storage
        ? formatMonthlyCost(computer.storage.monthlyMicrousd, computer.storage.allowanceMicrousd)
        : null
    const busy = acting || computer?.state === "busy" || computer?.state === "setting_up"
    const awake = computer?.state === "awake" || computer?.state === "working"

    return (
        <SettingsLayout title="Computer" description="Where Silky works on longer jobs.">
            {computer === undefined ? (
                <ComputerSettingsSkeleton />
            ) : computer === null ? (
                <p className="text-muted-foreground text-sm">
                    Silky sets this up the first time it needs one. Ask it to work on a project and
                    it'll ask you to allow it.
                </p>
            ) : (
                <section className="overflow-hidden rounded-[var(--radius-lg)] border bg-card">
                    <ComputerCover
                        className="h-40"
                        title={<NameEditor name={computer.name} />}
                        status={COMPUTER_STATE_LABELS[computer.state]}
                        tone={COMPUTER_STATE_TONES[computer.state]}
                    />
                    <div className="space-y-3 p-5">
                        {computer.state === "archived" &&
                            daysUntilDeletion <= DELETION_NOTICE_DAYS && (
                                <p className="text-destructive text-sm">
                                    Files deleted in {daysUntilDeletion}{" "}
                                    {daysUntilDeletion === 1 ? "day" : "days"}
                                </p>
                            )}
                        {daysUntilPurge > 0 && (
                            <p className="text-destructive text-sm">
                                Over your storage limit. Files deleted in {daysUntilPurge}{" "}
                                {daysUntilPurge === 1 ? "day" : "days"}
                            </p>
                        )}
                        {computer.state === "stuck" && (
                            <Button
                                type="button"
                                size="sm"
                                variant="outline"
                                className="rounded-[var(--radius-md)]"
                                disabled={busy}
                                onClick={() => void act(() => restart({}))}
                            >
                                Restart
                            </Button>
                        )}
                        <ComputerDisclosure label="Details">
                            <dl className="text-xs">
                                <ComputerDetailItem
                                    label="Last used"
                                    value={formatLastUsed(computer.lastUsedAt)}
                                />
                                <ComputerDetailItem
                                    label="Storage"
                                    value={
                                        computer.storage
                                            ? `${formatGb(computer.storage.usedBytes)} of ${formatGb(computer.driveLimitBytes)}`
                                            : `Up to ${formatGb(computer.driveLimitBytes)}`
                                    }
                                />
                                {storageShare && (
                                    <ComputerDetailItem
                                        label="Storage cost"
                                        value={`${storageShare} of your monthly usage`}
                                    />
                                )}
                                <ComputerDetailItem
                                    label="Includes"
                                    value="Ubuntu, Node 24, Python 3.14"
                                />
                            </dl>
                        </ComputerDisclosure>
                        <ComputerDisclosure label="Manage">
                            <div className="space-y-4 pt-1">
                                {awake && (
                                    <ManageRow
                                        title="Put to sleep"
                                        description="Stops the current work. Nothing is lost."
                                    >
                                        <Button
                                            type="button"
                                            size="sm"
                                            variant="outline"
                                            className="rounded-[var(--radius-md)]"
                                            disabled={busy}
                                            onClick={() => void act(() => sleep({}))}
                                        >
                                            Put to sleep
                                        </Button>
                                    </ManageRow>
                                )}
                                {computer.state !== "archived" && (
                                    <ManageRow
                                        title="Reset"
                                        description="Fresh computer on the latest version. Project files stay."
                                    >
                                        <Button
                                            type="button"
                                            size="sm"
                                            variant="outline"
                                            className="rounded-[var(--radius-md)]"
                                            disabled={busy}
                                            onClick={() => ask("reset")}
                                        >
                                            Reset
                                        </Button>
                                    </ManageRow>
                                )}
                                <div className="flex flex-col gap-4 rounded-[var(--radius-lg)] border border-destructive/30 bg-destructive/5 p-4 sm:flex-row sm:items-center sm:justify-between">
                                    <div className="space-y-1">
                                        <div className="font-medium text-sm">Delete computer</div>
                                        <div className="max-w-2xl text-muted-foreground text-sm">
                                            Permanently delete the computer and every file on it.
                                            This action cannot be undone.
                                        </div>
                                    </div>
                                    <Button
                                        type="button"
                                        variant="destructive"
                                        className="w-full shrink-0 rounded-[var(--radius-md)] sm:w-auto"
                                        disabled={busy}
                                        onClick={() => ask("delete")}
                                    >
                                        <Trash2 className="h-4 w-4" />
                                        Delete Computer
                                    </Button>
                                </div>
                            </div>
                        </ComputerDisclosure>
                    </div>
                </section>
            )}
            {computer !== undefined && <ComputerKeysSection />}
            <AlertDialog open={confirmOpen} onOpenChange={setConfirmOpen}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>
                            {deleting ? `Delete ${computer?.name}?` : `Reset ${computer?.name}?`}
                        </AlertDialogTitle>
                        <AlertDialogDescription>
                            {deleting
                                ? "This permanently deletes the computer and every file on it. You can't undo this."
                                : "Silky gets a fresh computer on the latest version. Project files stay. Anything installed will need reinstalling."}
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                        <AlertDialogAction
                            className={cn(deleting && buttonVariants({ variant: "destructive" }))}
                            onClick={() => void act(() => (deleting ? remove({}) : reset({})))}
                        >
                            {deleting ? "Delete computer" : "Reset computer"}
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </SettingsLayout>
    )
}
