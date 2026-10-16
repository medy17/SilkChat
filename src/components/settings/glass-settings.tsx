import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
import {
    GLASS_INTENSITY_STEPS,
    getGlassTransparencyLabel,
    useGlassSettingsStore
} from "@/lib/glass-settings-store"
import { cn } from "@/lib/utils"
import { Minus, Plus } from "lucide-react"

// Look & Feel's Glass section. Stored per device: see glass-settings-store.ts.
export function GlassSettings() {
    const enabled = useGlassSettingsStore((state) => state.enabled)
    const intensity = useGlassSettingsStore((state) => state.intensity)
    const setEnabled = useGlassSettingsStore((state) => state.setEnabled)
    const setIntensity = useGlassSettingsStore((state) => state.setIntensity)

    const stepIndex = GLASS_INTENSITY_STEPS.indexOf(intensity)
    const lowerStep = GLASS_INTENSITY_STEPS[stepIndex - 1]
    const higherStep = GLASS_INTENSITY_STEPS[stepIndex + 1]

    return (
        <div className="space-y-4">
            <div>
                <h3 className="font-semibold text-foreground">Glass</h3>
                <p className="mt-1 text-muted-foreground text-sm">
                    Translucent menus and floating controls
                </p>
            </div>

            <Card className="max-w-xl gap-0 divide-y p-0">
                <div className="flex items-center justify-between gap-4 p-4">
                    <Label htmlFor="glass-enabled" className="text-base">
                        Glass
                    </Label>
                    <Switch id="glass-enabled" checked={enabled} onCheckedChange={setEnabled} />
                </div>
                <div className="flex items-center justify-between gap-4 p-4">
                    <Label
                        id="glass-transparency-label"
                        className={cn("text-base", !enabled && "text-muted-foreground")}
                    >
                        Transparency
                    </Label>
                    <fieldset
                        aria-labelledby="glass-transparency-label"
                        disabled={!enabled}
                        className="flex items-center gap-1"
                    >
                        <Button
                            type="button"
                            variant="outline"
                            size="icon"
                            className="size-8"
                            aria-label="Less transparent"
                            disabled={lowerStep === undefined}
                            onClick={() => lowerStep !== undefined && setIntensity(lowerStep)}
                        >
                            <Minus className="size-4" />
                        </Button>
                        <output
                            aria-live="polite"
                            className={cn(
                                "w-12 text-center font-medium text-sm tabular-nums",
                                !enabled && "text-muted-foreground"
                            )}
                        >
                            {getGlassTransparencyLabel(intensity)}
                        </output>
                        <Button
                            type="button"
                            variant="outline"
                            size="icon"
                            className="size-8"
                            aria-label="More transparent"
                            disabled={higherStep === undefined}
                            onClick={() => higherStep !== undefined && setIntensity(higherStep)}
                        >
                            <Plus className="size-4" />
                        </Button>
                    </fieldset>
                </div>
            </Card>
        </div>
    )
}
