import {
    DEFAULT_UPLOAD_POLICY,
    UPLOAD_POLICY_HEADER,
    type UploadPolicy,
    estimateTokenCount,
    formatFileSizeLimit,
    getFileTypeInfo,
    isImageMimeType,
    isSvgExtension,
    isSvgMimeType,
    isTextMimeType
} from "@/lib/file_constants"
import type { UploadedFile } from "./chat-store"

export interface UploadedFileWithSource extends UploadedFile {
    file?: File
}

export const readChatAttachmentContent = async (file: File): Promise<string> =>
    isSvgMimeType(file.type) ||
    isSvgExtension(file.name) ||
    isTextMimeType(file.type) ||
    getFileTypeInfo(file.name, file.type).isText
        ? file.text().catch(() => "Error reading file")
        : new Promise((resolve) => {
              const reader = new FileReader()
              reader.onload = (event) => {
                  const result = event.target?.result as string
                  resolve(result)
              }
              reader.onerror = () => resolve("Error reading file")

              if (isImageMimeType(file.type)) {
                  reader.readAsDataURL(file)
              } else {
                  resolve(`Binary file: ${file.name}`)
              }
          })

export const compressChatImageIfNeeded = async (
    file: File,
    policy: UploadPolicy = DEFAULT_UPLOAD_POLICY
): Promise<File> => {
    const isSvg = isSvgMimeType(file.type) || isSvgExtension(file.name)
    const isRasterImage = isImageMimeType(file.type) && !isSvg

    if (!isRasterImage || file.size <= policy.maxFileSize) {
        return file
    }

    if (file.size > policy.maxCompressibleImageSize) {
        throw new Error(
            `${file.name}: Image exceeds ${formatFileSizeLimit(policy.maxCompressibleImageSize)} limit`
        )
    }

    const objectUrl = URL.createObjectURL(file)

    try {
        const sourceImage = await new Promise<HTMLImageElement>((resolve, reject) => {
            const image = new Image()
            image.onload = () => resolve(image)
            image.onerror = () => reject(new Error("Failed to decode image"))
            image.src = objectUrl
        })

        for (const step of policy.imageCompressionSteps) {
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

            const compressedName = file.name.replace(/\.[^.]+$/, "") || file.name
            const compressedFile = new File([compressedBlob], `${compressedName}.webp`, {
                type: "image/webp",
                lastModified: file.lastModified
            })

            if (compressedFile.size < policy.maxFileSize) {
                return compressedFile
            }
        }

        throw new Error(
            `${file.name}: Could not compress image below ${formatFileSizeLimit(policy.maxFileSize)} after ${policy.imageCompressionSteps.length} attempts`
        )
    } finally {
        URL.revokeObjectURL(objectUrl)
    }
}

export const prepareChatAttachmentForUpload = async (
    file: File,
    policy: UploadPolicy = DEFAULT_UPLOAD_POLICY
): Promise<File> => {
    let fileToUpload = file
    const fileTypeInfo = getFileTypeInfo(fileToUpload.name, fileToUpload.type)

    if (fileTypeInfo.isVisionImage && fileToUpload.size > policy.maxFileSize) {
        fileToUpload = await compressChatImageIfNeeded(fileToUpload, policy)
    }

    if (fileTypeInfo.isText && (!fileTypeInfo.isImage || fileTypeInfo.isSvg)) {
        try {
            const content = await readChatAttachmentContent(fileToUpload)
            const tokenCount = estimateTokenCount(content)
            if (tokenCount > policy.maxTokensPerFile) {
                throw new Error(
                    `${fileToUpload.name}: File exceeds ${policy.maxTokensPerFile.toLocaleString()} token limit`
                )
            }
        } catch (error) {
            if (error instanceof Error && error.message.includes("exceeds")) {
                throw error
            }
            throw new Error(`${fileToUpload.name}: Error reading file content`)
        }
    }

    return fileToUpload
}

export const uploadChatAttachment = async ({
    file,
    jwt,
    uploadUrl,
    policyVersion,
    onProgress,
    onPolicyVersionMismatch
}: {
    file: File
    jwt: string
    uploadUrl: string
    policyVersion?: string
    onProgress?: (progress: number) => void
    onPolicyVersionMismatch?: (serverPolicyVersion: string) => void
}): Promise<UploadedFileWithSource> => {
    const formData = new FormData()
    formData.append("file", file)
    formData.append("fileName", file.name)

    if (!onProgress) {
        const response = await fetch(uploadUrl, {
            method: "POST",
            headers: {
                Authorization: `Bearer ${jwt}`,
                ...(policyVersion ? { [UPLOAD_POLICY_HEADER]: policyVersion } : {})
            },
            body: formData
        })

        const serverPolicyVersion = response.headers.get(UPLOAD_POLICY_HEADER)
        if (serverPolicyVersion && serverPolicyVersion !== policyVersion) {
            onPolicyVersionMismatch?.(serverPolicyVersion)
        }

        const result = await response.json().catch(() => null)
        if (!response.ok) {
            throw new Error(result?.error || "Upload failed")
        }

        return {
            ...result,
            file
        }
    }

    return new Promise((resolve, reject) => {
        const xhr = new XMLHttpRequest()
        xhr.open("POST", uploadUrl)
        xhr.setRequestHeader("Authorization", `Bearer ${jwt}`)
        if (policyVersion) {
            xhr.setRequestHeader(UPLOAD_POLICY_HEADER, policyVersion)
        }

        xhr.upload.onprogress = (event) => {
            if (event.lengthComputable) {
                const progress = Math.round((event.loaded / event.total) * 100)
                onProgress(progress)
            }
        }

        xhr.onload = () => {
            const serverPolicyVersion = xhr.getResponseHeader(UPLOAD_POLICY_HEADER)
            if (serverPolicyVersion && serverPolicyVersion !== policyVersion) {
                onPolicyVersionMismatch?.(serverPolicyVersion)
            }

            if (xhr.status >= 200 && xhr.status < 300) {
                try {
                    const result = JSON.parse(xhr.responseText)
                    resolve({
                        ...result,
                        file
                    })
                } catch {
                    reject(new Error("Invalid response from server"))
                }
            } else {
                try {
                    const errorData = JSON.parse(xhr.responseText)
                    reject(new Error(errorData.error || "Upload failed"))
                } catch {
                    reject(new Error("Upload failed"))
                }
            }
        }

        xhr.onerror = () => {
            reject(new Error("Upload failed due to a network error"))
        }

        xhr.send(formData)
    })
}
