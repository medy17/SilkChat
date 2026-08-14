import { MAX_FILE_SIZE, UPLOAD_POLICY_HEADER, formatFileSizeLimit } from "@/lib/file_constants"

export type DirectUploadPurpose =
    | "attachment"
    | "reference"
    | "persona-avatar"
    | "persona-doc"
    | "import-source"

export type DirectUploadedFile = {
    key: string
    fileName: string
    fileType: string
    fileSize: number
    uploadedAt: number
}

type UploadOptions = {
    file: File
    jwt: string
    uploadBaseUrl: string
    purpose: DirectUploadPurpose
    policyVersion?: string
    onProgress?: (progress: number) => void
    onPolicyVersionMismatch?: (serverPolicyVersion: string) => void
    onReservationCreated?: (key: string) => void
    signal?: AbortSignal
}

const MAX_UPLOAD_SIZE_BY_PURPOSE: Record<DirectUploadPurpose, number> = {
    attachment: MAX_FILE_SIZE,
    reference: MAX_FILE_SIZE,
    "persona-avatar": 100 * 1024,
    "persona-doc": MAX_FILE_SIZE,
    "import-source": 100 * 1024 * 1024
}

const assertLocalFileSize = (file: File, purpose: DirectUploadPurpose) => {
    const maxSize = MAX_UPLOAD_SIZE_BY_PURPOSE[purpose]
    if (file.size > maxSize) {
        throw new Error(`${file.name}: File size exceeds ${formatFileSizeLimit(maxSize)} limit`)
    }
}

const parseJson = async (response: Response) => {
    const payload = await response.json().catch(() => null)
    if (!response.ok) {
        throw new Error(payload?.error || `Upload failed with status ${response.status}`)
    }
    return payload
}

const policyHeaders = (jwt: string, policyVersion?: string) => ({
    Authorization: `Bearer ${jwt}`,
    "Content-Type": "application/json",
    ...(policyVersion ? { [UPLOAD_POLICY_HEADER]: policyVersion } : {})
})

const reportPolicyVersion = (
    headers: Headers,
    policyVersion?: string,
    onMismatch?: (serverPolicyVersion: string) => void
) => {
    const serverVersion = headers.get(UPLOAD_POLICY_HEADER)
    if (serverVersion && serverVersion !== policyVersion) onMismatch?.(serverVersion)
}

const putWithProgress = ({
    url,
    file,
    headers,
    onProgress,
    signal
}: {
    url: string
    file: File
    headers: Record<string, string>
    onProgress: (progress: number) => void
    signal?: AbortSignal
}) =>
    new Promise<void>((resolve, reject) => {
        if (signal?.aborted) {
            reject(new DOMException("Upload cancelled", "AbortError"))
            return
        }

        const xhr = new XMLHttpRequest()
        const abortUpload = () => xhr.abort()
        const cleanup = () => signal?.removeEventListener("abort", abortUpload)

        xhr.open("PUT", url)
        for (const [name, value] of Object.entries(headers)) {
            xhr.setRequestHeader(name, value)
        }
        xhr.upload.onprogress = (event) => {
            if (event.lengthComputable) {
                onProgress(Math.round((event.loaded / event.total) * 100))
            }
        }
        xhr.onload = () => {
            cleanup()
            if (xhr.status >= 200 && xhr.status < 300) resolve()
            else reject(new Error(`Direct upload failed with status ${xhr.status}`))
        }
        xhr.onerror = () => {
            cleanup()
            reject(new Error("Direct upload failed due to a network error"))
        }
        xhr.onabort = () => {
            cleanup()
            reject(new DOMException("Upload cancelled", "AbortError"))
        }
        signal?.addEventListener("abort", abortUpload, { once: true })
        xhr.send(file)
    })

export const uploadFileDirect = async ({
    file,
    jwt,
    uploadBaseUrl,
    purpose,
    policyVersion,
    onProgress,
    onPolicyVersionMismatch,
    onReservationCreated,
    signal
}: UploadOptions): Promise<DirectUploadedFile> => {
    assertLocalFileSize(file, purpose)

    const createResponse = await fetch(`${uploadBaseUrl}/create`, {
        method: "POST",
        headers: policyHeaders(jwt, policyVersion),
        body: JSON.stringify({
            purpose,
            fileName: file.name,
            fileType: file.type,
            fileSize: file.size
        }),
        signal
    })
    reportPolicyVersion(createResponse.headers, policyVersion, onPolicyVersionMismatch)
    const reservation = (await parseJson(createResponse)) as {
        key: string
        uploadUrl: string
        headers: Record<string, string>
        fileType: string
    }
    onReservationCreated?.(reservation.key)

    if (onProgress) {
        await putWithProgress({
            url: reservation.uploadUrl,
            file,
            headers: reservation.headers,
            onProgress,
            signal
        })
    } else {
        const uploadResponse = await fetch(reservation.uploadUrl, {
            method: "PUT",
            headers: reservation.headers,
            body: file,
            signal
        })
        if (!uploadResponse.ok) {
            throw new Error(`Direct upload failed with status ${uploadResponse.status}`)
        }
    }

    const completeResponse = await fetch(`${uploadBaseUrl}/complete`, {
        method: "POST",
        headers: policyHeaders(jwt, policyVersion),
        body: JSON.stringify({ key: reservation.key }),
        signal
    })
    reportPolicyVersion(completeResponse.headers, policyVersion, onPolicyVersionMismatch)
    const completed = (await parseJson(completeResponse)) as {
        key: string
        fileType: string
        fileSize: number
        uploadedAt: number
    }

    return {
        ...completed,
        fileName: file.name
    }
}
