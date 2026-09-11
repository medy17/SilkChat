import type { Meta, StoryObj } from "@storybook/react-vite"
import { fn } from "storybook/test"
import { VoiceRecorder } from "@/components/voice-recorder"

const meta = {
    title: "Chat/Voice recorder",
    component: VoiceRecorder,
    tags: ["autodocs"],
    parameters: {
        docs: {
            description: {
                component:
                    "multimodal-input.tsx recording bar. The fixture supplies recorder state without accessing the microphone."
            }
        }
    },
    args: {
        state: {
            isRecording: true,
            isTranscribing: false,
            recordingDuration: 18,
            audioLevel: 0.55,
            waveformData: []
        },
        onStop: fn()
    }
} satisfies Meta<typeof VoiceRecorder>
export default meta
type Story = StoryObj<typeof meta>
export const Playground: Story = {}
export const Transcribing: Story = {
    args: {
        state: {
            isRecording: false,
            isTranscribing: true,
            recordingDuration: 18,
            audioLevel: 0,
            waveformData: []
        }
    }
}
