import {
    MAX_FILE_SIZE,
    MAX_TOKENS_PER_FILE,
    estimateTokenCount,
    getFileTypeInfo,
    isImageMimeType,
    isSupportedFile
} from "@/lib/file_constants"
import { ensureAttachmentFilename } from "./shared"

const IMAGE_COMPRESSION_CUTOFF_BYTES = 25 * 1024 * 1024
const IMAGE_COMPRESSION_STEPS = [
    { quality: 0.86, maxDimension: 4096 },
    { quality: 0.78, maxDimension: 3072 },
    { quality: 0.68, maxDimension: 2560 },
    { quality: 0.56, maxDimension: 2048 }
] as const

export const fetchRemoteAttachmentAsFile = async ({
    url,
    filename
}: {
    url: string
    filename: string
}) => {
    const response = await fetch(url)
    if (!response.ok) {
        throw new Error(`Failed to download attachment (${response.status})`)
    }

    const blob = await response.blob()
    const resolvedName = ensureAttachmentFilename({
        fileNameHint: filename,
        url,
        mimeType: blob.type
    })

    return new File([blob], resolvedName, {
        type: blob.type || undefined
    })
}

const compressImageToLimit = async (file: File) => {
    const objectUrl = URL.createObjectURL(file)

    try {
        const sourceImage = await new Promise<HTMLImageElement>((resolve, reject) => {
            const image = new Image()
            image.onload = () => resolve(image)
            image.onerror = () => reject(new Error("Failed to decode image"))
            image.src = objectUrl
        })

        for (const step of IMAGE_COMPRESSION_STEPS) {
            const largestSide = Math.max(sourceImage.width, sourceImage.height)
            const scale = Math.min(1, step.maxDimension / largestSide)
            const targetWidth = Math.max(1, Math.floor(sourceImage.width * scale))
            const targetHeight = Math.max(1, Math.floor(sourceImage.height * scale))

            const canvas = document.createElement("canvas")
            canvas.width = targetWidth
            canvas.height = targetHeight

            const context = canvas.getContext("2d")
            if (!context) {
                throw new Error("Image compression unavailable in this browser")
            }

            context.clearRect(0, 0, targetWidth, targetHeight)
            context.drawImage(sourceImage, 0, 0, targetWidth, targetHeight)

            const compressedBlob = await new Promise<Blob | null>((resolve) => {
                canvas.toBlob((blob) => resolve(blob), "image/webp", step.quality)
            })

            if (!compressedBlob) {
                continue
            }

            const compressedNameBase = file.name.replace(/\.[^.]+$/, "") || "attachment"
            const compressedFile = new File([compressedBlob], `${compressedNameBase}.webp`, {
                type: "image/webp",
                lastModified: Date.now()
            })

            if (compressedFile.size <= MAX_FILE_SIZE) {
                return compressedFile
            }
        }

        throw new Error("Could not compress image below 5MB")
    } finally {
        URL.revokeObjectURL(objectUrl)
    }
}

export const prepareImportedAttachmentFile = async (inputFile: File) => {
    if (!isSupportedFile(inputFile.name, inputFile.type)) {
        throw new Error(`Unsupported file type: ${inputFile.name}`)
    }

    const fileTypeInfo = getFileTypeInfo(inputFile.name, inputFile.type)
    let file = inputFile

    if (fileTypeInfo.isVisionImage && file.size > MAX_FILE_SIZE) {
        if (file.size > IMAGE_COMPRESSION_CUTOFF_BYTES) {
            throw new Error(`${file.name}: Image exceeds 25MB limit`)
        }

        if (!isImageMimeType(file.type)) {
            throw new Error(`${file.name}: Unsupported image type`)
        }

        file = await compressImageToLimit(file)
    }

    if (file.size > MAX_FILE_SIZE) {
        throw new Error(`${file.name}: File size exceeds 5MB limit`)
    }

    if (fileTypeInfo.isText && (!fileTypeInfo.isImage || fileTypeInfo.isSvg)) {
        const textContent = await file.text()
        const tokenCount = estimateTokenCount(textContent)

        if (tokenCount > MAX_TOKENS_PER_FILE) {
            throw new Error(
                `${file.name}: File exceeds ${MAX_TOKENS_PER_FILE.toLocaleString()} token limit`
            )
        }
    }

    return file
}
