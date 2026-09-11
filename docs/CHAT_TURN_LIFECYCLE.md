# Chat turn admission and persistence

The chat HTTP action uses an internal readiness query for account-deletion status,
the model registry (including its settings), credit plan, and preflight thread
context. This result contains provider credentials and must never be exposed to
the browser or a public query. It is a snapshot, not a reservation or durable
authorization.

## Boundaries that remain separate

- Model and tool reservations retain their own idempotency keys and release paths.
  Context rejection and hosted-to-BYOK fallback still release or replace the model
  reservation. Tool admission still happens before each external tool execution.
- After insertion/edit/retry, a fresh query returns committed messages and the
  persona snapshot. Preflight context must not replace this read: retries can
  delete descendants and reuse an assistant's public message ID.
- Message insertion and stream registration recheck account deletion and ownership.
  Registration also requires the actual assistant document to still exist, not
  just its reusable public message ID.
- Billing settlement remains separate from answer finalization. A billing failure
  must not roll back a successfully saved answer. External model calls, Redis,
  downloads, and Node parsing remain outside database transactions.

## Stream ownership and completion

Stream registration writes the thread's `lastStreamId` and the assistant document's
`generationStreamId`. Live writes carry both the
stream ID and the actual assistant document ID. A superseded stream cannot replace
the newer stream's message, restart its own live state, or clear the newer live flag.
The last-stream marker survives stop/completion so delayed writes can still be rejected.
An older turn writing a different assistant document may still finish its own
answer; it only loses the right to clear the newer turn's live state.

The terminal message snapshot, analytics event, stream finalization marker, and
live-state clearing commit in one mutation. Replaying that mutation does not emit
another usage event. Delayed partial writes are rejected after finalization.
Stopping still marks Redis stopped and immediately clears live state; the owning
generation can subsequently save its partial terminal result.

Partial snapshots are saved at most about once per second while parts change, with
an immediate final flush. The sender keeps its direct SSE path. Passive clients,
resumption, the query cache, and the completed-message hydration guard remain intact.

Partial stream saves update only the message, leaving the thread document unchanged.
Admission and finalization still update thread recency, and stream start/stop still
publish live state. This prevents each partial save from invalidating thread details,
sidebar pagination, and search results through the thread's `updatedAt` field.

Message history and composer hydration use ordinary Convex subscriptions, so their
`skip` guards immediately release them. The general cache retains idle subscriptions
for five minutes and remains useful for other queries. The sending client skips
history during its direct stream and resubscribes after completion or error;
passive viewers keep receiving saved snapshots. Command-palette search subscribes
only while open and releases immediately when closed.

The direct-send lifetime is tracked separately from pending admission: the data
processor clears pending admission when stream metadata attaches, before generation
finishes. That transition (including adopting a newly created thread ID) must not
reactivate the sender's history subscription.

Usage has three consumers: the header quick view and the billing/profile settings
pages. The header uses the same controlled open state for its desktop popover and
mobile drawer; usage subscribes only while open, and collapsing header controls
closes it. Settings pages remain subscribed while mounted. All three use ordinary
subscriptions, retaining only an account-scoped display cache after closing or
navigation. The separate plan/access subscription remains active for feature gates.

## Attachment admission

PDFs emitted as native model input are collected and deduplicated before conversion.
The database checks validation records in batches of up to 100, checking current R2
metadata identity for each key. Cache misses go through the Node action, which
independently rechecks metadata before parsing. Over-limit and cached unreadable
files remain rejected; foreign URLs cannot bypass admission.

Successful PDF admission and generated-image preparation are reused within one
turn. Failed image preparation can retry on the later context pass. The final
committed history is still checked, including any attachments absent from preflight.

## Expected function executions

For a normal successful turn in an existing thread with no enabled tools or special
attachments, the fixed path is nine executions: HTTP, readiness, model reservation,
message insertion, committed-context query, stream registration, live-start mutation,
terminal mutation, and credit settlement. Partial saves, title generation, fallback,
tool accounting, reactive query reruns, and background work add to this count.

During a sender-only turn with search closed, a partial persistence tick should
now cause only the message mutation. A subscribed passive viewer also requires a
message-query rerun. Lifecycle transitions, title updates, and credit changes still
invalidate their relevant subscriptions. This is not a fixed total for the whole
browser session; other open tabs and retained queries also affect executions.

For P cached PDFs in one batch, admission adds P R2 component metadata queries plus
one batch query, instead of three executions per PDF. Each cache miss adds the four
executions of Node validation and persistence. Cold admission is consequently more
expensive than warm admission; that extra independent check preserves correctness.

Tests exercise the database functions through convex-test for stale ownership,
replayed completion, deletion during setup, edited history, and cached PDF decisions.
These are deterministic regression tests, not production concurrency or cost measurements.
