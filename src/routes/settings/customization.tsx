import { SettingsLayout } from "@/components/settings/settings-layout"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
import { Textarea } from "@/components/ui/textarea"
import { api } from "@/convex/_generated/api"
import { useSession } from "@/hooks/auth-hooks"
import { useIsMobile } from "@/hooks/use-mobile"
import { useConvexMutation, useConvexQuery } from "@convex-dev/react-query"
import { createFileRoute, useNavigate } from "@tanstack/react-router"
import { Loader2, Save } from "lucide-react"
import { useEffect, useRef, useState } from "react"
import { toast } from "sonner"

export const Route = createFileRoute("/settings/customization")({
    component: LegacyCustomizationRedirect
})

function LegacyCustomizationRedirect() {
    const navigate = useNavigate()

    useEffect(() => {
        navigate({
            to: "/settings/behavior",
            replace: true
        })
    }, [navigate])

    return null
}

export function BehaviorSettingsContent() {
    const session = useSession()
    const isMobile = useIsMobile()
    const userSettings = useConvexQuery(
        api.settings.getUserSettings,
        session.user?.id ? {} : "skip"
    )
    const updateSettings = useConvexMutation(api.settings.updateUserSettingsPartial)

    const [isSaving, setIsSaving] = useState(false)
    const [isUpdatingComposerBehavior, setIsUpdatingComposerBehavior] = useState(false)

    const nameRef = useRef<HTMLInputElement>(null)
    const personalityRef = useRef<HTMLTextAreaElement>(null)
    const contextRef = useRef<HTMLTextAreaElement>(null)

    const handleSave = async () => {
        if (!session.user?.id) return

        setIsSaving(true)
        try {
            await updateSettings({
                customization: {
                    name: nameRef.current?.value.trim() || null,
                    aiPersonality: personalityRef.current?.value.trim() || null,
                    additionalContext: contextRef.current?.value.trim() || null
                }
            })
            toast.success("Customization settings saved")
        } catch (error) {
            console.error("Failed to save customization:", error)
            toast.error("Failed to save customization settings")
        } finally {
            setIsSaving(false)
        }
    }

    const handleComposerBehaviorToggle = async (checked: boolean) => {
        if (!session.user?.id) return

        setIsUpdatingComposerBehavior(true)
        try {
            await updateSettings({
                invertSendNewlineBehavior: checked
            })
            toast.success(
                checked
                    ? "Enter now inserts new lines by default"
                    : "Enter now sends messages by default"
            )
        } catch (error) {
            console.error("Failed to update composer behavior:", error)
            toast.error("Failed to update composer behavior")
        } finally {
            setIsUpdatingComposerBehavior(false)
        }
    }

    if (!session.user?.id) {
        return (
            <p className="text-muted-foreground text-sm">
                Sign in to customize your AI experience.
            </p>
        )
    }

    if (!userSettings) {
        return (
            <div className="flex items-center justify-center p-8">
                <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
        )
    }

    return (
        <div className="space-y-8">
            <div className="space-y-4">
                <div>
                    <h3 className="font-semibold text-foreground">Personalization</h3>
                    {/* <p className="mt-1 text-muted-foreground text-sm">
                        Set the baseline context and communication style for the assistant.
                    </p> */}
                </div>

                <div className="space-y-6">
                    <div className="space-y-2">
                        <Label htmlFor="name">Your Name</Label>
                        <Input
                            id="name"
                            ref={nameRef}
                            defaultValue={userSettings?.customization?.name || ""}
                            placeholder="How should the AI address you?"
                            maxLength={100}
                        />
                        {/* <p className="text-muted-foreground text-xs">
                            This helps the AI address you personally in conversations.
                        </p> */}
                    </div>

                    <div className="space-y-2">
                        <Label htmlFor="personality">AI Personality</Label>
                        <Textarea
                            id="personality"
                            ref={personalityRef}
                            defaultValue={userSettings?.customization?.aiPersonality || ""}
                            placeholder="Describe how you want the AI to behave and communicate..."
                            rows={4}
                            maxLength={2000}
                        />
                        {/* <p className="text-muted-foreground text-xs">
                            Shape the AI's communication style and personality.
                        </p> */}
                    </div>

                    <div className="space-y-2">
                        <Label htmlFor="context">Additional Context</Label>
                        <Textarea
                            id="context"
                            ref={contextRef}
                            defaultValue={userSettings?.customization?.additionalContext || ""}
                            placeholder="Share relevant information about yourself, your work, or preferences..."
                            rows={4}
                            maxLength={2000}
                        />
                        {/* <p className="text-muted-foreground text-xs">
                            Provide context that helps the AI give you more relevant responses.
                        </p> */}
                    </div>

                    {!isMobile ? (
                        <div className="space-y-4">
                            <div>
                                <h3 className="font-semibold text-foreground">Composer</h3>
                                {/* <p className="mt-1 text-muted-foreground text-sm">
                                    Control how the main chat composer handles sending and line
                                    breaks.
                                </p> */}
                            </div>

                            <Card className="p-4">
                                <div className="flex items-start justify-between gap-4">
                                    <div className="space-y-1.5">
                                        <Label className="text-base">
                                            Invert Send/New Line Behavior
                                        </Label>
                                        <div className="space-y-1 text-muted-foreground text-sm">
                                            <p>
                                                When enabled, use Enter for new lines and Cmd/Ctrl +
                                                Enter to send messages.
                                            </p>
                                            <p>
                                                When disabled, use Enter to send and Shift + Enter
                                                for new lines.
                                            </p>
                                        </div>
                                    </div>
                                    <Switch
                                        checked={userSettings.invertSendNewlineBehavior === true}
                                        onCheckedChange={handleComposerBehaviorToggle}
                                        disabled={isUpdatingComposerBehavior}
                                        aria-label="Invert send and new line behavior"
                                    />
                                </div>
                            </Card>
                        </div>
                    ) : null}

                    <div className="flex justify-end pt-4">
                        <Button
                            onClick={handleSave}
                            disabled={isSaving}
                            className="min-w-[6.25rem]"
                        >
                            {isSaving ? (
                                <>
                                    <Loader2 className="h-4 w-4 animate-spin" />
                                    Saving...
                                </>
                            ) : (
                                <>
                                    <Save className="h-4 w-4" />
                                    Save Changes
                                </>
                            )}
                        </Button>
                    </div>
                </div>
            </div>
        </div>
    )
}

function BehaviorSettingsPage() {
    return (
        <SettingsLayout
            title="Behavior"
            description="Control composer behavior, assistant defaults, and saved context."
        >
            <BehaviorSettingsContent />
        </SettingsLayout>
    )
}
