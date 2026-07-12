"use client"

import { Button } from "@/components/ui/button"
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle
} from "@/components/ui/dialog"
import {
    Drawer,
    DrawerClose,
    DrawerContent,
    DrawerDescription,
    DrawerFooter,
    DrawerHeader,
    DrawerTitle
} from "@/components/ui/drawer"
import { Label } from "@/components/ui/label"
import { Slider } from "@/components/ui/slider"
import { useIsMobile } from "@/hooks/use-mobile"
import { Loader2 } from "lucide-react"
import { useEffect, useState } from "react"
import Cropper, { type Area } from "react-easy-crop"
import "react-easy-crop/react-easy-crop.css"
import "@/routes/settings/personas-cropper.css"

export type PersonaAvatarCropState = {
    src: string
    fileName: string
}

export const readPersonaAvatarAsDataUrl = async (file: File) =>
    await new Promise<string>((resolve, reject) => {
        const reader = new FileReader()
        reader.onload = () =>
            typeof reader.result === "string"
                ? resolve(reader.result)
                : reject(new Error("Failed to read avatar image"))
        reader.onerror = () => reject(new Error("Failed to read avatar image"))
        reader.readAsDataURL(file)
    })

export const cropPersonaAvatarToSquare = async ({
    src,
    croppedAreaPixels,
    fileName
}: PersonaAvatarCropState & { croppedAreaPixels: Area }) => {
    const image = await new Promise<HTMLImageElement>((resolve, reject) => {
        const element = new Image()
        element.onload = () => resolve(element)
        element.onerror = () => reject(new Error("Failed to decode avatar image"))
        element.src = src
    })
    const canvas = document.createElement("canvas")
    const cropWidth = Math.max(1, Math.round(croppedAreaPixels.width))
    const cropHeight = Math.max(1, Math.round(croppedAreaPixels.height))
    const scale = Math.min(1, 512 / Math.max(cropWidth, cropHeight))
    canvas.width = Math.max(1, Math.round(cropWidth * scale))
    canvas.height = Math.max(1, Math.round(cropHeight * scale))

    const context = canvas.getContext("2d")
    if (!context) throw new Error("Avatar cropping is not available in this browser")
    context.drawImage(
        image,
        croppedAreaPixels.x,
        croppedAreaPixels.y,
        croppedAreaPixels.width,
        croppedAreaPixels.height,
        0,
        0,
        canvas.width,
        canvas.height
    )

    const blob = await new Promise<Blob | null>((resolve) =>
        canvas.toBlob(resolve, "image/webp", 0.92)
    )
    if (!blob) throw new Error("Failed to create cropped avatar")
    return new File([blob], `${fileName.replace(/\.[^.]+$/, "") || "persona-avatar"}.webp`, {
        type: "image/webp",
        lastModified: Date.now()
    })
}

const MAX_PERSONA_AVATAR_UPLOAD_BYTES = 100 * 1024

export const compressPersonaAvatar = async (file: File) => {
    if (file.size <= MAX_PERSONA_AVATAR_UPLOAD_BYTES) {
        return file
    }

    const objectUrl = URL.createObjectURL(file)

    try {
        const image = await new Promise<HTMLImageElement>((resolve, reject) => {
            const element = new Image()
            element.onload = () => resolve(element)
            element.onerror = () => reject(new Error("Failed to decode avatar image"))
            element.src = objectUrl
        })

        const canvas = document.createElement("canvas")
        const largestSide = Math.max(image.width, image.height)
        const scale = Math.min(1, 512 / largestSide)
        canvas.width = Math.max(1, Math.floor(image.width * scale))
        canvas.height = Math.max(1, Math.floor(image.height * scale))

        const context = canvas.getContext("2d")
        if (!context) {
            throw new Error("Avatar compression is not available in this browser")
        }

        context.drawImage(image, 0, 0, canvas.width, canvas.height)

        for (const quality of [0.9, 0.82, 0.74, 0.66, 0.58]) {
            const blob = await new Promise<Blob | null>((resolve) => {
                canvas.toBlob((value) => resolve(value), "image/webp", quality)
            })

            if (!blob) continue

            const compressedFile = new File(
                [blob],
                `${file.name.replace(/\.[^.]+$/, "") || "persona-avatar"}.webp`,
                {
                    type: "image/webp",
                    lastModified: file.lastModified
                }
            )

            if (compressedFile.size <= MAX_PERSONA_AVATAR_UPLOAD_BYTES) {
                return compressedFile
            }
        }

        throw new Error("Could not compress avatar below 100KB")
    } finally {
        URL.revokeObjectURL(objectUrl)
    }
}

export function PersonaAvatarCropper({
    cropState,
    open,
    onOpenChange,
    onConfirm,
    isSaving
}: {
    cropState: PersonaAvatarCropState | null
    open: boolean
    onOpenChange: (open: boolean) => void
    onConfirm: (croppedAreaPixels: Area) => Promise<void>
    isSaving: boolean
}) {
    const isMobile = useIsMobile()
    const [crop, setCrop] = useState({ x: 0, y: 0 })
    const [zoom, setZoom] = useState(1)
    const [croppedAreaPixels, setCroppedAreaPixels] = useState<Area | null>(null)

    useEffect(() => {
        if (!open || !cropState) return
        setCrop({ x: 0, y: 0 })
        setZoom(1)
        setCroppedAreaPixels(null)
    }, [cropState, open])

    const content = (
        <>
            <div className="space-y-5 px-4 pb-4 md:px-6 md:pb-0">
                <div className="persona-avatar-cropper relative h-72 overflow-hidden rounded-[var(--radius-xl)] border border-border bg-muted/60 md:h-96">
                    {cropState ? (
                        <Cropper
                            image={cropState.src}
                            crop={crop}
                            zoom={zoom}
                            aspect={1}
                            cropShape="rect"
                            showGrid
                            objectFit="contain"
                            classes={{
                                containerClassName: "persona-avatar-cropper__container",
                                mediaClassName: "persona-avatar-cropper__media",
                                cropAreaClassName: "persona-avatar-cropper__area"
                            }}
                            onCropChange={setCrop}
                            onZoomChange={setZoom}
                            onCropComplete={(_, pixels) => setCroppedAreaPixels(pixels)}
                        />
                    ) : null}
                </div>
                <div className="space-y-3 rounded-[var(--radius-lg)] border border-border/70 bg-muted/30 px-4 py-3">
                    <div className="flex items-center justify-between text-sm">
                        <Label htmlFor="persona-onboarding-avatar-zoom">Zoom</Label>
                        <span className="text-muted-foreground">{Math.round(zoom * 100)}%</span>
                    </div>
                    <div className="flex items-center gap-3">
                        <span className="text-muted-foreground text-xs">1x</span>
                        <Slider
                            id="persona-onboarding-avatar-zoom"
                            min={1}
                            max={3}
                            step={0.01}
                            value={[zoom]}
                            onValueChange={([value]) => setZoom(value ?? 1)}
                            className="flex-1"
                        />
                        <span className="text-muted-foreground text-xs">3x</span>
                    </div>
                </div>
            </div>
            {isMobile ? (
                <DrawerFooter className="shrink-0 border-t px-4 pb-[calc(env(safe-area-inset-bottom)+1rem)]">
                    <Button
                        onClick={() => croppedAreaPixels && void onConfirm(croppedAreaPixels)}
                        disabled={!croppedAreaPixels || isSaving}
                    >
                        {isSaving ? <Loader2 className="size-4 animate-spin" /> : null}
                        Apply Crop
                    </Button>
                    <DrawerClose asChild>
                        <Button variant="outline" disabled={isSaving}>
                            Cancel
                        </Button>
                    </DrawerClose>
                </DrawerFooter>
            ) : (
                <DialogFooter className="border-t px-6 py-4">
                    <Button
                        variant="outline"
                        onClick={() => onOpenChange(false)}
                        disabled={isSaving}
                    >
                        Cancel
                    </Button>
                    <Button
                        onClick={() => croppedAreaPixels && void onConfirm(croppedAreaPixels)}
                        disabled={!croppedAreaPixels || isSaving}
                    >
                        {isSaving ? <Loader2 className="size-4 animate-spin" /> : null}
                        Apply Crop
                    </Button>
                </DialogFooter>
            )}
        </>
    )

    if (isMobile) {
        return (
            <Drawer open={open} onOpenChange={onOpenChange}>
                <DrawerContent
                    className="z-[80] flex max-h-[92dvh] flex-col gap-0 overflow-hidden border-border/60 bg-background p-0"
                    overlayClassName="z-[80]"
                >
                    <DrawerHeader className="shrink-0 text-left">
                        <DrawerTitle>Crop Persona Avatar</DrawerTitle>
                        <DrawerDescription>
                            Adjust the image inside a locked 1:1 crop.
                        </DrawerDescription>
                    </DrawerHeader>
                    {content}
                </DrawerContent>
            </Drawer>
        )
    }

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="max-w-2xl gap-0 overflow-hidden p-0">
                <DialogHeader className="border-b px-6 pt-6 pb-4">
                    <DialogTitle>Crop Persona Avatar</DialogTitle>
                    <DialogDescription>
                        Adjust the image inside a locked 1:1 crop.
                    </DialogDescription>
                </DialogHeader>
                <div className="py-5">{content}</div>
            </DialogContent>
        </Dialog>
    )
}
