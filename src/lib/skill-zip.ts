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
