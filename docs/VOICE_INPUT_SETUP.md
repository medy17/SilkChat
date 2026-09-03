# Voice Input Setup

SilkChat voice input records microphone audio in the browser, sends the completed recording to Convex, and transcribes it through OpenRouter. Only the returned text is inserted into the composer; the audio is not stored as a chat attachment.

## Configuration

Enable the browser control in the app or Vercel environment:

```bash
VITE_ENABLE_VOICE_INPUT=true
```

The microphone control is hidden unless this value is exactly `true`.

Configure an OpenRouter key in Convex:

```bash
bunx convex env set OPENROUTER_API_KEY your-openrouter-api-key
```

Voice input uses the shared `mai-transcribe-2` model entry and its `openrouter:microsoft/mai-transcribe-2` adapter through OpenRouter's dedicated `/api/v1/audio/transcriptions` endpoint. A user's enabled OpenRouter BYOK key takes precedence over the internal key. The same model entry declares the preferred and accepted transcription formats used by both browser normalization and backend validation.

## User Flow

1. Open a chat with an empty composer.
2. Select the microphone button.
3. Speak, then select stop.
4. The completed recording is uploaded for transcription.
5. The returned text is inserted into the composer for review before sending.

## Browser and Audio Support

- Microphone access requires user permission.
- HTTPS is required outside localhost, especially on iOS Safari.
- Recording requires the MediaRecorder and Web Audio APIs.
- The recorder prefers Ogg/Opus, then WebM/Opus, WebM, MP4, M4A, AAC, or the browser default.
- Ogg, WAV, MP3, and FLAC pass through unchanged. WebM and M4A recordings are normalized once in the browser to mono 16 kHz PCM WAV because MAI-Transcribe 2's current Azure endpoint rejects those containers.
- Each upload is limited to 25 MB.
- Each recording requests a fresh microphone stream and releases it after transcription.

OpenRouter documents WAV, MP3, FLAC, M4A, Ogg, WebM, and AAC as common transcription formats. Exact support can vary by the upstream provider behind a model.

## Batch and Live Transcription

The current integration is batch transcription. MediaRecorder emits local chunks while recording, but they remain in browser memory until stop; Convex then forwards one complete multipart audio file to OpenRouter and returns one JSON response.

OpenRouter's dedicated speech-to-text API does not currently document a realtime WebSocket protocol, incremental audio input, or streamed transcript deltas. Sending short recordings repeatedly could approximate live captions, but it would require overlap, ordering, retry, and transcript-deduplication logic and would not be true streaming.

## Troubleshooting

- **No microphone button:** Confirm `VITE_ENABLE_VOICE_INPUT=true` in the frontend environment.
- **Unauthorized:** The user must be signed in and the browser must be able to resolve a current JWT.
- **Service not configured:** Configure `OPENROUTER_API_KEY` in Convex or enable a user OpenRouter key in Settings → Providers.
- **No speech detected:** Check microphone permissions and input level, then record again.
- **Timeouts on long recordings:** Split the recording. OpenRouter warns that upstream transcription providers can time out after roughly 60 seconds of processing.
- **iOS Safari:** Use a current Safari version over HTTPS and open the site directly rather than from an older home-screen PWA context.

## Implementation

- `src/hooks/use-voice-recorder.ts`: microphone capture, visualization, and upload
- `src/components/voice-recorder.tsx`: recording and transcription status UI
- `src/components/multimodal-input.tsx`: composer integration
- `convex/http.ts`: authenticated CORS route registration
- `convex/speech_to_text.ts`: validation, OpenRouter credential resolution, and transcription
