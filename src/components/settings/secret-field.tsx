import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Key, RotateCcw, Trash2 } from "lucide-react"

// The saved-key row with Replace (and Remove, where a key is optional), or the key input when
// there's no key or it's being replaced.
export function SecretField({
    id,
    hasExistingKey,
    replacing,
    onReplace,
    onRemove,
    value,
    onChange,
    label = "API Key",
    placeholder,
    multiline = false
}: {
    id: string
    hasExistingKey: boolean
    replacing: boolean
    onReplace: () => void
    onRemove?: () => void
    value: string
    onChange: (value: string) => void
    label?: string
    placeholder?: string
    multiline?: boolean
}) {
    if (hasExistingKey && !replacing) {
        return (
            <div className="flex items-center justify-between gap-3 rounded-lg bg-muted/50 p-3">
                <div className="flex items-center gap-2">
                    <Key className="h-4 w-4 text-green-600" />
                    <span className="text-sm">{label} saved</span>
                </div>
                <div className="flex items-center gap-1">
                    {onRemove && (
                        <Button variant="ghost" size="sm" onClick={onRemove}>
                            <Trash2 className="h-4 w-4" />
                            Remove
                        </Button>
                    )}
                    <Button variant="ghost" size="sm" onClick={onReplace}>
                        <RotateCcw className="h-4 w-4" />
                        Replace
                    </Button>
                </div>
            </div>
        )
    }

    return (
        <div className="space-y-2">
            <Label htmlFor={id}>{replacing ? `New ${label}` : label}</Label>
            {multiline ? (
                <Textarea
                    id={id}
                    value={value}
                    onChange={(event) => onChange(event.target.value)}
                    placeholder={placeholder}
                    className="min-h-32 font-mono text-xs"
                    spellCheck={false}
                />
            ) : (
                <Input
                    id={id}
                    type="password"
                    value={value}
                    onChange={(event) => onChange(event.target.value)}
                    placeholder={placeholder}
                    className="font-mono"
                />
            )}
        </div>
    )
}
