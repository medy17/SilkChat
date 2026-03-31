// @vitest-environment jsdom

import { act, renderHook } from "@testing-library/react"
import { beforeEach, describe, expect, it, vi } from "vitest"

const { browserEnvMock, resolveJwtTokenMock, toastErrorMock, useTokenMock } = vi.hoisted(() => ({
    browserEnvMock: vi.fn(),
    resolveJwtTokenMock: vi.fn(),
    toastErrorMock: vi.fn(),
    useTokenMock: vi.fn()
}))

vi.mock("@/hooks/auth-hooks", () => ({
    useToken: useTokenMock
}))

vi.mock("@/lib/auth-token", () => ({
    resolveJwtToken: resolveJwtTokenMock
}))

vi.mock("@/lib/browser-env", () => ({
    browserEnv: browserEnvMock
}))

vi.mock("sonner", () => ({
    toast: {
        error: toastErrorMock
    }
}))

import { useVoiceRecorder } from "@/hooks/use-voice-recorder"

class FakeAnalyserNode {
    fftSize = 0
    smoothingTimeConstant = 0
    frequencyBinCount = 8

    disconnect() {}

    getByteFrequencyData(data: Uint8Array) {
        data.fill(64)
    }

    getByteTimeDomainData(data: Uint8Array) {
        data.fill(128)
    }
}

class FakeAudioContext {
    state = "running"
    analyser = new FakeAnalyserNode()
    source = {
        connect: vi.fn()
    }

    createAnalyser() {
        return this.analyser as unknown as AnalyserNode
    }

    createMediaStreamSource() {
        return this.source as unknown as MediaStreamAudioSourceNode
    }

    close() {
        this.state = "closed"
        return Promise.resolve()
    }

    resume() {
        this.state = "running"
        return Promise.resolve()
    }

    decodeAudioData() {
        return Promise.resolve({
            numberOfChannels: 2,
            length: 4,
            sampleRate: 48_000,
            duration: 4 / 48_000,
            getChannelData(channel: number) {
                if (channel === 0) {
                    return new Float32Array([0, 0.5, -0.5, 0.25])
                }

                return new Float32Array([0.25, -0.25, 0.5, -0.5])
            }
        } as unknown as AudioBuffer)
    }
}

class FakeOfflineAudioContext {
    destination = {}

    constructor(
        public channels: number,
        public length: number,
        public sampleRate: number
    ) {}

    createBuffer() {
        return {
            copyToChannel: vi.fn()
        } as unknown as AudioBuffer
    }

    createBufferSource() {
        return {
            buffer: null,
            connect: vi.fn(),
            start: vi.fn()
        } as unknown as AudioBufferSourceNode
    }

    startRendering() {
        return Promise.resolve({
            sampleRate: this.sampleRate,
            getChannelData() {
                return new Float32Array([0.125, 0.125, 0, -0.125])
            }
        } as unknown as AudioBuffer)
    }
}

type RecorderMode = "success" | "permission-error"

class FakeMediaRecorder {
    static supportedType = "audio/webm"
    static mode: RecorderMode = "success"
    static instances: FakeMediaRecorder[] = []

    static isTypeSupported(type: string) {
        return type === FakeMediaRecorder.supportedType
    }

    ondataavailable: ((event: { data: Blob }) => void) | null = null
    onstop: (() => void | Promise<void>) | null = null
    onerror: ((event: Event) => void) | null = null

    constructor(
        public stream: MediaStream,
        public options: MediaRecorderOptions = {}
    ) {
        FakeMediaRecorder.instances.push(this)
    }

    start() {}

    stop() {
        if (FakeMediaRecorder.mode === "success") {
            this.ondataavailable?.({
                data: new Blob(["audio-data"], {
                    type: this.options.mimeType || FakeMediaRecorder.supportedType
                })
            })
        }

        void this.onstop?.()
    }
}

const installRecorderEnvironment = (options?: {
    getUserMediaImpl?: () => Promise<MediaStream>
}) => {
    const mediaTrack = {
        kind: "audio",
        stop: vi.fn()
    }
    const mediaStream = {
        getTracks: () => [mediaTrack]
    } as unknown as MediaStream

    Object.defineProperty(navigator, "mediaDevices", {
        configurable: true,
        value: {
            getUserMedia: vi.fn(options?.getUserMediaImpl ?? (() => Promise.resolve(mediaStream)))
        }
    })

    vi.stubGlobal("AudioContext", FakeAudioContext)
    Object.defineProperty(window, "AudioContext", {
        configurable: true,
        value: FakeAudioContext
    })
    Object.defineProperty(window, "OfflineAudioContext", {
        configurable: true,
        value: FakeOfflineAudioContext
    })
    Object.defineProperty(window, "MediaRecorder", {
        configurable: true,
        value: FakeMediaRecorder
    })
    vi.stubGlobal("MediaRecorder", FakeMediaRecorder)
    vi.stubGlobal("OfflineAudioContext", FakeOfflineAudioContext)

    return {
        mediaStream,
        mediaTrack
    }
}

const setNavigatorIdentity = ({
    maxTouchPoints = 0,
    platform = "Win32",
    userAgent = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/122.0.0.0 Safari/537.36"
}: {
    maxTouchPoints?: number
    platform?: string
    userAgent?: string
}) => {
    Object.defineProperty(navigator, "userAgent", {
        configurable: true,
        value: userAgent
    })
    Object.defineProperty(navigator, "platform", {
        configurable: true,
        value: platform
    })
    Object.defineProperty(navigator, "maxTouchPoints", {
        configurable: true,
        value: maxTouchPoints
    })
}

const flushAsyncWork = async () => {
    await Promise.resolve()
    await Promise.resolve()
    await Promise.resolve()
}

describe("useVoiceRecorder", () => {
    beforeEach(() => {
        FakeMediaRecorder.instances = []
        FakeMediaRecorder.mode = "success"
        FakeMediaRecorder.supportedType = "audio/webm"

        browserEnvMock.mockReset()
        resolveJwtTokenMock.mockReset()
        toastErrorMock.mockReset()
        useTokenMock.mockReset()
        vi.spyOn(console, "error").mockImplementation(() => {})
        vi.spyOn(console, "log").mockImplementation(() => {})
        vi.spyOn(console, "warn").mockImplementation(() => {})
        vi.useFakeTimers()

        browserEnvMock.mockReturnValue("https://convex.example")
        resolveJwtTokenMock.mockResolvedValue("jwt-1")
        useTokenMock.mockReturnValue({ token: "token-1" })
        setNavigatorIdentity({})
    })

    it("surfaces permission errors from getUserMedia", async () => {
        const permissionError = new Error("denied")
        permissionError.name = "NotAllowedError"
        installRecorderEnvironment({
            getUserMediaImpl: () => Promise.reject(permissionError)
        })

        const { result } = renderHook(() =>
            useVoiceRecorder({
                onTranscript: vi.fn()
            })
        )

        await act(async () => {
            await result.current.startRecording()
        })

        expect(result.current.state.isRecording).toBe(false)
        expect(toastErrorMock).toHaveBeenCalledWith(
            "Microphone permission denied. Please allow microphone access and try again."
        )
    })

    it("records, transcribes, and resets state after a successful stop", async () => {
        const { mediaTrack } = installRecorderEnvironment()
        const onTranscript = vi.fn()
        const fetchMock = vi.fn().mockResolvedValue({
            ok: true,
            json: async () => ({ text: "  transcribed text  " })
        })
        vi.stubGlobal("fetch", fetchMock)

        const { result } = renderHook(() =>
            useVoiceRecorder({
                onTranscript
            })
        )

        await act(async () => {
            await result.current.startRecording()
        })

        expect(result.current.state.isRecording).toBe(true)
        expect(FakeMediaRecorder.instances[0].options.mimeType).toBe("audio/webm")

        act(() => {
            vi.advanceTimersByTime(1_000)
        })

        expect(result.current.state.recordingDuration).toBe(1)

        act(() => {
            result.current.stopRecording()
        })

        await act(async () => {
            await flushAsyncWork()
        })

        expect(onTranscript).toHaveBeenCalledWith("transcribed text")
        expect(fetchMock).toHaveBeenCalledWith("https://convex.example/transcribe", {
            method: "POST",
            headers: {
                Authorization: "Bearer jwt-1"
            },
            body: expect.any(FormData)
        })
        expect(result.current.state.isRecording).toBe(false)
        expect(result.current.state.isTranscribing).toBe(false)
        expect(result.current.state.recordingDuration).toBe(0)
        expect(mediaTrack.stop).toHaveBeenCalledTimes(1)
    })

    it("cancels recording without attempting transcription", async () => {
        installRecorderEnvironment()
        const fetchMock = vi.fn()
        vi.stubGlobal("fetch", fetchMock)

        const { result } = renderHook(() =>
            useVoiceRecorder({
                onTranscript: vi.fn()
            })
        )

        await act(async () => {
            await result.current.startRecording()
        })

        act(() => {
            result.current.cancelRecording()
        })

        await act(async () => {
            await flushAsyncWork()
        })

        expect(result.current.state.isRecording).toBe(false)
        expect(result.current.state.isTranscribing).toBe(false)
        expect(fetchMock).not.toHaveBeenCalled()
    })

    it("surfaces transcription failures from the backend", async () => {
        installRecorderEnvironment()
        vi.stubGlobal(
            "fetch",
            vi.fn().mockResolvedValue({
                ok: false,
                json: async () => ({ error: "Audio too large" })
            })
        )

        const { result } = renderHook(() =>
            useVoiceRecorder({
                onTranscript: vi.fn()
            })
        )

        await act(async () => {
            await result.current.startRecording()
        })

        act(() => {
            result.current.stopRecording()
        })

        await act(async () => {
            await flushAsyncWork()
        })
        expect(toastErrorMock).toHaveBeenCalledWith("Audio too large")
        expect(result.current.state.isTranscribing).toBe(false)
    })

    it("shows the iOS Safari compatibility message when no supported recording format is available", async () => {
        setNavigatorIdentity({
            userAgent:
                "Mozilla/5.0 (iPhone; CPU iPhone OS 17_4 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.4 Mobile/15E148 Safari/604.1",
            platform: "iPhone",
            maxTouchPoints: 5
        })
        FakeMediaRecorder.supportedType = "audio/unsupported"
        installRecorderEnvironment()

        const { result } = renderHook(() =>
            useVoiceRecorder({
                onTranscript: vi.fn()
            })
        )

        await act(async () => {
            await result.current.startRecording()
        })

        expect(result.current.state.isRecording).toBe(false)
        expect(toastErrorMock).toHaveBeenCalledWith(
            "Audio recording is not available on this version of iOS Safari. Please update to iOS 14.3 or later."
        )
    })

    it("normalizes iOS Safari mp4 recordings to wav before upload", async () => {
        setNavigatorIdentity({
            userAgent:
                "Mozilla/5.0 (iPhone; CPU iPhone OS 17_4 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.4 Mobile/15E148 Safari/604.1",
            platform: "iPhone",
            maxTouchPoints: 5
        })
        FakeMediaRecorder.supportedType = "audio/mp4"

        installRecorderEnvironment()
        const onTranscript = vi.fn()
        const fetchMock = vi.fn().mockResolvedValue({
            ok: true,
            json: async () => ({ text: "normalized transcript" })
        })
        vi.stubGlobal("fetch", fetchMock)

        const { result } = renderHook(() =>
            useVoiceRecorder({
                onTranscript
            })
        )

        await act(async () => {
            await result.current.startRecording()
        })

        expect(FakeMediaRecorder.instances[0].options.mimeType).toBe("audio/mp4")
        expect(FakeMediaRecorder.instances[0].options.audioBitsPerSecond).toBe(128000)

        act(() => {
            result.current.stopRecording()
        })

        await act(async () => {
            await flushAsyncWork()
        })

        const formData = fetchMock.mock.calls[0]?.[1]?.body as FormData
        const audioFile = formData.get("audio") as Blob & { name?: string }

        expect(audioFile.type).toBe("audio/wav")
        expect(audioFile.name).toBe("audio.wav")
        expect(onTranscript).toHaveBeenCalledWith("normalized transcript")
    })
})
