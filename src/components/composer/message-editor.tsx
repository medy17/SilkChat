import { useComposerModelApi } from "./model-context"
import { discardEditAttachments } from "@/lib/composer-attachments"
import { useStore } from "zustand"
import {
    createComposerSession,
    disposeComposerSession,
    attachmentsBusy
} from "@/lib/composer-session"
import { prepareComposerMessage } from "@/lib/composer-message"
import { useComposerPaste } from "@/hooks/use-composer-paste"
import { readComposerClipboard } from "@/lib/composer-pasted-text"
import { useComposerAttachments } from "@/hooks/use-composer-attachments"
import { useComposerDropTarget } from "@/hooks/use-composer-drop-target"
import { getThreadDraftKey } from "@/lib/thread-drafts"
import {
    peekMessageEditRecovery,
    stashMessageEditRecovery,
    takeMessageEditRecovery
} from "@/lib/message-edit-recovery"
import {
    ComposerModelProvider,
    createMessageEditModelStore,
    hasEditSettingsChanges,
    useComposerModelStore
} from "./model-context"
import type { GenerationConfig } from "@/lib/assistant-config"
import { useSharedModels } from "@/lib/shared-models"
import { useAvailableModels } from "@/lib/models-providers-shared"
import { useCurrentUserSettings } from "@/hooks/use-current-user-settings"
import { useSession } from "@/hooks/auth-hooks"
import { DefaultSettings } from "@/lib/default-user-settings"
import { mergePastedTextIntoDraft } from "@/lib/pasted-text"
import { api } from "@/convex/_generated/api"
import { useEditNavigationGuard } from "@/hooks/use-edit-navigation-guard"
import type { UploadedFile } from "@/lib/chat-store"
import { getFileAcceptAttribute } from "@/lib/file_constants"
import {
    matchesCancelMessageEditShortcut,
    matchesSaveMessageEditShortcut
} from "@/lib/keyboard-shortcuts"
import { getEnabledToolsForPastedText } from "@/lib/pasted-text"
import type { FileUIPart, UIMessage } from "ai"
import { useMutation } from "convex/react"
import { ArrowUp } from "lucide-react"
import { memo, useCallback, useEffect, useRef, useState } from "react"
import { toast } from "sonner"
import { DraftAttachmentTile } from "./draft-attachment-tile"
import { UploadingAttachmentTile } from "./uploading-attachment-tile"
import { ExistingAttachmentTile } from "./existing-attachment-tile"
import { ModelSelector } from "@/components/model-selector"
import { ComposerDesktopActions, ComposerMobileMenu, useComposerToolbarState } from "./toolbar"
import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle
} from "@/components/ui/alert-dialog"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"

const MessageEditor = memo(
    ({
        message,
        threadId,
        folderId,
        onSave,
        onCancel,
        cancelRequestRef,
        requiresNativePdfForModelSelection = false
    }: {
        message: UIMessage
        threadId?: string
        folderId?: string
        onSave: (
            newContent: string,
            remainingFileParts?: FileUIPart[],
            deletedUrls?: string[],
            config?: GenerationConfig
        ) => Promise<boolean>
        onCancel: () => void
        cancelRequestRef?: React.MutableRefObject<(() => void) | null>
        requiresNativePdfForModelSelection?: boolean
    }) => {
        const deleteFileMutation = useMutation(api.attachments.deleteFile)
        const fileInputRef = useRef<HTMLInputElement>(null)
        const [recovery] = useState(() => peekMessageEditRecovery(message.id))
        const [editSession] = useState(() => recovery?.session ?? createComposerSession())
        const mountedRef = useRef(false)
        const { attachments: addedFiles, jobs: uploadingFiles } = useStore(editSession)
        const uploading = uploadingFiles.some((file) => file.status !== "error")
        const [saving, setSaving] = useState(false)
        const savingRef = useRef(false)
        const {
            selectedModel,
            setSelectedModel,
            enabledTools,
            setEnabledTools,
            reasoningEffort,
            autoSelectTools,
            toolCallLimitPerTurn
        } = useComposerModelStore()
        const composerToolbar = useComposerToolbarState()
        const modelApi = useComposerModelApi()
        const {
            modelSupportsFunctionCalling,
            modelSupportsVision,
            modelSupportsNativePdf,
            codeExecutionAvailable
        } = composerToolbar

        const originalMessage = useRef(message).current
        const textContent = originalMessage.parts
            .filter((part) => part.type === "text")
            .map((part) => part.text)
            .join("\n")

        const fileParts = originalMessage.parts.filter((p): p is FileUIPart => p.type === "file")

        const [editedContent, setEditedContent] = useState(recovery?.text ?? textContent)
        const [deletedUrls, setDeletedUrls] = useState<string[]>(recovery?.deletedUrls ?? [])
        const [showCancelConfirmation, setShowCancelConfirmation] = useState(false)
        const settingsChanged = useComposerModelStore(hasEditSettingsChanges)

        const hasUnsavedChanges =
            saving ||
            editedContent !== textContent ||
            deletedUrls.length > 0 ||
            addedFiles.length > 0 ||
            uploadingFiles.length > 0 ||
            settingsChanged

        const queue = useComposerAttachments(editSession, {
            mode: "edit",
            support: {
                supportsVision: modelSupportsVision,
                supportsNativePdf: modelSupportsNativePdf
            },
            canReferenceLongTextAttachments: modelSupportsFunctionCalling && codeExecutionAvailable,
            enableTools: (decision) =>
                setEnabledTools(
                    getEnabledToolsForPastedText(decision, modelApi.getState().enabledTools)
                )
        })
        const handleAddFiles = (files: File[]) => {
            if (savingRef.current) return Promise.resolve()
            if (attachmentsBusy(editSession)) {
                toast.info("Wait for the current attachments to finish uploading.")
                return Promise.resolve()
            }
            return queue.add(files.map((file) => ({ file })))
        }
        const activateDropTarget = useComposerDropTarget(
            getThreadDraftKey({ threadId, folderId }),
            "edit",
            handleAddFiles
        )
        const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
            if (event.target.files) void handleAddFiles(Array.from(event.target.files))
            event.target.value = ""
        }
        const pastedText = useComposerPaste(editSession, {
            mode: "edit",
            queue,
            addFiles: handleAddFiles,
            canReferenceLongTextAttachments: modelSupportsFunctionCalling && codeExecutionAvailable,
            enableTools: (decision) =>
                setEnabledTools(
                    getEnabledToolsForPastedText(decision, modelApi.getState().enabledTools)
                ),
            appendText: (text) =>
                setEditedContent((current) => mergePastedTextIntoDraft(current, text)),
            isLocked: () => savingRef.current
        })
        const handlePaste = (event: React.ClipboardEvent<HTMLTextAreaElement>) => {
            if (pastedText.paste(readComposerClipboard(event.clipboardData))) event.preventDefault()
        }
        const removeAddedFile = (file: UploadedFile) => {
            if (!savingRef.current) void queue.remove(file.key)
        }

        const handleSave = async () => {
            if (savingRef.current || attachmentsBusy(editSession)) return
            const {
                text,
                fileParts: nextFileParts,
                errors
            } = prepareComposerMessage({
                text: editedContent,
                attachments: editSession.getState().attachments,
                existingParts: fileParts,
                deletedUrls,
                support: {
                    supportsVision: modelSupportsVision,
                    supportsNativePdf: modelSupportsNativePdf
                },
                policy: queue.policy
            })
            if (text === null) return
            if (errors.length) {
                toast.error(errors.join("\n"))
                return
            }
            if (!selectedModel) return
            const config = {
                modelId: selectedModel,
                reasoningEffort,
                enabledTools,
                autoSelectTools,
                toolCallLimitPerTurn
            }
            savingRef.current = true
            setSaving(true)
            stashMessageEditRecovery(message.id, {
                session: editSession,
                text: editedContent,
                deletedUrls,
                config
            })
            try {
                await onSave(text, nextFileParts, deletedUrls, config)
            } finally {
                // Still mounted means the save was refused before the editor closed.
                if (mountedRef.current) {
                    takeMessageEditRecovery(message.id)
                    savingRef.current = false
                    setSaving(false)
                }
            }
        }

        const discardAddedFiles = useCallback(() => {
            void discardEditAttachments(editSession, (key) => deleteFileMutation({ key })).then(
                (results) => {
                    let deletedCount = 0
                    let alreadyDeletedCount = 0
                    let failedCount = 0

                    for (const result of results) {
                        if (result.status === "rejected") {
                            failedCount += 1
                        } else if (result.value?.success) {
                            deletedCount += 1
                        } else if (result.value?.error === "File not found") {
                            alreadyDeletedCount += 1
                        } else {
                            failedCount += 1
                        }
                    }

                    if (deletedCount > 0) {
                        toast.success(
                            deletedCount === 1
                                ? "Attachment deleted"
                                : `${deletedCount} attachments deleted`
                        )
                    }
                    if (alreadyDeletedCount > 0) {
                        toast.info(
                            alreadyDeletedCount === 1
                                ? "Attachment was already deleted"
                                : `${alreadyDeletedCount} attachments were already deleted`
                        )
                    }
                    if (failedCount > 0) {
                        toast.error(
                            failedCount === 1
                                ? "Failed to delete attachment"
                                : `Failed to delete ${failedCount} attachments`
                        )
                    }
                }
            )
        }, [editSession, deleteFileMutation])

        const commitCancel = useCallback(() => {
            if (savingRef.current) return
            discardAddedFiles()
            onCancel()
        }, [discardAddedFiles, onCancel])

        const requestCancel = useCallback(() => {
            if (savingRef.current) return
            if (!hasUnsavedChanges) {
                commitCancel()
                return
            }

            setShowCancelConfirmation(true)
        }, [commitCancel, hasUnsavedChanges])

        const navigationGuard = useEditNavigationGuard(hasUnsavedChanges, commitCancel)

        const handleConfirmCancel = useCallback(() => {
            setShowCancelConfirmation(false)
            commitCancel()
            navigationGuard.proceed?.()
        }, [commitCancel, navigationGuard.proceed])

        const handleCancelDialogOpenChange = useCallback(
            (open: boolean) => {
                setShowCancelConfirmation(open)
                if (!open) navigationGuard.reset?.()
            },
            [navigationGuard.reset]
        )

        useEffect(() => {
            if (!cancelRequestRef) return

            cancelRequestRef.current = requestCancel
            return () => {
                cancelRequestRef.current = null
            }
        }, [cancelRequestRef, requestCancel])

        useEffect(() => {
            mountedRef.current = true
            editSession.setState({ disposed: false })
            takeMessageEditRecovery(message.id)
            return () => {
                mountedRef.current = false
                disposeComposerSession(editSession)
            }
        }, [editSession, message.id])

        const handleKeyDown = (e: React.KeyboardEvent) => {
            if (matchesSaveMessageEditShortcut(e)) {
                e.preventDefault()
                handleSave()
            }
            if (matchesCancelMessageEditShortcut(e)) {
                e.preventDefault()
                requestCancel()
            }
        }

        const totalAttachmentCount = fileParts.length + addedFiles.length + uploadingFiles.length

        return (
            <>
                <div
                    className="@container"
                    onFocusCapture={activateDropTarget}
                    onPointerDownCapture={activateDropTarget}
                >
                    <Textarea
                        value={editedContent}
                        disabled={saving}
                        onChange={(e) => setEditedContent(e.target.value)}
                        onKeyDown={handleKeyDown}
                        onPaste={handlePaste}
                        className="min-h-24 w-full resize-none border-none bg-transparent p-0 pb-3 text-foreground shadow-none outline-none placeholder:text-muted-foreground focus:outline-none focus:ring-0 focus-visible:ring-0 focus-visible:ring-offset-0"
                    />

                    {totalAttachmentCount > 0 && (
                        <div className="flex flex-wrap gap-2 pb-3">
                            {fileParts.map((part, index) => (
                                <ExistingAttachmentTile
                                    key={index}
                                    part={part}
                                    removed={deletedUrls.includes(part.url)}
                                    compact={totalAttachmentCount > 1}
                                    disabled={saving}
                                    onToggleRemove={() => {
                                        if (savingRef.current) return
                                        setDeletedUrls((current) =>
                                            current.includes(part.url)
                                                ? current.filter((url) => url !== part.url)
                                                : [...current, part.url]
                                        )
                                    }}
                                />
                            ))}
                            {uploadingFiles.map((job) => (
                                <UploadingAttachmentTile
                                    key={job.id}
                                    job={job}
                                    compact
                                    disabled={saving}
                                    onShowText={() => pastedText.showUploadingText(job.id)}
                                />
                            ))}
                            {addedFiles.map((file) => (
                                <DraftAttachmentTile
                                    key={file.key}
                                    file={file}
                                    compact
                                    disabled={saving}
                                    onRemove={() => removeAddedFile(file)}
                                    onShowText={() => void pastedText.showUploadedText(file)}
                                />
                            ))}
                        </div>
                    )}

                    <div data-edit-controls>
                        <div className="flex items-center gap-2 border-border/70 border-t pt-3">
                            <div className="flex min-w-0 flex-1 items-center @3xl:gap-2 gap-1.5 overflow-hidden @3xl:overflow-visible">
                                {selectedModel && (
                                    <ModelSelector
                                        selectedModel={selectedModel}
                                        onModelChange={setSelectedModel}
                                        telemetrySurface="message_edit"
                                        side="top"
                                        className="border-0 bg-secondary/70 backdrop-blur-lg hover:bg-secondary/80"
                                        requiresNativePdf={requiresNativePdfForModelSelection}
                                    />
                                )}
                                <input
                                    ref={fileInputRef}
                                    type="file"
                                    multiple
                                    onChange={handleFileChange}
                                    className="hidden"
                                    accept={getFileAcceptAttribute(modelSupportsVision)}
                                />
                                <ComposerDesktopActions
                                    state={composerToolbar}
                                    threadId={threadId}
                                    uploading={uploading}
                                    onAttachClick={() => fileInputRef.current?.click()}
                                />
                            </div>

                            <ComposerMobileMenu
                                state={composerToolbar}
                                onAttachClick={() => fileInputRef.current?.click()}
                            />

                            <Button
                                size="icon"
                                className="size-8 shrink-0"
                                style={{ borderRadius: "var(--radius-md)" }}
                                onClick={handleSave}
                                disabled={uploading || saving}
                                title="Send"
                            >
                                <ArrowUp className="size-5" />
                            </Button>
                        </div>
                    </div>
                </div>

                <AlertDialog
                    open={showCancelConfirmation || navigationGuard.status === "blocked"}
                    onOpenChange={handleCancelDialogOpenChange}
                >
                    <AlertDialogContent>
                        <AlertDialogHeader>
                            <AlertDialogTitle>Discard edit?</AlertDialogTitle>
                            <AlertDialogDescription>
                                Your message changes will be lost if you cancel now.
                            </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                            <AlertDialogCancel>Keep editing</AlertDialogCancel>
                            <AlertDialogAction
                                disabled={saving}
                                onClick={handleConfirmCancel}
                                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                            >
                                Discard changes
                            </AlertDialogAction>
                        </AlertDialogFooter>
                    </AlertDialogContent>
                </AlertDialog>
            </>
        )
    }
)
EditableMessage.displayName = "EditableMessage"

type EditorProps = React.ComponentProps<typeof MessageEditor>
export function EditableMessage(
    props: EditorProps & {
        initialConfig?: ReturnType<
            typeof import("@/lib/assistant-config").getRetryTargetAssistantConfig
        >
    }
) {
    const { models } = useSharedModels()
    const session = useSession()
    const settings = useCurrentUserSettings(session.user?.id, false)
    const { availableModels } = useAvailableModels(
        "error" in settings ? DefaultSettings(session.user?.id ?? "") : settings
    )
    const [store] = useState(() => {
        const store = createMessageEditModelStore({
            config: props.initialConfig,
            models,
            availableModels,
            toolCallLimitPerTurn: ("error" in settings
                ? DefaultSettings(session.user?.id ?? "")
                : settings
            ).toolCallLimitPerTurn
        })
        // A rejected save resumes its attempted settings; the saved message stays the baseline.
        const config = peekMessageEditRecovery(props.message.id)?.config
        if (config)
            store.setState({
                selectedModel: config.modelId,
                reasoningEffort: config.reasoningEffort,
                enabledTools: [...config.enabledTools],
                autoSelectTools: config.autoSelectTools,
                toolCallLimitPerTurn: config.toolCallLimitPerTurn
            })
        return store
    })
    return (
        <ComposerModelProvider store={store}>
            <MessageEditor {...props} />
        </ComposerModelProvider>
    )
}
