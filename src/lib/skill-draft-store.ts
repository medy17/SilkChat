import { create } from "zustand"

type SkillDraftState = {
    // The skills picked for the next new chat, by name. Null means no pick was made, so the
    // chat gets the ones that are on for new chats.
    picked: string[] | null
    // The assistant message id of a first send still waiting for its thread.
    pendingMessageId: string | undefined
    setPicked: (slugs: string[] | null) => void
    beginRequest: (assistantMessageId: string) => void
    // The server created the thread, so the pick has done its job. It survives a failed
    // send, which would otherwise quietly start the retry with different skills.
    claimThread: (assistantMessageId: string) => void
}

export const useSkillDraftStore = create<SkillDraftState>((set, get) => ({
    picked: null,
    pendingMessageId: undefined,
    setPicked: (picked) => set({ picked }),
    beginRequest: (pendingMessageId) => set({ pendingMessageId }),
    claimThread: (assistantMessageId) => {
        if (get().pendingMessageId !== assistantMessageId) return
        set({ picked: null, pendingMessageId: undefined })
    }
}))
