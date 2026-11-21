import {
    MAX_SKILL_BUNDLE_BYTES,
    MAX_SKILL_FILES,
    MAX_SKILL_FILE_BYTES
} from "@/convex/lib/skill_bundle"
import { unzipSync } from "fflate"

/** Carries its message in `data`, where the server's own refusals put theirs. */
export class SkillZipError extends Error {
    data: string
    constructor(message: string) {
        super(message)
        this.data = message
    }
}

/**
 * Unpacks a skill's .zip in the browser. Sizes are checked from the archive's own listing
 * before anything is inflated, so a file that expands enormously is refused up front.
 */
export const readSkillZip = async (file: File) => {
    if (file.size > MAX_SKILL_BUNDLE_BYTES)
        throw new SkillZipError("This .zip is too large to add.")
    let count = 0
    let total = 0
    let entries: Record<string, Uint8Array>
    try {
        entries = unzipSync(new Uint8Array(await file.arrayBuffer()), {
            filter: (entry) => {
                if (entry.name.endsWith("/")) return false
                count += 1
                total += entry.originalSize
                if (
                    count > MAX_SKILL_FILES * 2 ||
                    entry.originalSize > MAX_SKILL_FILE_BYTES ||
                    total > MAX_SKILL_BUNDLE_BYTES
                ) {
                    throw new SkillZipError("This skill is too large to add.")
                }
                return true
            }
        })
    } catch (error) {
        if (error instanceof SkillZipError) throw error
        throw new SkillZipError("That file isn't a .zip we can read.")
    }
    return Object.entries(entries).map(([path, bytes]) => ({
        path,
        bytes: bytes.buffer.slice(
            bytes.byteOffset,
            bytes.byteOffset + bytes.byteLength
        ) as ArrayBuffer
    }))
}

export type SkillUploadStatus = "added" | "updated" | "unchanged"

export type SkillUploadResult = {
    slug: string
    status: SkillUploadStatus
}

export type ZipUploadItem = {
    id: string
    fileName: string
    status: "queued" | "uploading" | SkillUploadStatus | "failed"
    slug?: string
    error?: string
}

export const isSkillZipFile = (file: Pick<File, "name" | "type">) =>
    file.name.toLowerCase().endsWith(".zip") ||
    file.type === "application/zip" ||
    file.type === "application/x-zip-compressed"

/** Keeps only .zip files from a file list so dropping a folder alongside zips doesn't noise up the batch. */
export const selectSkillZipFiles = (files: readonly File[]) => files.filter(isSkillZipFile)

const pluralizeSkills = (count: number) => `${count} ${count === 1 ? "skill" : "skills"}`

export type ZipBatchSummary = {
    total: number
    completed: number
    inFlight: boolean
    added: number
    updated: number
    unchanged: number
    failed: number
    label: string
}

export const summarizeSkillZipBatch = (items: readonly ZipUploadItem[]): ZipBatchSummary => {
    let added = 0
    let updated = 0
    let unchanged = 0
    let failed = 0
    let uploadingIndex = -1

    items.forEach((item, index) => {
        if (item.status === "added") added += 1
        else if (item.status === "updated") updated += 1
        else if (item.status === "unchanged") unchanged += 1
        else if (item.status === "failed") failed += 1
        else if (item.status === "uploading" && uploadingIndex === -1) uploadingIndex = index
    })

    const total = items.length
    const completed = added + updated + unchanged + failed
    const inFlight = completed < total

    let label: string
    if (inFlight) {
        const current = uploadingIndex >= 0 ? uploadingIndex + 1 : Math.min(completed + 1, total)
        label = `Adding ${current} of ${total} ${total === 1 ? "skill" : "skills"}...`
    } else if (failed === total) {
        label = `${pluralizeSkills(total)} couldn't be added`
    } else if (added === total) {
        label = `${pluralizeSkills(total)} added`
    } else if (updated === total) {
        label = `${pluralizeSkills(total)} updated`
    } else if (unchanged === total) {
        label = total === 1 ? "1 skill already up to date" : `${total} skills already up to date`
    } else {
        const parts: string[] = []
        if (added > 0) parts.push(`${added} added`)
        if (updated > 0) parts.push(`${updated} updated`)
        if (unchanged > 0) parts.push(`${unchanged} up to date`)
        if (failed > 0) parts.push(`${failed} failed`)
        label = parts.join(", ")
    }

    return { total, completed, inFlight, added, updated, unchanged, failed, label }
}

/**
 * Imports one or more skill .zip files sequentially so each skill installs independently,
 * failures stay isolated to their own file, and the UI gets live per-file status.
 */
export const importSkillZipBatch = async (
    files: readonly File[],
    importOne: (file: File) => Promise<SkillUploadResult>,
    formatError: (error: unknown) => string,
    onChange?: (items: ZipUploadItem[]) => void,
    /** Where these files start in a list that already holds earlier uploads, so ids stay unique. */
    firstIndex = 0
): Promise<ZipUploadItem[]> => {
    const items: ZipUploadItem[] = files.map((file, index) => ({
        id: `${firstIndex + index}:${file.name}`,
        fileName: file.name,
        status: "queued"
    }))
    const emit = () => onChange?.(items.map((item) => ({ ...item })))
    emit()

    for (let index = 0; index < files.length; index += 1) {
        items[index] = { ...items[index], status: "uploading" }
        emit()
        try {
            const result = await importOne(files[index])
            items[index] = {
                ...items[index],
                status: result.status,
                slug: result.slug
            }
        } catch (error) {
            items[index] = {
                ...items[index],
                status: "failed",
                error: formatError(error)
            }
        }
        emit()
    }

    return items.map((item) => ({ ...item }))
}
