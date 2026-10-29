import { create } from "zustand"
import { persist } from "zustand/middleware"

export const LIBRARY_REFERENCES_STORE_KEY = "library-references:v1"
export const STALE_REFERENCES_MS = 24 * 60 * 60 * 1000

// Only uploaded references persist. Removing one detaches it from the next request.
// The server deletes the object only if no generation has used it yet, because
// generated images link to their references in their metadata.
export type LibraryReference = {
    sourceHash: string
    storageKey: string
}

interface LibraryReferencesStore {
    ownerId: string | null
    references: LibraryReference[]
    // Last time the user added, removed, or generated with references.
    touchedAt: number
    claimReferences: (ownerId: string) => void
    addReference: (reference: LibraryReference) => void
    removeReference: (sourceHash: string) => void
    clearReferences: () => void
    touchReferences: () => void
}

export const areReferencesStale = (touchedAt: number, now = Date.now()) =>
    now - touchedAt > STALE_REFERENCES_MS

export const useLibraryReferencesStore = create<LibraryReferencesStore>()(
    persist(
        (set) => ({
            ownerId: null,
            references: [],
            touchedAt: 0,
            claimReferences: (ownerId) =>
                set((state) =>
                    state.ownerId === ownerId ? state : { ownerId, references: [], touchedAt: 0 }
                ),
            addReference: (reference) =>
                set((state) => ({
                    references: state.references.some(
                        (existing) => existing.sourceHash === reference.sourceHash
                    )
                        ? state.references
                        : [...state.references, reference],
                    touchedAt: Date.now()
                })),
            removeReference: (sourceHash) =>
                set((state) => ({
                    references: state.references.filter(
                        (reference) => reference.sourceHash !== sourceHash
                    ),
                    touchedAt: Date.now()
                })),
            clearReferences: () => set({ references: [], touchedAt: Date.now() }),
            touchReferences: () => set({ touchedAt: Date.now() })
        }),
        { name: LIBRARY_REFERENCES_STORE_KEY }
    )
)

// Another tab's write would otherwise be clobbered by this tab's stale copy.
if (typeof window !== "undefined") {
    window.addEventListener("storage", (event) => {
        if (event.key === LIBRARY_REFERENCES_STORE_KEY) {
            void useLibraryReferencesStore.persist.rehydrate()
        }
    })
}
