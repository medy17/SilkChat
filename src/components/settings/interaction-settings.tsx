import { ComposerSettingSkeleton } from "@/components/settings/settings-skeletons"
import { Card } from "@/components/ui/card"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
import { api } from "@/convex/_generated/api"
import { useSession } from "@/hooks/auth-hooks"
import { useIsTouchDevice } from "@/hooks/use-touch-device"
import { stopHaptics } from "@/lib/haptics"
import { useHapticsSettingsStore } from "@/lib/haptics-settings-store"
import { useConvexMutation, useConvexQuery } from "@convex-dev/react-query"
import { useState } from "react"
import { toast } from "sonner"

// Look & Feel's Interaction section: the composer's Enter behavior on desktop,
// haptics on touch devices.
export function InteractionSettings() {
    const isTouchDevice = useIsTouchDevice()

    return (
        <div className="space-y-4">
            <div>
                <h3 className="font-semibold text-foreground">Interaction</h3>
                <p className="mt-1 text-muted-foreground text-sm">
                    {isTouchDevice
                        ? "Choose how SilkChat responds to touch"
                        : "Choose how the composer handles Enter"}
                </p>
            </div>

            {isTouchDevice ? <HapticsSetting /> : <ComposerSetting />}
        </div>
    )
}

function HapticsSetting() {
    const hapticsEnabled = useHapticsSettingsStore((state) => state.enabled)
    const setHapticsEnabled = useHapticsSettingsStore((state) => state.setEnabled)

    const handleHapticsToggle = (checked: boolean) => {
        setHapticsEnabled(checked)
        if (!checked) stopHaptics()
    }

    return (
        <Card className="p-4">
            <div className="flex items-start justify-between gap-4">
                <div className="space-y-1.5">
                    <Label htmlFor="haptics" className="text-base">
                        Haptics
                    </Label>
                    <p id="haptics-description" className="text-muted-foreground text-sm">
                        Feel response and gesture feedback on supported devices.
                    </p>
                </div>
                <Switch
                    id="haptics"
                    checked={hapticsEnabled}
                    onCheckedChange={handleHapticsToggle}
                    aria-label="Enable haptics"
                    aria-describedby="haptics-description"
                />
            </div>
        </Card>
    )
}

function ComposerSetting() {
    const session = useSession()
    const userSettings = useConvexQuery(
        api.settings.getUserSettings,
        session.user?.id ? {} : "skip"
    )
    const updateSettings = useConvexMutation(api.settings.updateUserSettingsPartial)
    const [isUpdating, setIsUpdating] = useState(false)

    const handleToggle = async (checked: boolean) => {
        setIsUpdating(true)
        try {
            await updateSettings({ invertSendNewlineBehavior: checked })
            toast.success(
                checked
                    ? "Enter now inserts new lines by default"
                    : "Enter now sends messages by default"
            )
        } catch (error) {
            console.error("Failed to update composer behavior:", error)
            toast.error("Failed to update composer behavior")
        } finally {
            setIsUpdating(false)
        }
    }

    if (!userSettings) {
        return <ComposerSettingSkeleton />
    }

    return (
        <Card className="p-4">
            <div className="flex items-start justify-between gap-4">
                <div className="space-y-1.5">
                    <Label htmlFor="invert-send-newline" className="text-base">
                        Invert send and new line
                    </Label>
                    <p
                        id="invert-send-newline-description"
                        className="text-muted-foreground text-sm"
                    >
                        Enter adds a new line and Cmd/Ctrl + Enter sends. When off, Enter sends and
                        Shift + Enter adds a new line.
                    </p>
                </div>
                <Switch
                    id="invert-send-newline"
                    checked={userSettings.invertSendNewlineBehavior === true}
                    onCheckedChange={handleToggle}
                    disabled={isUpdating}
                    aria-describedby="invert-send-newline-description"
                />
            </div>
        </Card>
    )
}
