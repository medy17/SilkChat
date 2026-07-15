# Account Deletion

Account deletion uses a resumable purge with a minimal pseudonymized tombstone.

## Product Behavior

The deletion UI requires the exact confirmation phrase and two explicit acknowledgements: permanent erasure and limited fraud-prevention retention. A request creates an `accountDeletionJobs` record before asynchronous processing starts.

While a job is active, guarded write paths reject new account work. The processor then snapshots identity, usage, and subscription state; writes the tombstone; purges user-owned data and R2 objects in batches; removes Better Auth data; and marks the job complete. Failed work is retried by the scheduler and by a five-minute cron sweep.

The implementation is idempotent so interrupted jobs can resume without duplicating usage, billing, or purge effects.

## Why a Tombstone Remains

Deleting and recreating a free account must not reset the current included-usage window. The retained `identitySuppressions` row contains pseudonymized identity hashes, aggregate usage, deletion timestamps, and minimal subscription/refund context. It does not retain messages, files, settings, raw email addresses, or OAuth identifiers.

Identity matching uses:

- HMAC-SHA256 of the Google account ID when available
- HMAC-SHA256 of normalized email as a fallback and cross-check
- `IDENTITY_FINGERPRINT_PEPPER` as the stable deployment secret, falling back to `BETTER_AUTH_SECRET` for compatibility

Google identity matches take precedence. Duplicate or conflicting suppression rows are merged conservatively and can be marked with `supersededBy`.

Do not rotate `IDENTITY_FINGERPRINT_PEPPER` without a compatibility strategy. Each tombstone requires the pepper that produced its hashes.

## Usage Carry-Forward

Usage carry-forward uses aggregate micro-USD values.

At deletion, settled events, active reservations, tool reservations, and any existing carry-in are accumulated for the current anchored period. On a matching re-registration, Better Auth user/account triggers materialize these fields on `prototypeCreditAccounts`:

```text
carriedForPeriodKey
carriedUsageMicrousd
```

Credit summary and enforcement use the carry only when its period key matches the current period. It therefore expires naturally at the next period boundary. Repeated delete/recreate cycles write the cumulative value rather than adding an already-carried value twice.

## Billing Relinking

`billingSubscriptionLinks` is the durable mapping from a LemonSqueezy subscription to either a live user or an identity suppression. Webhook resolution prefers this mapping and uses `custom_data.user_id` only as the fallback identifier.

Deletion snapshots paid-through dates and cancels eligible subscriptions without refunding them. A returning identity can be relinked to remaining local Pro entitlement. Refund webhooks resolved to a suppression increment the refund count and revoke the retained entitlement.

The neutral link exists so late subscription events do not depend on a deleted user-owned subscription row.

## Persistent Tables

### `identitySuppressions`

Stores identity hashes, anchored-period usage, minimal Pro/subscription context, deletion counts, refund count, live-user relink state, and optional supersession state. See `convex/schema/account_deletion.ts` for the authoritative shape.

### `billingSubscriptionLinks`

Stores subscription/customer identifiers, live-user or suppression linkage, plan/status dates, and last-event metadata.

### `accountDeletionJobs`

Stores the user/auth IDs, status, phase, acknowledgement audit fields, retry state, errors, and timestamps. Current statuses are `pending`, `purging`, `retrying`, `completed`, `failed`, and `cancelled`.

## Purge Scope

The purge covers user-owned application records, including chat data, imports, personas, settings and encrypted keys, generated images and jobs, usage and reservations, access/billing rows, and auth-related records. It also removes R2 objects found through author metadata and known generated derivative keys.

Durable suppression and neutral subscription-link rows are deliberately outside the user-content cascade.

The source of truth for the orchestration and exact batch list is `convex/account_deletion.ts`. New user-owned tables or R2 prefixes must be added to that cascade and covered by tests.

## Entry Points and Supporting Code

- `convex/account_deletion.ts`: request API, snapshotting, job processor, batched purge, retries
- `convex/lib/account_deletion.ts`: fingerprinting and suppression merge rules
- `convex/lib/account_deletion_restore.ts`: re-registration carry-in and entitlement restoration
- `convex/lib/account_deletion_gate.ts`: action-side write gate
- `convex/lib/account_deletion_status.ts`: job status helpers
- `convex/schema/account_deletion.ts`: table validators
- `convex/billing.ts`: subscription-link and suppression-aware webhook resolution
- `convex/crons.ts`: pending-job sweep
- `src/routes/settings/profile.tsx`: deletion UI

## Current Limitations

The deletion system does not provide:

- a recent-reauthentication requirement before accepting deletion
- a deletion block for pending or disputed payments
- a pruning schedule for free-only suppression rows
- refund-abuse restrictions beyond revoking retained paid entitlement
- a resume-billing flow for returning users with paid time remaining

Pro restoration depends on LemonSqueezy renewal and paid-through timestamps. Annual subscriptions and unusual renewal anchors require staging validation before operational reliance.

## Verification

Relevant coverage lives primarily in:

- `tests/backend/account-deletion.spec.ts`
- `tests/backend/lemon-squeezy.spec.ts`
- `tests/backend/credits-module.spec.ts`

When changing this system, test fingerprint matching, cumulative carry-forward, re-registration before and after a period boundary, idempotent retries, purge coverage, subscription relinking, and refund handling. Run `bun run test` and `bun run check-types`.
