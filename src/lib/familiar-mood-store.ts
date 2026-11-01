import { useEffect, useState } from "react"
import { create } from "zustand"

export type FamiliarMood =
    | "idle"
    | "curious"
    | "happy"
    | "surprised"
    | "listening"
    | "worried"
    | "sleepy"
    | "dizzy"

type FamiliarReaction = { mood: FamiliarMood; id: number }

interface FamiliarMoodStore {
    reaction: FamiliarReaction | null
    isListening: boolean
    react: (mood: FamiliarMood, durationMs?: number) => void
    setListening: (isListening: boolean) => void
}

let nextReactionId = 0

// Composer events reach the empty-chat familiar through this store rather than props,
// because they fire deep inside the composer's attachment, paste and voice paths.
export const useFamiliarMoodStore = create<FamiliarMoodStore>()((set, get) => ({
    reaction: null,
    isListening: false,
    react: (mood, durationMs = 1200) => {
        const id = ++nextReactionId
        set({ reaction: { mood, id } })
        setTimeout(() => {
            if (get().reaction?.id === id) set({ reaction: null })
        }, durationMs)
    },
    setListening: (isListening) => set({ isListening })
}))

const isLateNight = () => {
    const hour = new Date().getHours()
    return hour < 5
}

// One-off reactions win over held states, which win over the late-night default.
export const useFamiliarMood = (isComposerActive: boolean): FamiliarMood => {
    const reaction = useFamiliarMoodStore((state) => state.reaction)
    const isListening = useFamiliarMoodStore((state) => state.isListening)
    const [lateNight, setLateNight] = useState(isLateNight)

    // Re-checked when the tab comes back rather than on a timer.
    useEffect(() => {
        const update = () => {
            if (document.visibilityState === "visible") setLateNight(isLateNight())
        }
        document.addEventListener("visibilitychange", update)
        return () => document.removeEventListener("visibilitychange", update)
    }, [])

    if (reaction) return reaction.mood
    if (isListening) return "listening"
    if (isComposerActive) return "curious"
    if (lateNight) return "sleepy"
    return "idle"
}
