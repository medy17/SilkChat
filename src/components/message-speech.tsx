import type { UIMessage } from "ai"
import { Loader2, Pause, Play, RotateCcw, Square, Volume2 } from "lucide-react"
import { useEffect, useMemo } from "react"
import { useLocation } from "@tanstack/react-router"
import { authClient } from "@/lib/auth-client"
import { getMessageSpeechText } from "@/lib/speech-text"
import { startSpeech, stopSpeech, toggleSpeechPause, useSpeechPlayer } from "@/lib/speech-player"
import { Button } from "./ui/button"
import { Tooltip, TooltipContent, TooltipTrigger } from "./ui/tooltip"

export function SpeechPlaybackRuntime() {
    const pathname = useLocation({ select: (location) => location.pathname })
    const { data: session } = authClient.useSession()
    // Navigation and account changes end playback; virtualized row unmounts do not.
    // biome-ignore lint/correctness/useExhaustiveDependencies: These values define the playback lifetime.
    useEffect(() => stopSpeech, [pathname, session?.user.id])
    useEffect(() => {
        window.addEventListener("pagehide", stopSpeech)
        return () => window.removeEventListener("pagehide", stopSpeech)
    }, [])
    return null
}

export function MessageSpeech({ message, threadId }: { message: UIMessage; threadId: string }) {
    const text = useMemo(() => getMessageSpeechText(message.parts), [message.parts])
    const status = useSpeechPlayer((state) =>
        state.messageId === message.id ? state.status : "idle"
    )
    const error = useSpeechPlayer((state) => (state.messageId === message.id ? state.error : null))
    useEffect(() => {
        const state = useSpeechPlayer.getState()
        if (state.messageId === message.id && state.text !== text) stopSpeech()
    }, [message.id, text])
    if (!text) return null
    const busy = status === "loading"
    const playing = status === "playing"
    const paused = status === "paused"
    const label = busy
        ? "Preparing speech"
        : playing
          ? "Pause reading"
          : paused
            ? "Resume reading"
            : error
              ? "Retry read aloud"
              : "Read aloud"
    const Icon = busy ? Loader2 : playing ? Pause : paused ? Play : error ? RotateCcw : Volume2
    return (
        <>
            <Tooltip delayDuration={150}>
                <TooltipTrigger asChild>
                    <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7 rounded-[var(--radius-md)] border bg-background/80 text-foreground shadow-sm backdrop-blur-sm"
                        aria-label={label}
                        disabled={busy}
                        onClick={() => {
                            if (playing || paused) void toggleSpeechPause()
                            else void startSpeech(message.id, threadId, text)
                        }}
                    >
                        <Icon className={busy ? "size-3.5 animate-spin" : "size-3.5"} />
                    </Button>
                </TooltipTrigger>
                <TooltipContent side="bottom">{error ?? label}</TooltipContent>
            </Tooltip>
            {(busy || playing || paused) && (
                <Button
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7 rounded-[var(--radius-md)] border bg-background/80 text-foreground shadow-sm backdrop-blur-sm"
                    aria-label="Stop reading"
                    title="Stop reading"
                    onClick={stopSpeech}
                >
                    <Square className="size-3.5" />
                </Button>
            )}
            <span className="sr-only" role="status">
                {error ?? (busy ? "Preparing speech" : "")}
            </span>
        </>
    )
}
