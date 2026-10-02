# Composer

The composer supports new chats, existing chats, folder chats, and editing user messages. The main composer and an open message editor can be used independently. They share controls and attachment processing, but each owns its draft state.

## Module layout

| Module | Responsibility |
| --- | --- |
| `src/components/multimodal-input.tsx` | Main and folder composer UI, voice input, context preview, intent shortcuts, and sending. |
| `src/components/composer/message-editor.tsx` | Message editing, attachment changes, local settings, save/discard, and navigation protection. |
| `src/components/composer/toolbar.tsx` | Shared desktop/mobile controls and model capability handling. |
| `src/components/composer/model-context.tsx` | Settings context, editor initialization, and settings change detection. |
| `src/components/composer/uploading-attachment-tile.tsx` | Upload progress, errors, and optional cancel or paste-restoration actions. |
| `src/components/composer/draft-attachment-tile.tsx` | Completed draft attachments, thumbnails, preview requests, removal, and paste-restoration actions. |
| `src/components/composer/existing-attachment-tile.tsx` | Saved message attachments, large or compact image previews, and remove/restore presentation. |
| `src/components/composer/attachment-preview-dialog.tsx` | Image, tabular, text, and binary preview presentation. |
| `src/components/composer/attachment-icon.tsx`, `attachment-actions.tsx` | Shared file-type icons and attachment action controls. |
| `src/lib/composer-session.ts` | Draft ownership, persistence, upload jobs, submission recovery, and disposal. |
| `src/lib/composer-attachments.ts` | Attachment preparation and the compose/edit upload policies. |
| `src/hooks/use-composer-attachments.ts` | Authentication, upload policy, network operations, and notifications for attachments. |
| `src/hooks/use-composer-paste.ts` | Shared paste classification, attachment queueing, and restoration feedback for compose and edit. |
| `src/lib/composer-pasted-text.ts` | Clipboard extraction and cancellation-safe restoration into the owning session. |
| `src/lib/composer-message.ts` | Message text normalization, final attachment validation and serialization, and pasted-text retrieval. |
| `src/lib/composer-context.ts` | Pure context-budget prediction and model-selector hints. |
| `src/lib/composer-drop.ts` | Routing drops to the active surface within a draft scope. |
| `src/lib/chat-submission.ts` | Correlating a send or edit with backend acknowledgement. |
| `src/hooks/use-chat-actions.ts` | Chat SDK operations, optimistic edit recovery, and attachment deletion after acceptance. |

## Draft ownership

A compose session is a Zustand store owned by one draft scope. The in-memory registry also includes the signed-in owner. Draft keys are defined by `getThreadDraftKey`:

| Surface | Draft key |
| --- | --- |
| Existing chat | `thread:<threadId>` |
| New chat in a folder | `folder:<folderId>:new` |
| General new chat | `new` |

A message editor has its own temporary session. It does not share the main composer's text or attachment list.

Text changes persist after a 400 ms debounce. Attachment changes persist immediately. Leaving a surface flushes its draft. Uploading or submitting sessions remain alive after navigation; asynchronous completion updates the original session rather than the currently visible chat.

After a new chat is accepted, its remaining draft moves to the returned thread ID. The new-chat draft key is cleared. Deleting a chat or folder disposes its matching sessions and runs draft attachment cleanup. Disposed sessions reject late attachment additions and skip subsequent persistence.

If the destination thread already has a draft, promotion merges the opening draft into it and preserves the destination's live session. Existing source subscribers and late upload callbacks follow that session, so subsequent writes cannot overwrite one another through separate persistence timers.

Draft storage contains attachment references. Source `File` objects and duplicate large-paste bodies are excluded. A browser refresh restores saved draft content, but does not resume an interrupted upload or request.

## Sending

A send requires non-whitespace text or an attachment. JavaScript `trim()` determines whether text is empty; numbers and symbols count as text. Attachment-only messages use this text:

> The user opted not to include text.

`submitComposerDraft` captures the submitted text and attachment references, clears the visible composer immediately, and keeps a separate recovery snapshot. Draft storage retains that snapshot while the request is pending. Anything typed afterward belongs to the next draft, even when it exactly matches the sent text.

The transport settles submission using the `X-Silkchat-Accepted-Thread` response header. The backend adds this header after committing the messages. A successful rollback removes acceptance; a generation or setup failure after commit retains it. The SDK's generation promise resolving is not sufficient evidence that the message was saved.

When a committed opening returns an HTTP error before stream metadata arrives, the client opens the saved thread from the acceptance header. This recovery only applies while the originating surface is still active and unchanged; a delayed response must not navigate away from a newer chat.

| Outcome | Draft handling |
| --- | --- |
| Accepted | Release the submitted snapshot and cached attachment data. Preserve the next draft. Promote a new-chat session to the accepted thread. |
| Rejected or request throws | Restore the submitted content. If a next draft exists, place recovered text before it and merge attachment references without losing either draft. |
| Owner deleted while waiting | Do not restore or persist content into the deleted scope. |

While acknowledgement is pending, duplicate submission is blocked. During streaming, the main composer's send control retains its stop behavior.

A lost response can leave persistence uncertain. The client retains the draft conservatively; the protocol does not provide idempotent resend. Check the saved chat before retrying an ambiguous network failure.

## Attachment processing

Attachment tiles receive data and callbacks from their surface. They do not own sessions, perform uploads or deletion, or change edit state. The shared `AttachmentTile` supplies the base tile and upload-status presentation; the composer variants supply the actions appropriate to each attachment state.

Files pass through policy validation, document ingestion, upload preparation, and the existing upload adapter. Model capability checks also apply before send or edit save. Preparation, active uploads, and acquisition of generated images block submission.

Compose and edit use different batch policies:

| Stage | Compose | Edit |
| --- | --- | --- |
| Validation | Report invalid files and continue with valid ones. | Reject the entire batch if any file is invalid. |
| Processing | Convert inputs serially, then upload prepared files independently and concurrently. | Convert and upload serially within one batch. |
| Upload failure | Keep successful files and show failed tiles. Ordinary failures do not issue additional reservation-deletion requests. | Roll back all reservations in the batch. Release the controls immediately; failed tiles remain briefly for feedback. |
| Another batch | Independent batches may coexist. | Report that the current batch is busy. |
| Cancellation or disposal | Abort pending work, clean up reserved remote objects, and reject late results. | Apply cancellation and cleanup to the whole batch. |

Queue stages feed attachment telemetry: `validation`, `conversion`, `inline_ingest`, and `upload`. Document ingestion that requires code execution records that requirement on the originating session. When that session is active, the composer enables the tool and displays its notification.

### Discarding an edit during upload

Discard reads completed additions from the live session, disposes the session, and clears its attachment state. Existing attachments on the saved message are untouched, including those marked for removal in the canceled edit.

| File state | Cleanup |
| --- | --- |
| Added by a completed edit batch | Delete the uploaded object. Inline document attachments only require local cleanup. |
| Uploaded within a batch that is still running | Roll back its reservation with the rest of that batch. |
| Queued but not started | Remove the job without uploading or creating a reservation. |
| Uploading | Abort the network request and delete its known reservation. Late results cannot be added to the disposed session. |
| Converting or preparing locally | Work may finish locally, but the next cancellation check prevents upload or attachment insertion. |

The deletion mutation checks both completed file metadata and pending upload reservations, enforcing ownership in either case. Deleting a pending reservation prevents finalization and schedules another object deletion after the upload URL expires plus the storage cleanup grace period, covering a PUT that finishes after cancellation. If the reservation response never reaches the client, the existing server-side expiry job cleans up the unknown reservation. Cleanup errors are reported rather than treated as successful deletion.

## Paste and drop routing

Clipboard files take precedence over clipboard text. Text uses the thresholds in `classifyPastedText` to remain inline, become a referenced attachment, or become an ordinary text attachment. While an editor upload batch is busy, text stays inline and does not change tool selection.

Pasted-text attachments provide **Show as text**. During upload, this cancels the job and restores its text; in edit mode it cancels the batch. After upload, it restores text and removes the draft attachment. Restored drafts retrieve missing paste content from the uploaded object on demand. Retrieval failure leaves the attachment intact and reports an error. Public attachment hosting must allow the application's origin to fetch these objects.

Drop targets register with a draft scope. Opening an editor activates its target. Focus or pointer interaction activates the receiving surface. Closing the editor restores the main composer fallback. Folder scope is carried through before a thread ID exists. File picker and paste events always act on their receiving surface.

## Editing and settings

Each generation stores a configuration checkpoint containing:

- Model and effective reasoning effort.
- Requested tools and automatic tool-selection mode.
- Configured tool-call limit.
- Resolved callable tools and effective tool-call limit, recorded separately.

Separating configured and effective limits prevents a turn with no tools from replacing the configured limit with zero.

An editor initializes from the assistant checkpoint associated with its user message, falling back to the user message's checkpoint. Lookup stops at the next user turn. Older messages use available model/reasoning metadata and current defaults for missing fields, without a fallback notice.

For automatic tool-selection checkpoints, the editor restores the resolved tools because editing an existing thread does not rerun opening tool selection. Older checkpoints without resolved tools fall back to the requested tools. Manual checkpoints retain their requested tools.

Model, reasoning, tool selection, automatic mode, and tool-call limit are local to the editor. User changes do not modify the main composer or account preferences. Automatic availability adjustments update the editor's baseline and do not count as user edits. Image-generation defaults retain their account-level behavior. Image models remain hidden from the model selector.

Saving validates the resulting attachment set and submits the edited text with the local configuration. Saving during a submitted or streaming response is rejected with an explanation. While an edit is awaiting acceptance, duplicate saves and discard are blocked.

A rejected edit restores the optimistic message history and footer metadata and leaves the editor open. An accepted edit replaces the current continuation, closes the editor, and then deletes attachments marked for removal. Conversation versions are not retained. Discarding an edit cancels its jobs and deletes newly added attachments. Changes to text, attachments, or local settings trigger the navigation/discard guard.
