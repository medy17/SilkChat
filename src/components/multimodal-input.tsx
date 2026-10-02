import { submitComposerDraft, retainComposerSession } from "@/lib/composer-session"
import type { SubmissionResult } from "@/lib/chat-submission"
import { useStore } from "zustand"
import {
    getComposerSession,
    setComposerText,
    cancelAttachmentJob,
    type AttachmentJob
} from "@/lib/composer-session"
import { prepareComposerMessage } from "@/lib/composer-message"
import { useComposerPaste } from "@/hooks/use-composer-paste"
import { readComposerClipboard } from "@/lib/composer-pasted-text"
import { useComposerAttachments } from "@/hooks/use-composer-attachments"
import { useComposerDropTarget } from "@/hooks/use-composer-drop-target"
import {
    ComposerDesktopActions,
    ComposerMobileMenu,
    useComposerToolbarState,
    type ComposerOverlay
} from "./composer/toolbar"
import { DraftAttachmentTile } from "./composer/draft-attachment-tile"
import { UploadingAttachmentTile } from "./composer/uploading-attachment-tile"
import {
    AttachmentPreviewDialog,
    type AttachmentPreview
} from "./composer/attachment-preview-dialog"
import { IntentGuide } from "@/components/intent-guide"
import { ModelSelector } from "@/components/model-selector"
import { PersonaSelector } from "@/components/persona-selector"
import {
    PromptInput,
    PromptInputAction,
    PromptInputActions,
    type PromptInputRef,
    PromptInputTextarea
} from "@/components/prompt-kit/prompt-input"
import { Button } from "@/components/ui/button"
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip"
import { VoiceRecorder } from "@/components/voice-recorder"
import { api } from "@/convex/_generated/api"
import type { Doc } from "@/convex/_generated/dataModel"
import { useSession } from "@/hooks/auth-hooks"
import { useIsTouchDevice } from "@/hooks/use-touch-device"
import { useVoiceRecorder } from "@/hooks/use-voice-recorder"
import { hasPdfAttachmentInUploadedFiles } from "@/lib/attachment-support"
import { optionalBrowserEnv } from "@/lib/browser-env"
import type { UploadedFile } from "@/lib/chat-store"
import { getChatWidthClass, useChatWidthStore } from "@/lib/chat-width-store"
import {
    COMPOSER_INTENT_PREFIXES,
    type ComposerIntentId,
    resolveIntentGuideStage
} from "@/lib/composer-intents"
import { isComposerPasteTarget } from "@/lib/composer-paste"
import { estimateTokenCount, getFileAcceptAttribute, getFileTypeInfo } from "@/lib/file_constants"
import { getGeneratedImageDirectUrl } from "@/lib/generated-image-urls"
import {
    type WebTrendSuggestion,
    fetchWebTrendSuggestions,
    resolveGoogleTrendsGeo
} from "@/lib/google-trends"
import { useModelStore } from "@/lib/model-store"
import { resolveMultimodalSubmitAction } from "@/lib/multimodal-submit-action"
import { getEnabledToolsForPastedText, mergePastedTextIntoDraft } from "@/lib/pasted-text"
import { hasPendingImageGeneration } from "@/lib/pending-image-generation"
import { appendQuotedSelection } from "@/lib/quote-selection"
import { captureBrowserEvent } from "@/lib/telemetry/browser"
import { TELEMETRY_EVENTS, getErrorType } from "@/lib/telemetry/events"
import { getThreadDraftKey } from "@/lib/thread-drafts"
import type { AbilityId } from "@/lib/tool-abilities"
import { cn } from "@/lib/utils"
import { predictComposerContextRouting, resolveByokContextHint } from "@/lib/composer-context"
import type { useChat } from "@ai-sdk/react"
import type { UIMessage } from "ai"
import { useAction, useConvexAuth, usePaginatedQuery, useQuery } from "convex/react"
import { ArrowUp, Loader2, Mic, OctagonX, Paperclip, Square, X } from "lucide-react"
import { AnimatePresence, motion } from "motion/react"
import {
    forwardRef,
    useCallback,
    useEffect,
    useImperativeHandle,
    useMemo,
    useRef,
    useState
} from "react"
import { toast } from "sonner"

const getAttachmentTelemetryCategory = (file: Pick<File, "name" | "type">) => {
    const info = getFileTypeInfo(file.name, file.type)
    if (info.isImage) return "image" as const
    if (info.isPdf) return "pdf" as const
    if (info.isDocument) return "document" as const
    if (info.isCode) return "code" as const
    if (info.isText) return "text" as const
    return "other" as const
}

const getAttachmentSizeBucket = (size: number) => {
    if (size < 100 * 1024) return "under_100_kb" as const
    if (size < 1024 * 1024) return "100_kb_to_1_mb" as const
    if (size < 5 * 1024 * 1024) return "1_mb_to_5_mb" as const
    return "over_5_mb" as const
}

export interface MultimodalInputRef {
    handleFileUpload: (files: File[]) => Promise<void>
    setValue: (value: string) => void
    insertQuote: (selection: string) => void
}

export const MultimodalInput = forwardRef<
    MultimodalInputRef,
    {
        onSubmit: (input?: string, files?: UploadedFile[]) => Promise<SubmissionResult>
        status: ReturnType<typeof useChat>["status"]
        threadId?: string
        folderId?: string
        isActive?: boolean
        showIntentShortcuts?: boolean
        threadHasPdfAttachments?: boolean
        messages?: UIMessage[]
        onInputActivityChange?: (isActive: boolean) => void
    }
>(function MultimodalInput(
    {
        onSubmit,
        status,
        threadId,
        folderId,
        isActive = true,
        showIntentShortcuts = false,
        threadHasPdfAttachments = false,
        messages = [],
        onInputActivityChange
    },
    ref
) {
    const session = useSession()
    const auth = useConvexAuth()
    const killPersistentSandbox = useAction(api.persistent_sandboxes_node.killMyPersistentSandbox)
    const activePersistentSandbox = useQuery(
        api.persistent_sandboxes.getMyActivePersistentSandbox,
        session.user?.id && !auth.isLoading ? {} : "skip"
    )
    const isTouchDevice = useIsTouchDevice()
    const composerToolbar = useComposerToolbarState()
    const {
        userSettings,
        selectedSharedModel,
        modelSupportsFunctionCalling,
        modelSupportsVision,
        modelSupportsNativePdf,
        codeExecutionAvailable,
        isImageModel,
        invertSendNewlineBehavior
    } = composerToolbar

    const { selectedModel, setSelectedModel, enabledTools, setEnabledTools } = useModelStore()
    const { chatWidthState } = useChatWidthStore()

    const isLoading = status === "streaming"
    const isImageGenerationPending = useMemo(() => hasPendingImageGeneration(messages), [messages])
    // One-shot escape hatch: "Send anyway" on the gate toast arms this for a single
    // submit so a generation stuck in a non-terminal status can never lock the thread.
    const imageGenerationGateBypassRef = useRef(false)
    const uploadInputRef = useRef<HTMLInputElement>(null)
    const promptInputRef = useRef<PromptInputRef>(null)
    const composerViewportRef = useRef<HTMLDivElement>(null)

    const draftScope = useMemo(() => ({ threadId, folderId }), [folderId, threadId])
    const draftKey = getThreadDraftKey(draftScope)

    const draftSession = useMemo(
        () => getComposerSession(draftScope, session.user?.id ?? "anonymous"),
        [draftScope, session.user?.id]
    )
    const draftState = useStore(draftSession)
    useEffect(() => {
        if (!draftState.submitting && !draftSession.getState().disposed)
            promptInputRef.current?.resize()
    }, [draftSession, draftState.submitting])
    const activeSessionRef = useRef(draftSession)
    activeSessionRef.current = draftSession
    const activeRef = useRef(isActive)
    activeRef.current = isActive
    useEffect(() => {
        activeRef.current = isActive
        return () => {
            activeRef.current = false
        }
    }, [isActive])
    const {
        text: inputValue,
        attachments: uploadedFiles,
        contents: fileContents,
        tokenCounts: fileTokenCounts,
        imageDimensions: fileImageDimensions,
        jobs: localUploadingFiles
    } = draftState
    const setInputValue = useCallback(
        (text: string) => setComposerText(draftSession, text),
        [draftSession]
    )
    const uploading =
        draftState.submitting ||
        draftState.acquiring > 0 ||
        localUploadingFiles.some((file) => file.status !== "error")
    const attachmentsBusy = uploading
    const extendedFiles = uploadedFiles
    const queue = useComposerAttachments(draftSession, {
        mode: "compose",
        support: { supportsVision: modelSupportsVision, supportsNativePdf: modelSupportsNativePdf },
        canReferenceLongTextAttachments: modelSupportsFunctionCalling && codeExecutionAvailable,
        enableTools: (decision) => {
            if (decision.disposition === "url")
                draftSession.setState({ requiredTools: ["code_execution"] })
        },
        onProcessed: (file, startedAt, stage, error) => {
            const details = {
                category: getAttachmentTelemetryCategory(file),
                size_bucket: getAttachmentSizeBucket(file.size),
                duration_ms: Date.now() - startedAt
            }
            if (error)
                captureBrowserEvent(TELEMETRY_EVENTS.attachmentProcessingFailed, {
                    ...details,
                    stage: stage === "inline_ingest" ? "conversion" : stage,
                    error_type: stage === "validation" ? "validation" : getErrorType(error)
                })
            else if (stage === "inline_ingest" || stage === "upload")
                captureBrowserEvent(TELEMETRY_EVENTS.attachmentProcessingCompleted, {
                    ...details,
                    stage
                })
        }
    })
    useEffect(() => {
        if (!isActive || !draftState.requiredTools.length) return
        const state = useModelStore.getState()
        if (state.toolThreadId !== (threadId ?? null)) return
        if (
            !state.enabledTools.includes("code_execution") &&
            draftState.requiredTools.includes("code_execution")
        )
            toast.info("Code execution enabled for this document")
        state.setConversationTools([
            ...new Set([...state.enabledTools, ...draftState.requiredTools])
        ])
        draftSession.setState({ requiredTools: [] })
    }, [draftState.requiredTools, draftSession, isActive, threadId])
    useEffect(() => retainComposerSession(draftSession), [draftSession])
    const uploadPolicy = queue.policy
    const handleFileUpload = useCallback(
        (files: File[]) => queue.add(files.map((file) => ({ file }))),
        [queue.add]
    )
    const activateDropTarget = useComposerDropTarget(
        draftKey,
        "compose",
        handleFileUpload,
        isActive
    )
    const [dialogFile, setDialogFile] = useState<AttachmentPreview | null>(null)
    const [dialogOpen, setDialogOpen] = useState(false)
    const [isKillingPersistentSandbox, setIsKillingPersistentSandbox] = useState(false)

    const handleKillPersistentSandbox = async () => {
        if (!activePersistentSandbox) return
        setIsKillingPersistentSandbox(true)
        try {
            await killPersistentSandbox({ sandboxId: activePersistentSandbox._id })
            toast.success("Persistent sandbox killed")
        } catch (error) {
            toast.error(
                error instanceof Error ? error.message : "Failed to kill persistent sandbox"
            )
        } finally {
            setIsKillingPersistentSandbox(false)
        }
    }

    const {
        state: voiceState,
        startRecording,
        stopRecording
    } = useVoiceRecorder({
        onTranscript: (text: string) => {
            if (promptInputRef.current) {
                const currentValue = promptInputRef.current.getValue()
                const newValue = currentValue ? `${currentValue} ${text}` : text
                promptInputRef.current.setValue(newValue)
                promptInputRef.current.focus()
                setInputValue(newValue)
            }
        }
    })

    const requiresNativePdfForModelSelection = useMemo(
        () => threadHasPdfAttachments || hasPdfAttachmentInUploadedFiles(uploadedFiles),
        [threadHasPdfAttachments, uploadedFiles]
    )

    const handleSubmit = async () => {
        if (!activeRef.current || activeSessionRef.current !== draftSession) return
        const inputValue = promptInputRef.current?.getValue() || ""
        const submitAction = resolveMultimodalSubmitAction(status, inputValue, uploadedFiles.length)

        if (submitAction === "stop") {
            onSubmit()
            return
        }

        if (submitAction === "focus") {
            promptInputRef.current?.focus()
            return
        }

        if (attachmentsBusy || draftSession.getState().submitting) return

        if (isImageGenerationPending && !imageGenerationGateBypassRef.current) {
            toast.warning("An image is still generating in this chat.", {
                action: {
                    label: "Send anyway",
                    onClick: () => {
                        imageGenerationGateBypassRef.current = true
                        void handleSubmit()
                    }
                }
            })
            return
        }
        imageGenerationGateBypassRef.current = false

        const prepared = prepareComposerMessage({
            text: inputValue,
            attachments: uploadedFiles,
            support: {
                supportsVision: modelSupportsVision,
                supportsNativePdf: modelSupportsNativePdf
            },
            policy: uploadPolicy
        })
        if (prepared.text === null) return
        if (prepared.errors.length) {
            toast.error(prepared.errors.join("\n"))
            return
        }

        if (isTouchDevice) {
            promptInputRef.current?.getElement()?.blur()
            setIsInputFocused(false)
        }

        captureBrowserEvent(TELEMETRY_EVENTS.composerSubmitted, {
            model_id: selectedModel,
            thread_id: threadId ?? null,
            attachment_count: uploadedFiles.length,
            prompt_character_count: inputValue.trim().length,
            prompt_estimated_tokens: estimateTokenCount(inputValue.trim()),
            enabled_tool_count: enabledTools.length,
            enabled_tool_ids: enabledTools,
            existing_message_count: messages.length,
            is_new_thread: !threadId,
            intent: activeIntent
        })
        const outcome = await submitComposerDraft(
            draftSession,
            { text: inputValue, attachments: uploadedFiles },
            session.user?.id ?? "anonymous",
            (text, files) => {
                promptInputRef.current?.clear()
                return onSubmit(text, files)
            }
        )
        if (outcome.accepted) setActiveIntent(null)
    }

    const [isInputFocused, setIsInputFocused] = useState(false)
    const [activeComposerOverlay, setActiveComposerOverlay] = useState<ComposerOverlay | null>(null)
    const handleComposerOverlayOpenChange = useCallback(
        (overlay: ComposerOverlay, open: boolean) => {
            setActiveComposerOverlay((currentOverlay) => {
                if (open) return overlay
                return currentOverlay === overlay ? null : currentOverlay
            })
        },
        []
    )
    const isModelSelectorOpen = activeComposerOverlay === "model"
    const [activeIntent, setActiveIntent] = useState<ComposerIntentId | null>(null)
    const [attachingImageKey, setAttachingImageKey] = useState<string>()
    const [webTrends, setWebTrends] = useState<WebTrendSuggestion[]>([])
    const [webTrendsLoading, setWebTrendsLoading] = useState(false)
    const [webTrendsLoaded, setWebTrendsLoaded] = useState(false)
    const [isClient, setIsClient] = useState(false)
    const isInputEmpty = !inputValue.trim()
    const activeComposerKey = isActive ? draftKey : null

    useEffect(() => {
        if (!isClient || !activeComposerKey || isTouchDevice) return

        promptInputRef.current?.focus()
    }, [activeComposerKey, isClient, isTouchDevice])

    const intentGuideStage = resolveIntentGuideStage({
        activeIntent,
        draft: inputValue,
        attachmentCount: uploadedFiles.length
    })
    const recentGeneratedImages = usePaginatedQuery(
        api.images.paginateGeneratedImages,
        showIntentShortcuts && activeIntent === "image" && session.user?.id
            ? { sortBy: "newest", view: "active" }
            : "skip",
        { initialNumItems: 6 }
    )
    const voiceInputEnabled = optionalBrowserEnv("VITE_ENABLE_VOICE_INPUT") === "true"
    const predictedByokContextRouting = useMemo(
        () =>
            predictComposerContextRouting({
                model: selectedSharedModel,
                modelId: selectedModel,
                text: inputValue,
                attachments: uploadedFiles,
                tokenCounts: fileTokenCounts,
                imageDimensions: fileImageDimensions,
                messages,
                openRouterByokEnabled:
                    "openrouter" in userSettings.coreAIProviders &&
                    userSettings.coreAIProviders.openrouter?.enabled === true
            }),
        [
            selectedSharedModel,
            selectedModel,
            inputValue,
            uploadedFiles,
            fileTokenCounts,
            fileImageDimensions,
            messages,
            userSettings
        ]
    )

    // biome-ignore lint/correctness/useExhaustiveDependencies: Intent selection belongs to the active draft session.
    useEffect(() => {
        setActiveIntent(null)
    }, [draftSession])

    useEffect(() => {
        onInputActivityChange?.(isInputFocused && !isInputEmpty)
    }, [isInputEmpty, isInputFocused, onInputActivityChange])

    useEffect(
        () => () => {
            onInputActivityChange?.(false)
        },
        [onInputActivityChange]
    )

    const handleVoiceButtonClick = () => {
        if (voiceState.isRecording) {
            stopRecording()
        } else if (!voiceInputEnabled) {
            handleSubmit()
        } else if (isInputEmpty && uploadedFiles.length === 0 && !isLoading) {
            startRecording()
        } else {
            handleSubmit()
        }
    }

    useImperativeHandle(
        ref,
        () => ({
            handleFileUpload,
            setValue: (value: string) => {
                promptInputRef.current?.setValue(value)
                setInputValue(value)
            },
            insertQuote: (selection: string) => {
                const currentValue = promptInputRef.current?.getValue() || ""
                const nextValue = appendQuotedSelection(currentValue, selection)

                if (nextValue === currentValue) {
                    return
                }

                promptInputRef.current?.setValue(nextValue)
                promptInputRef.current?.focus()
                setInputValue(nextValue)
            }
        }),
        [handleFileUpload, setInputValue]
    )

    const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
        if (event.target.files) {
            const newFiles = Array.from(event.target.files)
            void handleFileUpload(newFiles)
            event.target.value = ""
        }
    }

    const handleRemoveFile = queue.remove
    const handleRemoveUploadingFile = (file: AttachmentJob) =>
        cancelAttachmentJob(draftSession, file.id)
    const pastedText = useComposerPaste(draftSession, {
        mode: "compose",
        queue,
        addFiles: handleFileUpload,
        canReferenceLongTextAttachments: modelSupportsFunctionCalling && codeExecutionAvailable,
        enableTools: (decision) => {
            const state = useModelStore.getState()
            const tools = getEnabledToolsForPastedText(decision, state.enabledTools)
            if (tools !== state.enabledTools) {
                state.setConversationTools(tools)
                toast.info("Code execution enabled for this long paste")
            }
        },
        appendText: (text) => {
            const value = mergePastedTextIntoDraft(draftSession.getState().text, text)
            setComposerText(draftSession, value)
            if (activeRef.current && activeSessionRef.current === draftSession) {
                promptInputRef.current?.setValue(value)
                promptInputRef.current?.focus()
            }
        }
    })
    const handlePaste = useCallback(
        (event: ClipboardEvent) => {
            if (pastedText.paste(readComposerClipboard(event.clipboardData))) event.preventDefault()
        },
        [pastedText.paste]
    )

    const isNewChatComposer = !threadId && messages.length === 0
    const isCompactTouchComposer =
        isTouchDevice &&
        !isNewChatComposer &&
        !isInputFocused &&
        !isModelSelectorOpen &&
        !inputValue.trim() &&
        uploadedFiles.length === 0 &&
        localUploadingFiles.length === 0

    const loadWebTrends = useCallback(async () => {
        if (webTrendsLoaded || webTrendsLoading) return
        setWebTrendsLoading(true)

        try {
            const geo = resolveGoogleTrendsGeo(navigator.languages)
            const trends = await fetchWebTrendSuggestions(geo)
            setWebTrends(trends)
        } catch (error) {
            console.warn("[search-trends] Could not load live suggestions", error)
        } finally {
            setWebTrendsLoaded(true)
            setWebTrendsLoading(false)
        }
    }, [webTrendsLoaded, webTrendsLoading])

    const prepareIntent = useCallback(
        (intent: ComposerIntentId) => {
            const tool: AbilityId | undefined =
                intent === "web"
                    ? "web_search"
                    : intent === "analysis"
                      ? "code_execution"
                      : undefined
            if (tool && !enabledTools.includes(tool)) {
                setEnabledTools([...enabledTools, tool])
            }

            if (!promptInputRef.current?.getValue().trim()) {
                const prompt = COMPOSER_INTENT_PREFIXES[intent]
                promptInputRef.current?.setValue(prompt)
                setInputValue(prompt)
            }
            setActiveIntent(intent)
            if (intent === "web") void loadWebTrends()
            promptInputRef.current?.focus()
        },
        [enabledTools, loadWebTrends, setEnabledTools, setInputValue]
    )

    const clearIntent = useCallback(() => {
        if (activeIntent) {
            const value = promptInputRef.current?.getValue() ?? ""
            if (value.trim() === COMPOSER_INTENT_PREFIXES[activeIntent].trim()) {
                promptInputRef.current?.setValue("")
                setInputValue("")
            }
        }
        setActiveIntent(null)
    }, [activeIntent, setInputValue])

    const chooseIntentPrompt = useCallback(
        (prompt: string) => {
            promptInputRef.current?.setValue(prompt)
            setInputValue(prompt)
            promptInputRef.current?.focus()
        },
        [setInputValue]
    )

    const appendIntentPrompt = useCallback(
        (text: string) => {
            const currentValue = promptInputRef.current?.getValue() ?? ""
            const nextValue = `${currentValue.trimEnd()}${text}`
            promptInputRef.current?.setValue(nextValue)
            setInputValue(nextValue)
            promptInputRef.current?.focus()
        },
        [setInputValue]
    )

    const attachRecentGeneratedImage = useCallback(
        async (
            image: Pick<Doc<"generatedImages">, "_id" | "storageKey" | "prompt" | "aspectRatio">
        ) => {
            if (attachingImageKey) return
            setAttachingImageKey(image.storageKey)
            draftSession.setState((state) => ({ acquiring: state.acquiring + 1 }))

            try {
                const response = await fetch(getGeneratedImageDirectUrl(image.storageKey))
                if (!response.ok) throw new Error("Could not load that image")

                const blob = await response.blob()
                const mimeType = blob.type || "image/png"
                const extension =
                    mimeType === "image/jpeg" ? "jpg" : mimeType.split("/")[1] || "png"
                const file = new File([blob], `silkscreen-reference-${Date.now()}.${extension}`, {
                    type: mimeType,
                    lastModified: Date.now()
                })

                await handleFileUpload([file])
                promptInputRef.current?.focus()
            } catch (error) {
                console.error("Failed to attach recent generated image:", error)
                toast.error(error instanceof Error ? error.message : "Failed to attach image")
            } finally {
                setAttachingImageKey(undefined)
                draftSession.setState((state) => ({ acquiring: Math.max(0, state.acquiring - 1) }))
            }
        },
        [attachingImageKey, handleFileUpload, draftSession]
    )

    const handleIntentUpload = useCallback(() => {
        if (!activeIntent) {
            prepareIntent("analysis")
        }
        uploadInputRef.current?.click()
    }, [activeIntent, prepareIntent])

    useEffect(() => {
        setIsClient(true)
    }, [])

    useEffect(() => {
        if (!isActive) {
            return
        }

        const handleGlobalPaste = (e: ClipboardEvent) => {
            if (
                !isComposerPasteTarget(
                    document.activeElement,
                    promptInputRef.current?.getElement() ?? null
                )
            ) {
                return
            }
            handlePaste(e)
        }

        document.addEventListener("paste", handleGlobalPaste)
        return () => document.removeEventListener("paste", handleGlobalPaste)
    }, [handlePaste, isActive])

    if (!isClient) return null

    return (
        <>
            {voiceInputEnabled && (voiceState.isRecording || voiceState.isTranscribing) && (
                <div className="@container w-full px-1">
                    <VoiceRecorder
                        state={voiceState}
                        onStop={stopRecording}
                        className={cn(
                            "pointer-events-auto mx-auto w-full",
                            getChatWidthClass(chatWidthState.chatWidth)
                        )}
                    />
                </div>
            )}

            <div
                ref={composerViewportRef}
                onFocusCapture={activateDropTarget}
                onPointerDownCapture={activateDropTarget}
                onBlurCapture={(event) => {
                    const nextTarget =
                        event.relatedTarget instanceof Element ? event.relatedTarget : null

                    if (
                        (nextTarget && event.currentTarget.contains(nextTarget)) ||
                        nextTarget?.closest(
                            '[data-radix-popper-content-wrapper], [data-slot="drawer-content"], [data-slot="dialog-content"]'
                        )
                    ) {
                        return
                    }

                    setIsInputFocused(false)
                }}
                className={cn(
                    "@container w-full px-1",
                    (voiceState.isRecording || voiceState.isTranscribing) && "hidden"
                )}
            >
                <PromptInput
                    ref={promptInputRef}
                    onSubmit={handleSubmit}
                    disableKeyboardSubmit={isTouchDevice}
                    invertSendNewlineBehavior={invertSendNewlineBehavior}
                    maxHeight={240}
                    className={cn(
                        "pointer-events-auto mx-auto w-full transition-[padding] duration-300 ease-[cubic-bezier(0.16,1,0.3,1)]",
                        isCompactTouchComposer && "p-2",
                        isNewChatComposer && "rounded-[var(--radius-lg)]",
                        getChatWidthClass(chatWidthState.chatWidth)
                    )}
                >
                    {(extendedFiles.length > 0 || localUploadingFiles.length > 0) && (
                        <div className="flex flex-wrap gap-2 pb-3">
                            {extendedFiles.map((file) => (
                                <DraftAttachmentTile
                                    key={file.key}
                                    file={file}
                                    content={fileContents[file.key]}
                                    onPreview={(preview) => {
                                        setDialogFile(preview)
                                        setDialogOpen(true)
                                    }}
                                    onRemove={() => void handleRemoveFile(file.key)}
                                    onShowText={() => void pastedText.showUploadedText(file)}
                                />
                            ))}
                            {localUploadingFiles.map((job) => (
                                <UploadingAttachmentTile
                                    key={job.id}
                                    job={job}
                                    onCancel={() => handleRemoveUploadingFile(job)}
                                    onShowText={() => pastedText.showUploadingText(job.id)}
                                />
                            ))}
                        </div>
                    )}

                    <input
                        type="file"
                        multiple
                        onChange={handleFileChange}
                        className="hidden"
                        ref={uploadInputRef}
                        accept={getFileAcceptAttribute(modelSupportsVision)}
                    />

                    <motion.div
                        layout
                        transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
                        className={cn("flex w-full items-start", isCompactTouchComposer && "gap-1")}
                    >
                        <AnimatePresence initial={false}>
                            {isCompactTouchComposer && !isImageModel && (
                                <motion.div
                                    key="compact-attach"
                                    initial={{ opacity: 0, scale: 0.9, width: 0 }}
                                    animate={{ opacity: 1, scale: 1, width: 44 }}
                                    exit={{ opacity: 0, scale: 0.94, width: 0 }}
                                    transition={{
                                        duration: 0.18,
                                        ease: [0.16, 1, 0.3, 1]
                                    }}
                                    className="shrink-0 overflow-hidden"
                                >
                                    <Button
                                        type="button"
                                        variant="ghost"
                                        size="icon"
                                        aria-label="Attach files"
                                        onClick={() => uploadInputRef.current?.click()}
                                        disabled={uploading}
                                        className="size-11 bg-secondary/70 text-foreground backdrop-blur-lg hover:bg-secondary/80"
                                        style={{ borderRadius: "var(--radius-md)" }}
                                    >
                                        {uploading ? (
                                            <Loader2 className="size-4 animate-spin" />
                                        ) : (
                                            <Paperclip className="size-4 -rotate-45" />
                                        )}
                                    </Button>
                                </motion.div>
                            )}
                        </AnimatePresence>

                        <motion.div
                            layout
                            transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
                            className="min-w-0 flex-1"
                        >
                            <PromptInputTextarea
                                value={inputValue}
                                placeholder={
                                    isImageModel
                                        ? "Describe the image you want to generate..."
                                        : "Ask me anything..."
                                }
                                onChange={(event) => setInputValue(event.currentTarget.value)}
                                onFocus={() => setIsInputFocused(true)}
                                className={cn(
                                    isCompactTouchComposer &&
                                        "!h-11 !min-h-11 overflow-hidden whitespace-nowrap"
                                )}
                            />
                        </motion.div>

                        <AnimatePresence initial={false} mode="popLayout">
                            {isCompactTouchComposer && (
                                <motion.div
                                    key="compact-submit"
                                    layout
                                    transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
                                    className="shrink-0"
                                >
                                    <motion.div
                                        layoutId="composer-primary-action"
                                        transition={{
                                            layout: {
                                                duration: 0.3,
                                                ease: [0.16, 1, 0.3, 1]
                                            }
                                        }}
                                    >
                                        <Button
                                            variant="default"
                                            size="icon"
                                            aria-label={
                                                isImageGenerationPending && !isLoading
                                                    ? "Wait for image generation to finish"
                                                    : voiceInputEnabled &&
                                                        isInputEmpty &&
                                                        !isLoading
                                                      ? "Voice input"
                                                      : isLoading
                                                        ? "Stop generation"
                                                        : "Send message"
                                            }
                                            className="size-11"
                                            style={{ borderRadius: "var(--radius-md)" }}
                                            disabled={status === "submitted" || uploading}
                                            onClick={handleVoiceButtonClick}
                                            type="submit"
                                        >
                                            {isLoading ? (
                                                <Square className="size-5 fill-current" />
                                            ) : status === "submitted" ? (
                                                <Loader2 className="size-5 animate-spin" />
                                            ) : voiceInputEnabled &&
                                              isInputEmpty &&
                                              uploadedFiles.length === 0 ? (
                                                <Mic className="size-5" />
                                            ) : (
                                                <ArrowUp className="size-5" />
                                            )}
                                        </Button>
                                    </motion.div>
                                </motion.div>
                            )}
                        </AnimatePresence>
                    </motion.div>

                    <AnimatePresence initial={false}>
                        {!isCompactTouchComposer && (
                            <motion.div
                                key="expanded-toolbar"
                                initial={{ height: 0, opacity: 0, y: 6 }}
                                animate={{ height: "auto", opacity: 1, y: 0 }}
                                exit={{ height: 0, opacity: 0, y: 4 }}
                                transition={{
                                    duration: 0.26,
                                    ease: [0.16, 1, 0.3, 1]
                                }}
                                className="overflow-hidden"
                            >
                                <PromptInputActions className="flex items-center gap-2 pt-2">
                                    <motion.div
                                        layout
                                        transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
                                        className="flex min-w-0 flex-1 items-center @3xl:gap-2 gap-1.5 overflow-hidden @3xl:overflow-visible"
                                    >
                                        {selectedModel && (
                                            <motion.div
                                                layout
                                                transition={{
                                                    duration: 0.2,
                                                    ease: [0.16, 1, 0.3, 1]
                                                }}
                                                className="shrink-0"
                                            >
                                                <ModelSelector
                                                    selectedModel={selectedModel}
                                                    onModelChange={setSelectedModel}
                                                    open={activeComposerOverlay === "model"}
                                                    onOpenChange={(open) =>
                                                        handleComposerOverlayOpenChange(
                                                            "model",
                                                            open
                                                        )
                                                    }
                                                    shortcutTarget="composer"
                                                    telemetrySurface="composer"
                                                    tooltip="Select model"
                                                    suppressTooltip={activeComposerOverlay !== null}
                                                    requiresNativePdf={
                                                        requiresNativePdfForModelSelection
                                                    }
                                                    byokContextHint={resolveByokContextHint(
                                                        predictedByokContextRouting
                                                    )}
                                                />
                                            </motion.div>
                                        )}
                                        <PersonaSelector
                                            threadId={threadId}
                                            open={activeComposerOverlay === "persona"}
                                            onOpenChange={(open) =>
                                                handleComposerOverlayOpenChange("persona", open)
                                            }
                                        />

                                        <ComposerDesktopActions
                                            state={composerToolbar}
                                            threadId={threadId}
                                            uploading={uploading}
                                            onAttachClick={() => uploadInputRef.current?.click()}
                                            activeOverlay={activeComposerOverlay}
                                            onOverlayOpenChange={handleComposerOverlayOpenChange}
                                        />
                                    </motion.div>

                                    <ComposerMobileMenu
                                        state={composerToolbar}
                                        onAttachClick={() => uploadInputRef.current?.click()}
                                        open={activeComposerOverlay === "mobile-menu"}
                                        onOpenChange={(open) =>
                                            handleComposerOverlayOpenChange("mobile-menu", open)
                                        }
                                    />

                                    {activePersistentSandbox && (
                                        <PromptInputAction tooltip="Kill persistent sandbox">
                                            <Button
                                                variant="outline"
                                                size="sm"
                                                className="h-8 shrink-0 gap-1.5 text-destructive hover:text-destructive"
                                                style={{ borderRadius: "var(--radius-md)" }}
                                                disabled={
                                                    isKillingPersistentSandbox ||
                                                    activePersistentSandbox.status === "stopping"
                                                }
                                                onClick={() => void handleKillPersistentSandbox()}
                                                type="button"
                                            >
                                                {isKillingPersistentSandbox ||
                                                activePersistentSandbox.status === "stopping" ? (
                                                    <Loader2
                                                        className="size-4 animate-spin"
                                                        aria-hidden="true"
                                                    />
                                                ) : (
                                                    <OctagonX
                                                        className="size-4"
                                                        aria-hidden="true"
                                                    />
                                                )}
                                                <span className="@4xl:inline hidden">
                                                    Kill sandbox
                                                </span>
                                            </Button>
                                        </PromptInputAction>
                                    )}

                                    <PromptInputAction
                                        tooltip={
                                            isImageGenerationPending && !isLoading
                                                ? "Wait for image generation to finish"
                                                : voiceInputEnabled && isInputEmpty && !isLoading
                                                  ? "Voice input"
                                                  : isLoading
                                                    ? "Stop generation"
                                                    : "Send message"
                                        }
                                    >
                                        <motion.div
                                            layoutId="composer-primary-action"
                                            transition={{
                                                layout: {
                                                    duration: 0.3,
                                                    ease: [0.16, 1, 0.3, 1]
                                                }
                                            }}
                                            className="shrink-0"
                                        >
                                            <Button
                                                variant="default"
                                                size="icon"
                                                className="size-8"
                                                style={{ borderRadius: "var(--radius-md)" }}
                                                disabled={status === "submitted" || uploading}
                                                onClick={handleVoiceButtonClick}
                                                type="submit"
                                            >
                                                {isLoading ? (
                                                    <Square className="size-5 fill-current" />
                                                ) : status === "submitted" ? (
                                                    <Loader2 className="size-5 animate-spin" />
                                                ) : voiceInputEnabled && isInputEmpty ? (
                                                    <Mic className="size-5" />
                                                ) : (
                                                    <ArrowUp className="size-5" />
                                                )}
                                            </Button>
                                        </motion.div>
                                    </PromptInputAction>
                                </PromptInputActions>
                            </motion.div>
                        )}
                    </AnimatePresence>
                </PromptInput>

                {showIntentShortcuts &&
                    isNewChatComposer &&
                    !isImageModel &&
                    (activeIntent !== null || isInputEmpty) && (
                        <div
                            className={cn(
                                "mx-auto w-full",
                                getChatWidthClass(chatWidthState.chatWidth)
                            )}
                        >
                            <IntentGuide
                                stage={intentGuideStage}
                                availability={{
                                    image: modelSupportsVision && modelSupportsFunctionCalling,
                                    web:
                                        modelSupportsFunctionCalling &&
                                        composerToolbar.webSearchAvailable,
                                    analysis: modelSupportsFunctionCalling && codeExecutionAvailable
                                }}
                                attachments={uploadedFiles}
                                recentImages={recentGeneratedImages.results.slice(0, 6)}
                                attachingImageKey={attachingImageKey}
                                webTrends={webTrends}
                                webTrendsLoading={webTrendsLoading}
                                onSelectIntent={prepareIntent}
                                onClearIntent={clearIntent}
                                onChoosePrompt={chooseIntentPrompt}
                                onAppendPrompt={appendIntentPrompt}
                                onUpload={handleIntentUpload}
                                onChooseRecentImage={attachRecentGeneratedImage}
                            />
                        </div>
                    )}
            </div>

            <AttachmentPreviewDialog
                file={dialogFile}
                open={dialogOpen}
                onOpenChange={(open) => {
                    setDialogOpen(open)
                    if (!open) {
                        setTimeout(() => setDialogFile(null), 150)
                    }
                }}
            />
        </>
    )
})
