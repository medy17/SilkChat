import { useToken } from "@/hooks/auth-hooks"
import { resolveJwtToken } from "@/lib/auth-token"
import { browserEnv } from "@/lib/browser-env"
import { useCallback, useEffect, useRef, useState } from "react"
import { toast } from "sonner"

interface UseVoiceRecorderOptions {
    onTranscript: (text: string) => void
}

export interface VoiceRecorderState {
    isRecording: boolean
    isTranscribing: boolean
    recordingDuration: number
    audioLevel: number
    waveformData: number[]
}

const TARGET_TRANSCRIPTION_SAMPLE_RATE = 16000

const shouldNormalizeForTranscription = (mimeType: string) =>
    mimeType.includes("mp4") || mimeType.includes("m4a") || mimeType.includes("aac")

const mixToMono = (audioBuffer: AudioBuffer) => {
    if (audioBuffer.numberOfChannels === 1) {
        return audioBuffer.getChannelData(0)
    }

    const mono = new Float32Array(audioBuffer.length)
    for (let channel = 0; channel < audioBuffer.numberOfChannels; channel++) {
        const channelData = audioBuffer.getChannelData(channel)
        for (let i = 0; i < channelData.length; i++) {
            mono[i] += channelData[i] / audioBuffer.numberOfChannels
        }
    }

    return mono
}

const encodeWavMono16Bit = (samples: Float32Array, sampleRate: number) => {
    const bytesPerSample = 2
    const buffer = new ArrayBuffer(44 + samples.length * bytesPerSample)
    const view = new DataView(buffer)

    const writeString = (offset: number, value: string) => {
        for (let i = 0; i < value.length; i++) {
            view.setUint8(offset + i, value.charCodeAt(i))
        }
    }

    writeString(0, "RIFF")
    view.setUint32(4, 36 + samples.length * bytesPerSample, true)
    writeString(8, "WAVE")
    writeString(12, "fmt ")
    view.setUint32(16, 16, true)
    view.setUint16(20, 1, true)
    view.setUint16(22, 1, true)
    view.setUint32(24, sampleRate, true)
    view.setUint32(28, sampleRate * bytesPerSample, true)
    view.setUint16(32, bytesPerSample, true)
    view.setUint16(34, 16, true)
    writeString(36, "data")
    view.setUint32(40, samples.length * bytesPerSample, true)

    let offset = 44
    for (let i = 0; i < samples.length; i++) {
        const sample = Math.max(-1, Math.min(1, samples[i]))
        view.setInt16(offset, sample < 0 ? sample * 0x8000 : sample * 0x7fff, true)
        offset += bytesPerSample
    }

    return new Blob([buffer], { type: "audio/wav" })
}

const normalizeAudioForTranscription = async (audioBlob: Blob) => {
    if (!shouldNormalizeForTranscription(audioBlob.type)) {
        return audioBlob
    }

    const AudioContextCtor = window.AudioContext || (window as any).webkitAudioContext
    const OfflineAudioContextCtor =
        window.OfflineAudioContext || (window as any).webkitOfflineAudioContext

    if (!AudioContextCtor || !OfflineAudioContextCtor) {
        return audioBlob
    }

    const decodeContext = new AudioContextCtor()
    try {
        const sourceBytes = await audioBlob.arrayBuffer()
        const decoded = await decodeContext.decodeAudioData(sourceBytes.slice(0))
        const monoData = mixToMono(decoded)

        const offlineContext = new OfflineAudioContextCtor(
            1,
            Math.ceil(decoded.duration * TARGET_TRANSCRIPTION_SAMPLE_RATE),
            TARGET_TRANSCRIPTION_SAMPLE_RATE
        )
        const monoBuffer = offlineContext.createBuffer(1, monoData.length, decoded.sampleRate)
        monoBuffer.copyToChannel(monoData, 0)

        const source = offlineContext.createBufferSource()
        source.buffer = monoBuffer
        source.connect(offlineContext.destination)
        source.start(0)

        const rendered = await offlineContext.startRendering()
        return encodeWavMono16Bit(rendered.getChannelData(0), rendered.sampleRate)
    } catch (error) {
        console.warn("Audio normalization failed, uploading original blob:", error)
        return audioBlob
    } finally {
        if (decodeContext.state !== "closed") {
            await decodeContext.close()
        }
    }
}

// Detect if we're on iOS Safari
const isIOSSafari = () => {
    const userAgent = navigator.userAgent
    const isIOS =
        /iPad|iPhone|iPod/.test(userAgent) ||
        (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1)
    const isSafari = /^((?!chrome|android).)*safari/i.test(userAgent)
    return isIOS && isSafari
}

// Check if MediaRecorder is actually usable
const isMediaRecorderUsable = (): boolean => {
    if (!window.MediaRecorder) {
        return false
    }

    if (!navigator || !navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        return false
    }

    if (isIOSSafari()) {
        try {
            const formats = ["audio/mp4", "audio/aac", "audio/m4a", "audio/wav"]
            const supported = formats.some((format) => {
                try {
                    return MediaRecorder.isTypeSupported?.(format) ?? false
                } catch {
                    return false
                }
            })

            if (!supported) {
                console.warn("MediaRecorder exists but no audio formats are supported")
                return false
            }
        } catch (error) {
            console.warn("MediaRecorder compatibility check failed:", error)
            return false
        }
    }

    return true
}

// Get the best supported MIME type for the current browser
const getBestSupportedMimeType = (): string => {
    const types = [
        "audio/mp4",
        "audio/aac",
        "audio/m4a",
        "audio/webm;codecs=opus",
        "audio/webm",
        "audio/ogg;codecs=opus",
        ""
    ]

    for (const type of types) {
        if (type === "") return ""

        try {
            if (MediaRecorder.isTypeSupported?.(type)) {
                return type
            }
        } catch (error) {
            console.warn(`Error checking support for ${type}:`, error)
        }
    }

    return ""
}

export const useVoiceRecorder = ({ onTranscript }: UseVoiceRecorderOptions) => {
    const { token } = useToken()
    const [state, setState] = useState<VoiceRecorderState>({
        isRecording: false,
        isTranscribing: false,
        recordingDuration: 0,
        audioLevel: 0,
        waveformData: []
    })

    const mediaRecorderRef = useRef<MediaRecorder | null>(null)
    const audioContextRef = useRef<AudioContext | null>(null)
    const analyserRef = useRef<AnalyserNode | null>(null)
    const dataArrayRef = useRef<Uint8Array<ArrayBuffer> | null>(null)
    const recordingStartTimeRef = useRef<number>(0)
    const durationIntervalRef = useRef<number | null>(null)
    const audioLevelIntervalRef = useRef<number | null>(null)
    const audioChunksRef = useRef<Blob[]>([])
    const tokenRef = useRef<string | undefined>(undefined)
    const mediaStreamRef = useRef<MediaStream | null>(null)

    // Keep token ref up to date
    useEffect(() => {
        tokenRef.current = token
    }, [token])

    const updateAudioLevel = useCallback(() => {
        if (!analyserRef.current || !dataArrayRef.current) return

        try {
            // Get frequency data for overall audio level
            analyserRef.current.getByteFrequencyData(dataArrayRef.current)
            const average =
                dataArrayRef.current.reduce((a, b) => a + b) / dataArrayRef.current.length
            const normalizedLevel = average / 255

            // Get time domain data for waveform
            const waveformArray = new Uint8Array(new ArrayBuffer(analyserRef.current.fftSize))
            analyserRef.current.getByteTimeDomainData(waveformArray)

            // Convert to normalized values and downsample
            const downsampleFactor = 4
            const waveformData: number[] = []
            for (let i = 0; i < waveformArray.length; i += downsampleFactor) {
                const sample = (waveformArray[i] - 128) / 128
                waveformData.push(sample)
            }

            setState((prev) => ({
                ...prev,
                audioLevel: normalizedLevel,
                waveformData
            }))
        } catch (error) {
            console.warn("Audio level analysis failed:", error)
        }
    }, [])

    const cleanupRecording = useCallback(() => {
        console.log("Cleaning up recording resources...")

        // Clear intervals
        if (durationIntervalRef.current) {
            clearInterval(durationIntervalRef.current)
            durationIntervalRef.current = null
        }
        if (audioLevelIntervalRef.current) {
            clearInterval(audioLevelIntervalRef.current)
            audioLevelIntervalRef.current = null
        }

        // Disconnect audio nodes
        if (analyserRef.current) {
            analyserRef.current.disconnect()
            analyserRef.current = null
        }

        // Stop media stream tracks
        if (mediaStreamRef.current) {
            mediaStreamRef.current.getTracks().forEach((track) => {
                track.stop()
                console.log(`Stopped ${track.kind} track`)
            })
            mediaStreamRef.current = null
        }

        // Close audio context
        if (audioContextRef.current && audioContextRef.current.state !== "closed") {
            audioContextRef.current.close()
            console.log("Audio context closed")
            audioContextRef.current = null
        }

        // Clean up other references
        dataArrayRef.current = null
        mediaRecorderRef.current = null
        audioChunksRef.current = []
    }, [])

    const startRecording = useCallback(async () => {
        try {
            // Enhanced browser support checks
            if (!navigator || !navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
                if (isIOSSafari()) {
                    throw new Error(
                        "Microphone access is not available. This can happen when launching from the home screen or when not using HTTPS. Please open this page directly in Safari with HTTPS."
                    )
                }
                throw new Error(
                    "Your browser doesn't support audio recording. Please try using the latest version of Safari."
                )
            }

            if (!isMediaRecorderUsable()) {
                if (isIOSSafari()) {
                    throw new Error(
                        "Audio recording is not available on this version of iOS Safari. Please update to iOS 14.3 or later."
                    )
                }
                throw new Error("MediaRecorder not supported in your browser")
            }

            // Audio constraints
            const constraints = {
                audio: {
                    echoCancellation: true,
                    noiseSuppression: true,
                    autoGainControl: true,
                    ...(isIOSSafari() && {
                        sampleRate: 44100,
                        channelCount: 1
                    })
                }
            }

            console.log("Requesting microphone access...")
            const mediaStream = await navigator.mediaDevices.getUserMedia(constraints)
            mediaStreamRef.current = mediaStream

            // Create audio context for visualization only
            window.AudioContext = window.AudioContext || (window as any).webkitAudioContext
            audioContextRef.current = new AudioContext()

            if (audioContextRef.current.state === "suspended") {
                await audioContextRef.current.resume()
                console.log("AudioContext resumed")
            }

            // Set up simple audio analysis for visualization
            analyserRef.current = audioContextRef.current.createAnalyser()
            analyserRef.current.fftSize = 256
            analyserRef.current.smoothingTimeConstant = 0.8
            dataArrayRef.current = new Uint8Array(
                new ArrayBuffer(analyserRef.current.frequencyBinCount)
            )

            // Connect audio stream to analyser for visualization
            const source = audioContextRef.current.createMediaStreamSource(mediaStream)
            source.connect(analyserRef.current)

            // Get the best supported MIME type
            const mimeType = getBestSupportedMimeType()
            console.log(`Using MIME type: ${mimeType || "browser default"}`)

            // Set up MediaRecorder with the original media stream (NOT processed)
            const options: MediaRecorderOptions = {}
            if (mimeType) {
                options.mimeType = mimeType
            }

            if (isIOSSafari() && mimeType.includes("mp4")) {
                options.audioBitsPerSecond = 128000
            }

            try {
                // CRITICAL: Use the original mediaStream directly!
                mediaRecorderRef.current = new MediaRecorder(mediaStream, options)
            } catch (optionsError) {
                console.warn("Failed with options, trying without:", optionsError)
                mediaRecorderRef.current = new MediaRecorder(mediaStream)
            }

            audioChunksRef.current = []

            mediaRecorderRef.current.ondataavailable = (event) => {
                if (event.data.size > 0) {
                    console.log("Received audio data chunk:", event.data.size, "bytes")
                    audioChunksRef.current.push(event.data)
                }
            }

            mediaRecorderRef.current.onstop = async () => {
                console.log("Recording stopped, processing audio...")
                const actualMimeType = mimeType || "audio/mp4"
                const audioBlob = new Blob(audioChunksRef.current, { type: actualMimeType })
                console.log("Created audio blob:", audioBlob.size, "bytes, type:", actualMimeType)

                await transcribeAudio(audioBlob)
                cleanupRecording()
            }

            mediaRecorderRef.current.onerror = (event) => {
                console.error("MediaRecorder error:", event)
                const errorEvent = event as Event & { error?: Error }
                if (errorEvent.error) {
                    toast.error(`Recording failed: ${errorEvent.error.message}`)
                } else {
                    toast.error("Recording failed. Please try again.")
                }
                cleanupRecording()
            }

            // Start recording
            try {
                mediaRecorderRef.current.start(1000)
                console.log("Recording started successfully")
            } catch (startError) {
                console.warn("Failed to start with timeslice, trying without:", startError)
                mediaRecorderRef.current.start()
            }

            recordingStartTimeRef.current = Date.now()

            setState((prev) => ({
                ...prev,
                isRecording: true,
                recordingDuration: 0,
                audioLevel: 0,
                waveformData: []
            }))

            // Start duration counter
            durationIntervalRef.current = window.setInterval(() => {
                const duration = Math.floor((Date.now() - recordingStartTimeRef.current) / 1000)
                setState((prev) => ({ ...prev, recordingDuration: duration }))
            }, 1000)

            // Start audio level monitoring
            audioLevelIntervalRef.current = window.setInterval(updateAudioLevel, 100)
        } catch (error) {
            console.error("Error starting recording:", error)
            cleanupRecording()

            if (error instanceof Error) {
                if (error.name === "NotAllowedError") {
                    toast.error(
                        "Microphone permission denied. Please allow microphone access and try again."
                    )
                } else if (error.name === "NotFoundError") {
                    toast.error(
                        "No microphone found. Please check your device's microphone and try again."
                    )
                } else if (error.name === "NotSupportedError") {
                    toast.error(
                        "Audio recording is not supported on this device/browser combination."
                    )
                } else if (error.name === "AbortError") {
                    toast.error("Recording was interrupted. Please try again.")
                } else {
                    toast.error(error.message)
                }
            } else {
                toast.error("Failed to start recording. Please check microphone permissions.")
            }
        }
    }, [updateAudioLevel, cleanupRecording])

    const stopRecording = useCallback(() => {
        if (mediaRecorderRef.current && state.isRecording) {
            console.log("Stopping recording...")
            mediaRecorderRef.current.stop()

            setState((prev) => ({
                ...prev,
                isRecording: false,
                isTranscribing: true,
                audioLevel: 0,
                waveformData: []
            }))
        }
    }, [state.isRecording])

    const transcribeAudio = useCallback(
        async (audioBlob: Blob) => {
            try {
                if (audioBlob.size === 0) {
                    throw new Error(
                        "No audio data recorded. Please try speaking closer to the microphone."
                    )
                }

                console.log(
                    "Transcribing audio blob:",
                    audioBlob.size,
                    "bytes",
                    "type:",
                    audioBlob.type
                )

                const normalizedAudioBlob = await normalizeAudioForTranscription(audioBlob)
                if (normalizedAudioBlob !== audioBlob) {
                    console.log(
                        "Normalized audio blob:",
                        normalizedAudioBlob.size,
                        "bytes",
                        "type:",
                        normalizedAudioBlob.type
                    )
                }

                const formData = new FormData()
                formData.append(
                    "audio",
                    normalizedAudioBlob,
                    normalizedAudioBlob.type === "audio/wav" ? "audio.wav" : "audio.bin"
                )

                const jwt = await resolveJwtToken(tokenRef.current)
                if (!jwt) {
                    throw new Error("Authentication token unavailable")
                }

                const response = await fetch(`${browserEnv("VITE_CONVEX_API_URL")}/transcribe`, {
                    method: "POST",
                    headers: {
                        Authorization: `Bearer ${jwt}`
                    },
                    body: formData
                })

                if (!response.ok) {
                    const errorData = await response.json()
                    throw new Error(errorData.error || "Transcription failed")
                }

                const { text } = await response.json()

                if (text?.trim()) {
                    console.log("Transcription successful:", text)
                    onTranscript(text.trim())
                } else {
                    toast.error("No speech detected. Please try again and speak clearly.")
                }
            } catch (error) {
                console.error("Transcription error:", error)
                toast.error(error instanceof Error ? error.message : "Failed to transcribe audio")
            } finally {
                setState((prev) => ({
                    ...prev,
                    isTranscribing: false,
                    recordingDuration: 0,
                    waveformData: []
                }))
            }
        },
        [onTranscript]
    )

    const cancelRecording = useCallback(() => {
        if (mediaRecorderRef.current && state.isRecording) {
            console.log("Cancelling recording...")
            mediaRecorderRef.current.ondataavailable = null
            mediaRecorderRef.current.onstop = () => {
                cleanupRecording()
            }
            mediaRecorderRef.current.stop()

            setState((prev) => ({
                ...prev,
                isRecording: false,
                isTranscribing: false,
                recordingDuration: 0,
                audioLevel: 0,
                waveformData: []
            }))
        }
    }, [state.isRecording, cleanupRecording])

    // Clean up on unmount
    useEffect(() => {
        return () => {
            cleanupRecording()
        }
    }, [cleanupRecording])

    return {
        state,
        startRecording,
        stopRecording,
        cancelRecording
    }
}
