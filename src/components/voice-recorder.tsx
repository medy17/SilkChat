import { VOICE_LEVEL_HISTORY_SIZE, type VoiceRecorderState } from "@/hooks/use-voice-recorder"
import { cn } from "@/lib/utils"
import { memo } from "react"

interface VoiceRecorderProps {
    state: VoiceRecorderState
    className?: string
}

const MIN_BAR_HEIGHT = 2
const MAX_BAR_HEIGHT = 24
// Speech rarely pushes the averaged spectrum past ~0.3, so stretch it to fill the row.
const LEVEL_GAIN = 3.5

const formatDuration = (seconds: number): string => {
    const mins = Math.floor(seconds / 60)
    const secs = seconds % 60
    return `${mins}:${secs.toString().padStart(2, "0")}`
}

// Scrolling level history, newest on the right. Older bars clip off the left
// edge on narrow composers; silence draws as a dotted baseline. Once frozen, the
// skeleton shimmer sweeps across the captured waveform as a mask.
const Waveform = memo(({ levels, isFrozen }: { levels: number[]; isFrozen: boolean }) => {
    const padding = Math.max(0, VOICE_LEVEL_HISTORY_SIZE - levels.length)
    const bars = [...Array<number>(padding).fill(0), ...levels]

    return (
        <div
            aria-hidden="true"
            className={cn(
                "flex h-6 min-w-0 flex-1 items-center justify-end gap-1 overflow-hidden",
                isFrozen &&
                    "animate-[mask-shimmer_1.15s_infinite_linear] [mask-image:linear-gradient(to_right,rgb(0_0_0/0.35)_25%,black_50%,rgb(0_0_0/0.35)_75%)] [mask-size:200%_100%] motion-reduce:animate-none"
            )}
        >
            {bars.map((level, index) => (
                <span
                    key={index}
                    className={cn(
                        "w-0.5 shrink-0 rounded-full transition-[height,background-color] duration-100",
                        isFrozen ? "bg-muted-foreground" : "bg-foreground/70"
                    )}
                    style={{
                        height: `${MIN_BAR_HEIGHT + Math.min(1, level * LEVEL_GAIN) * (MAX_BAR_HEIGHT - MIN_BAR_HEIGHT)}px`
                    }}
                />
            ))}
        </div>
    )
})

Waveform.displayName = "Waveform"

// Fills the composer's textarea slot while dictating; the composer's own primary
// action doubles as the stop button, so the shell never changes size. Stopping
// freezes the dot and timer in place rather than swapping in a label.
export const VoiceRecorder = memo(({ state, className }: VoiceRecorderProps) => {
    const { isTranscribing, recordingDuration, levelHistory } = state

    return (
        <div
            role="status"
            aria-live="polite"
            className={cn("flex items-center gap-3 px-3", className)}
        >
            <div className="flex shrink-0 items-center gap-2">
                <span
                    className={cn(
                        "size-2 rounded-full transition-colors duration-200",
                        isTranscribing ? "bg-muted-foreground/50" : "animate-pulse bg-destructive"
                    )}
                />
                <span className="font-mono text-muted-foreground text-sm tabular-nums">
                    <span className="sr-only">
                        {isTranscribing ? "Transcribing " : "Recording "}
                    </span>
                    {formatDuration(recordingDuration)}
                </span>
            </div>

            <Waveform levels={levelHistory} isFrozen={isTranscribing} />
        </div>
    )
})

VoiceRecorder.displayName = "VoiceRecorder"
