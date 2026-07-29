import { z } from "zod"
import { create } from "zustand"
import { persist } from "zustand/middleware"
import { type AssistantMessageMetadata, mergeMessageFooterMetadata } from "./message-footer-stats"

export const MESSAGE_FOOTER_STORE_KEY = "message-footer-store"

export type AssistantFooterMode = "simple" | "nerd" | "extra-nerdy"

type MessageFooterStore = {
    footerMode: AssistantFooterMode
    footerMetadataByMessageId: Record<string, AssistantMessageMetadata | undefined>
    setFooterMode: (footerMode: AssistantFooterMode) => void
    setFooterMetadata: (messageId: string, metadata: AssistantMessageMetadata) => void
    clearFooterMetadata: (messageId: string) => void
}

const PersistedMessageFooterStoreSchema = z.object({
    footerMode: z.enum(["simple", "nerd", "extra-nerdy"]).optional()
})

export const useMessageFooterStore = create<MessageFooterStore>()(
    persist(
        (set) => ({
            footerMode: "simple",
            footerMetadataByMessageId: {},
            setFooterMode: (footerMode) => set({ footerMode }),
            setFooterMetadata: (messageId, metadata) =>
                set((state) => ({
                    footerMetadataByMessageId: {
                        ...state.footerMetadataByMessageId,
                        [messageId]: mergeMessageFooterMetadata(
                            state.footerMetadataByMessageId[messageId],
                            metadata
                        )
                    }
                })),
            clearFooterMetadata: (messageId) =>
                set((state) => {
                    if (!(messageId in state.footerMetadataByMessageId)) {
                        return state
                    }

                    const footerMetadataByMessageId = { ...state.footerMetadataByMessageId }
                    delete footerMetadataByMessageId[messageId]
                    return { footerMetadataByMessageId }
                })
        }),
        {
            name: MESSAGE_FOOTER_STORE_KEY,
            partialize: (state) => ({ footerMode: state.footerMode }),
            merge: (persistedState, currentState) => {
                const parsed = PersistedMessageFooterStoreSchema.safeParse(persistedState)
                if (!parsed.success) {
                    return currentState
                }

                return {
                    ...currentState,
                    ...parsed.data
                }
            }
        }
    )
)
