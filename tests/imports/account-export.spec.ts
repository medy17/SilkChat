import { describe, expect, it } from "vitest"

import {
    buildAccountExportArchive,
    buildAccountExportArchiveName,
    buildEncryptedAccountExportArchive,
    sanitizeAccountExportSettings
} from "@/lib/account-export"
import { BlobReader, TextWriter, ZipReader } from "@zip.js/zip.js"

describe("account-export", () => {
    it("redacts provider credentials while preserving configuration", () => {
        expect(
            sanitizeAccountExportSettings({
                coreAIProviders: {
                    openai: { enabled: true, encryptedKey: "ciphertext" }
                },
                customAIProviders: {
                    internal: {
                        endpoint: "https://example.com",
                        encryptedKey: "custom-ciphertext"
                    }
                }
            })
        ).toEqual({
            coreAIProviders: {
                openai: { enabled: true, encryptedKey: "[REDACTED]" }
            },
            customAIProviders: {
                internal: {
                    endpoint: "https://example.com",
                    encryptedKey: "[REDACTED]"
                }
            }
        })
    })

    it("builds a downloadable archive even when the account has no conversations", async () => {
        const exportedAt = Date.UTC(2026, 6, 23, 12, 0, 0)
        const archive = buildAccountExportArchive({
            exportedAt,
            profile: { id: "user-1", email: "person@example.com" },
            settings: {},
            personas: [],
            projects: [],
            storedFiles: [],
            threadFiles: [],
            threadCount: 0
        })

        expect(archive.fileName).toBe("2026-07-23--silkchat-account-export.zip")
        expect(archive.blob.type).toBe("application/zip")
        expect(archive.manifest.contents).toMatchObject({
            threadCount: 0,
            exportedConversationCount: 0
        })
        expect(new Uint8Array(await archive.blob.arrayBuffer()).slice(0, 4)).toEqual(
            new Uint8Array([0x50, 0x4b, 0x03, 0x04])
        )
        expect(buildAccountExportArchiveName(exportedAt)).toBe(archive.fileName)
    })

    it("builds a standard AES-256 encrypted ZIP using the one-time password", async () => {
        const password = "server-generated-test-password"
        const archive = await buildEncryptedAccountExportArchive({
            exportedAt: Date.UTC(2026, 6, 23, 12, 0, 0),
            password,
            profile: { id: "user-1" },
            settings: {},
            personas: [],
            projects: [],
            storedFiles: [
                {
                    key: "attachments/user-1/report.pdf",
                    url: "https://assets.example.com/attachments/user-1/report.pdf",
                    contentType: "application/pdf",
                    size: 1234,
                    lastModified: "2026-07-23T11:00:00.000Z"
                }
            ],
            threadFiles: [],
            threadCount: 0
        })
        const reader = new ZipReader(new BlobReader(archive.blob))
        const entries = await reader.getEntries()

        expect(archive.fileName).toMatch(/\.zip$/)
        expect(entries.length).toBeGreaterThan(0)
        expect(entries.every((entry) => entry.encrypted)).toBe(true)
        expect(entries.every((entry) => entry.extraFieldAES?.strength === 3)).toBe(true)
        const manifestEntry = entries.find(
            (entry) => entry.filename === "manifest.json" && "getData" in entry
        )
        const firstFileEntry = entries.find((entry) => "getData" in entry)
        expect(manifestEntry).toBeDefined()
        expect(firstFileEntry).toBeDefined()
        if (
            !manifestEntry ||
            !("getData" in manifestEntry) ||
            !firstFileEntry ||
            !("getData" in firstFileEntry)
        ) {
            throw new Error("Expected encrypted ZIP file entries")
        }
        expect(await manifestEntry.getData(new TextWriter(), { password })).toContain(
            "silkchat-account-export"
        )
        const fileIndexEntry = entries.find(
            (entry) => entry.filename === "files/index.json" && "getData" in entry
        )
        if (!fileIndexEntry || !("getData" in fileIndexEntry)) {
            throw new Error("Expected stored file index")
        }
        expect(await fileIndexEntry.getData(new TextWriter(), { password })).toContain(
            "https://assets.example.com/attachments/user-1/report.pdf"
        )

        await expect(
            firstFileEntry.getData(new TextWriter(), { password: "wrong-password" })
        ).rejects.toThrow()
        await reader.close()
    })
})
