import { ChatMascot } from "@/components/chat-mascot"
import { ThemeSwitcher } from "@/components/themes/theme-switcher"
import type { FamiliarMood } from "@/lib/familiar-mood-store"
import { cn } from "@/lib/utils"
import { createFileRoute } from "@tanstack/react-router"
import { useState } from "react"

export const Route = createFileRoute("/mascot-demo")({
    head: () => ({ meta: [{ title: "Familiar moods | SilkChat" }] }),
    component: MascotDemoPage
})

const MOODS: { id: FamiliarMood; label: string; trigger: string }[] = [
    { id: "idle", label: "Idle", trigger: "Default" },
    { id: "curious", label: "Curious", trigger: "Typing" },
    { id: "happy", label: "Happy", trigger: "Attach, paste, poke" },
    { id: "surprised", label: "Surprised", trigger: "Dragging a file" },
    { id: "listening", label: "Listening", trigger: "Voice input" },
    { id: "worried", label: "Worried", trigger: "Wiping a long draft" },
    { id: "sleepy", label: "Sleepy", trigger: "Midnight to 5am" },
    { id: "dizzy", label: "Dizzy", trigger: "Five quick pokes" }
]

function MascotDemoPage() {
    const [mood, setMood] = useState<FamiliarMood>("idle")

    return (
        <main className="h-dvh overflow-y-auto bg-background">
            <header className="glass-header sticky top-0 z-20 flex flex-wrap items-center gap-3 border-b px-6 py-3">
                <div className="flex flex-wrap gap-1 rounded-[var(--radius-lg)] bg-glass-control p-1">
                    {MOODS.map((option) => (
                        <button
                            key={option.id}
                            type="button"
                            aria-pressed={mood === option.id}
                            onClick={() => setMood(option.id)}
                            className={cn(
                                "rounded-[var(--radius-md)] px-2.5 py-1 text-muted-foreground text-xs transition-colors hover:text-foreground",
                                mood === option.id && "bg-background text-foreground shadow-sm"
                            )}
                        >
                            {option.label}
                        </button>
                    ))}
                </div>
                <div className="ml-auto">
                    <ThemeSwitcher />
                </div>
            </header>

            <div className="mx-auto flex max-w-4xl flex-col items-center gap-12 px-6 py-12">
                <div className="flex items-end gap-8">
                    <ChatMascot mood={mood} pokeable className="size-32" />
                    <ChatMascot mood={mood} pokeable className="size-24" />
                    <ChatMascot variant="face" mood={mood} pokeable className="size-14" />
                </div>

                <div className="grid w-full grid-cols-2 gap-6 sm:grid-cols-4">
                    {MOODS.map((option) => (
                        <div key={option.id} className="flex flex-col items-center gap-1">
                            <ChatMascot mood={option.id} className="size-24" />
                            <p className="text-sm">{option.label}</p>
                            <p className="text-muted-foreground text-xs">{option.trigger}</p>
                        </div>
                    ))}
                </div>
            </div>
        </main>
    )
}
