import { COMPOSER_TRANSCRIPTION_MODEL } from "@/convex/lib/models/microsoft"
import { getTranscriptionAudioFormat } from "@/convex/lib/models/transcription"
import type { TranscriptionConfig } from "@/convex/lib/models/types"
import { useToken } from "@/hooks/auth-hooks"
import { resolveJwtToken } from "@/lib/auth-token"
import { browserEnv } from "@/lib/browser-env"
import { prepareAudioForTranscription } from "@/lib/audio-transcription"
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

const TRANSCRIPTION_AUDIO_BITRATE = 32_000
const TRANSCRIPTION_CONFIG: TranscriptionConfig = COMPOSER_TRANSCRIPTION_MODEL.transcription

const getAudioFilename = (mimeType: string) => {
    if (mimeType.includes("mp4") || mimeType.includes("m4a")) return "audio.mp4"
    if (mimeType.includes("ogg")) return "audio.ogg"
    if (mimeType.includes("wav")) return "audio.wav"
    if (mimeType.includes("aac")) return "audio.aac"
    return "audio.webm"
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
    const config = TRANSCRIPTION_CONFIG
    const types = [
        "audio/wav",
        "audio/webm;codecs=opus",
        "audio/webm",
        "audio/ogg;codecs=opus",
        "audio/mpeg",
        "audio/mp4",
        "audio/m4a",
        "audio/aac"
    ]
    const orderedTypes = [...types].sort((left, right) => {
        const getPriority = (mimeType: string) => {
            const format = getTranscriptionAudioFormat(mimeType)
            if (format === config.preferredFormat) return 0
            if (format && config.acceptedFormats.includes(format)) return 1
            return 2
        }
        return getPriority(left) - getPriority(right)
    })

    for (const type of orderedTypes) {
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
    const isRecordingRef = useRef(false)

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

    const stopRecordingMonitoring = useCallback(() => {
        if (durationIntervalRef.current !== null) {
            clearInterval(durationIntervalRef.current)
            durationIntervalRef.current = null
        }
        if (audioLevelIntervalRef.current !== null) {
            clearInterval(audioLevelIntervalRef.current)
            audioLevelIntervalRef.current = null
        }
    }, [])

    const cleanupRecording = useCallback(() => {
        // Only log and act if there are actual resources to clean up
        const hasResources =
            durationIntervalRef.current !== null ||
            audioLevelIntervalRef.current !== null ||
            analyserRef.current !== null ||
            mediaStreamRef.current !== null ||
            audioContextRef.current !== null ||
            mediaRecorderRef.current !== null

        if (!hasResources) return

        console.log("Cleaning up recording resources...")

        // Clear intervals
        stopRecordingMonitoring()

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
    }, [stopRecordingMonitoring])

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
            const audioWindow = window as Window & {
                webkitAudioContext?: typeof AudioContext
            }
            window.AudioContext = window.AudioContext || audioWindow.webkitAudioContext
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
            options.audioBitsPerSecond = TRANSCRIPTION_AUDIO_BITRATE

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
                const actualMimeType =
                    mediaRecorderRef.current?.mimeType ||
                    mimeType ||
                    audioChunksRef.current[0]?.type ||
                    "audio/webm"
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

            isRecordingRef.current = true
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
        if (mediaRecorderRef.current && isRecordingRef.current) {
            console.log("Stopping recording...")
            stopRecordingMonitoring()
            mediaRecorderRef.current.stop()

            isRecordingRef.current = false
            setState((prev) => ({
                ...prev,
                isRecording: false,
                isTranscribing: true,
                audioLevel: 0,
                waveformData: []
            }))
        }
    }, [stopRecordingMonitoring])

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

                if (!audioContextRef.current) {
                    throw new Error("Audio processing is unavailable. Please try recording again.")
                }

                const uploadBlob = await prepareAudioForTranscription(
                    audioBlob,
                    audioContextRef.current,
                    TRANSCRIPTION_CONFIG
                )
                const formData = new FormData()
                formData.append("audio", uploadBlob, getAudioFilename(uploadBlob.type))

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
        if (mediaRecorderRef.current && isRecordingRef.current) {
            console.log("Cancelling recording...")
            mediaRecorderRef.current.ondataavailable = null
            mediaRecorderRef.current.onstop = () => {
                cleanupRecording()
            }
            mediaRecorderRef.current.stop()

            isRecordingRef.current = false
            setState((prev) => ({
                ...prev,
                isRecording: false,
                isTranscribing: false,
                recordingDuration: 0,
                audioLevel: 0,
                waveformData: []
            }))
        }
    }, [cleanupRecording])

    // Clean up on unmount
    useEffect(() => {
        return () => {
            cleanupRecording()
        }
        // cleanupRecording is stable (empty deps), safe to omit
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [])

    return {
        state,
        startRecording,
        stopRecording,
        cancelRecording
    }
}
