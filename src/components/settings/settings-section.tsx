import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import { Save, X } from "lucide-react"
import type { ReactNode } from "react"

export function SettingsSectionHeader({
    title,
    description,
    action
}: {
    title: string
    description?: ReactNode
    action?: ReactNode
}) {
    return (
        <div className="flex items-center justify-between gap-3">
            <div>
                <h3 className="font-semibold text-foreground">{title}</h3>
                {description ? (
                    <p className="mt-1 text-muted-foreground text-sm">{description}</p>
                ) : null}
            </div>
            {action ? <div className="shrink-0">{action}</div> : null}
        </div>
    )
}

// Save and Cancel for inline edits, matching Account's name editing.
export function SettingsFormActions({
    isSaving,
    canSave = true,
    saveLabel = "Save",
    savingLabel = "Saving...",
    onSave,
    onCancel,
    className
}: {
    isSaving: boolean
    canSave?: boolean
    saveLabel?: string
    savingLabel?: string
    onSave: () => void
    onCancel: () => void
    className?: string
}) {
    return (
        <div className={cn("flex gap-2", className)}>
            <Button onClick={onSave} disabled={isSaving || !canSave} size="sm">
                <Save className="h-4 w-4" />
                {isSaving ? savingLabel : saveLabel}
            </Button>
            <Button onClick={onCancel} disabled={isSaving} variant="outline" size="sm">
                <X className="h-4 w-4" />
                Cancel
            </Button>
        </div>
    )
}

export function StatusDot({ active, label }: { active: boolean; label: string }) {
    return (
        <span className="flex items-center gap-2 text-muted-foreground text-xs">
            <span
                className={cn(
                    "size-2 rounded-full",
                    active ? "bg-green-500" : "bg-muted-foreground/40"
                )}
            />
            {label}
        </span>
    )
}
