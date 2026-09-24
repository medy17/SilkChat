import {
    type PersonaAvatarCropState,
    PersonaAvatarCropper,
    compressPersonaAvatar,
    cropPersonaAvatarToSquare,
    readPersonaAvatarAsDataUrl
} from "@/components/persona-avatar-cropper"
import { RoleplayPortraitsContext } from "@/components/roleplay-persona-context"
import { Button } from "@/components/ui/button"
import { api } from "@/convex/_generated/api"
import type { Id } from "@/convex/_generated/dataModel"
import { useToken } from "@/hooks/auth-hooks"
import { resolveJwtToken } from "@/lib/auth-token"
import { browserEnv } from "@/lib/browser-env"
import { uploadFileDirect } from "@/lib/direct-upload"
import { getGeneratedImageDirectUrl } from "@/lib/generated-image-urls"
import { getRoleplayPortraitIdError } from "@/lib/roleplay-portraits"
import { useMutation } from "convex/react"
import { Check, Crop, Loader2, UserRound } from "lucide-react"
import { useContext, useState } from "react"
import { toast } from "sonner"

const errorMessage = (error: unknown, fallback: string) =>
    error instanceof Error && error.message ? error.message : fallback

// Footer actions for a SilkScreen card prepared as a roleplay portrait. Setting a
// variant is one click; cropping uploads a square copy first. Only the owner's chat
// supplies an editable thread ID, so shared views never see these.
export function RoleplayPortraitActions({
    messageId,
    toolCallId,
    cardId,
    portrait,
    asset
}: {
    messageId: string
    toolCallId: string
    cardId: string
    portrait: { characterId: string; name: string }
    asset: { generatedImageId: string; storageKey: string }
}) {
    const context = useContext(RoleplayPortraitsContext)
    const setRoleplayPortrait = useMutation(api.roleplay_portraits.setRoleplayPortrait)
    const { token } = useToken()
    const [pending, setPending] = useState<"set" | "crop" | null>(null)
    const [cropState, setCropState] = useState<PersonaAvatarCropState | null>(null)
    const [isSavingCrop, setIsSavingCrop] = useState(false)
    if (!context?.threadId || getRoleplayPortraitIdError(portrait.characterId)) return null

    const threadId = context.threadId as Id<"threads">
    const { characterId, name } = portrait
    const isCurrent = context.portraits.some(
        (entry) =>
            entry.characterId === characterId && entry.generatedImageId === asset.generatedImageId
    )

    const handleSet = async () => {
        setPending("set")
        try {
            await setRoleplayPortrait({
                threadId,
                characterId,
                source: {
                    kind: "card",
                    messageId,
                    toolCallId,
                    cardId,
                    generatedImageId: asset.generatedImageId
                }
            })
        } catch (error) {
            toast.error(errorMessage(error, "Couldn't set the portrait"))
        } finally {
            setPending(null)
        }
    }

    const handleCropOpen = async () => {
        setPending("crop")
        try {
            const response = await fetch(getGeneratedImageDirectUrl(asset.storageKey))
            if (!response.ok) throw new Error("Couldn't load that image")
            const blob = await response.blob()
            const fileName = `${characterId}-portrait.webp`
            const src = await readPersonaAvatarAsDataUrl(
                new File([blob], fileName, { type: blob.type || "image/png" })
            )
            setCropState({ src, fileName })
        } catch (error) {
            toast.error(errorMessage(error, "Couldn't load that image"))
        } finally {
            setPending(null)
        }
    }

    const handleCropConfirm: Parameters<typeof PersonaAvatarCropper>[0]["onConfirm"] = async (
        croppedAreaPixels
    ) => {
        if (!cropState) return
        setIsSavingCrop(true)
        try {
            const cropped = await compressPersonaAvatar(
                await cropPersonaAvatarToSquare({ ...cropState, croppedAreaPixels })
            )
            const jwt = await resolveJwtToken(token)
            if (!jwt) throw new Error("Authentication token unavailable")
            const uploaded = await uploadFileDirect({
                file: cropped,
                jwt,
                uploadBaseUrl: `${browserEnv("VITE_CONVEX_API_URL")}/upload`,
                purpose: "roleplay-portrait"
            })
            await setRoleplayPortrait({
                threadId,
                characterId,
                source: {
                    kind: "crop",
                    messageId,
                    toolCallId,
                    cardId,
                    storageKey: uploaded.key,
                    generatedImageId: asset.generatedImageId
                }
            })
            setCropState(null)
        } catch (error) {
            toast.error(errorMessage(error, "Couldn't set the portrait"))
        } finally {
            setIsSavingCrop(false)
        }
    }

    return (
        <>
            <div className="flex gap-2">
                {isCurrent ? (
                    <output className="flex h-10 min-w-0 flex-1 items-center gap-2 rounded-[var(--radius-md)] bg-background/60 px-3 text-muted-foreground text-sm">
                        <Check className="size-4 shrink-0 text-primary" aria-hidden="true" />
                        <span className="truncate">{name}&apos;s portrait</span>
                    </output>
                ) : (
                    <Button
                        type="button"
                        className="h-10 min-w-0 flex-1 gap-2"
                        disabled={pending !== null}
                        onClick={() => void handleSet()}
                    >
                        {pending === "set" ? (
                            <Loader2 className="size-4 animate-spin" aria-hidden="true" />
                        ) : (
                            <UserRound className="size-4" aria-hidden="true" />
                        )}
                        <span className="truncate">Set as {name}&apos;s portrait</span>
                    </Button>
                )}
                <Button
                    type="button"
                    variant="secondary"
                    className="h-10 gap-2"
                    disabled={pending !== null}
                    onClick={() => void handleCropOpen()}
                >
                    {pending === "crop" ? (
                        <Loader2 className="size-4 animate-spin" aria-hidden="true" />
                    ) : (
                        <Crop className="size-4" aria-hidden="true" />
                    )}
                    {isCurrent ? "Recrop" : "Crop & set"}
                </Button>
            </div>
            <PersonaAvatarCropper
                title={`Crop ${name}'s portrait`}
                cropState={cropState}
                open={Boolean(cropState)}
                onOpenChange={(open) => {
                    if (!open && !isSavingCrop) setCropState(null)
                }}
                onConfirm={handleCropConfirm}
                isSaving={isSavingCrop}
            />
        </>
    )
}
