# Self-Service Account Deletion + Anti-Re-Registration Abuse — Design Plan

Status: **Implemented for free-account anti-reset; remaining guardrails and Pro edge cases tracked below.**
Owner: TBD
Last updated: 2026-07-08

---

## 0. Progress checklist

- [x] Schema exists for `identitySuppressions`, `billingSubscriptionLinks`, `accountDeletionJobs`, and credit carry-in fields.
- [x] Deletion request creates an `accountDeletionJobs` gate before purge processing.
- [x] Deletion processing snapshots auth identity and current-period credit usage before destructive purge.
- [x] Tombstone write-back includes existing carry-in, preventing delete -> recreate -> delete loops from resetting usage within one window.
- [x] Credit summary, usage, reservations, and enforcement count `carriedBasicUnits` / `carriedProUnits` for the matching period.
- [x] Better Auth user/account create/update triggers re-link returning Google accounts and seed carry-in from the tombstone before first use.
- [x] LemonSqueezy webhooks resolve by `billingSubscriptionLinks` / tombstone before trusting stale `custom_data.user_id`.
- [x] Refund webhooks against deleted-user subscriptions update the tombstone and revoke Pro entitlement.
- [x] DB, Better Auth, and R2 purge paths exist and are batched/idempotent.
- [ ] Fresh reauth before deletion is not implemented.
- [ ] Blocking deletion during pending/disputed payment is not implemented.
- [ ] Pro entitlement restoration is partially implemented; monthly period anchoring/annual-sub edge cases need more validation.
- [ ] Tombstone pruning is intentionally deferred.
- [ ] No backfill is planned for pre-fix recreated accounts because there were no real deletion requests before this update.

Current verification:
- `bun run test` passed with 560 tests.
- `bun run check-types` passed.
- `bun run cloud:dev:push` succeeded on 2026-07-08.

---

## 1. Problem & goals

Status: **Mostly implemented.** Free-account anti-reset is now wired. Pro preservation exists for active entitlement but still needs validation around period anchoring and annual subscriptions.

We want a self-service "delete my account" flow that:

1. Genuinely erases the user's **content and personal data** (threads, messages, images, personas, settings incl. encrypted API keys, uploaded files).
2. Does **not** hand attackers a free-tier reset button. Deleting and re-registering must not grant a fresh monthly free allowance mid-window.
3. Correctly preserves **paid entitlement** a user already owns: a Pro subscriber who deletes keeps their remaining paid period if they come back before it expires.
4. Is defensible under privacy law (erasure with a documented fraud-prevention / legal-obligation carve-out; retain only minimized, pseudonymized data).

### Non-goals
- Blocking sophisticated multi-identity fraud (new Google account + new email + new device). We raise the cost, we don't make it impossible.
- Refund processing logic itself (LemonSqueezy owns that). We only react to refund webhooks.

---

## 2. Key facts from the codebase (grounding)

Status: **Partly stale line references, still conceptually accurate.** The key implementation facts remain: `userId` changes across deletion/recreation, usage windows are anchored, and carry-in must be modeled as usage rather than a permanent limit change.

- Identity id used everywhere (`authorId` / `userId`) is a **fresh string per signup**; deleting the Better Auth user and re-logging-in mints a **new** id. So `userId` is useless as a fraud key. (`convex/lib/identity.ts:30`)
- Included usage is tracked in a **rolling anchored monthly window**, not a calendar month:
  - `creditPeriodAnchorAt` is stamped at account creation or restored from a tombstone on return (`convex/credits.ts` `ensureCreditAccountRecord`; `convex/lib/account_deletion_restore.ts`).
  - Window bounds via `getAnchoredMonthlyCreditPeriodBounds`; `periodKey = "{startISO}/{endISO}"` (`convex/lib/credits.ts:116,143`).
- "Used this window" is the settled metered amount plus outstanding metered reservations. Historical Basic/Pro bucket fields remain stored for old accounting records but no longer participate in enforcement.
- Account-deletion restoration carries metered usage forward for the active window; it does not rewrite historical Basic/Pro values.
- Pro window anchors to the billing cycle `renewsAt` when present; else falls back to the account anchor (`convex/credits.ts:69-97`).
- A **cancelled** subscription is still `plan:"pro"` until it expires — `"cancelled"` ∈ `PRO_SUBSCRIPTION_STATUSES` (`convex/lib/lemon_squeezy.ts:32`). `endsAt` is the paid-through date.
- The LS webhook no longer blindly trusts `custom_data.user_id`; it first resolves via `billingSubscriptionLinks` and tombstones (`convex/billing.ts`). Refund events (`subscription_payment_refunded`) are handled events (`convex/lib/lemon_squeezy.ts`).
- Existing per-entity deletes do **not** fully cascade: `deleteThread` drops only the thread doc + aggregate; messages/streams/snapshots/R2 attachments are left behind (`convex/threads.ts:1049`). The cascade must handle children explicitly.
- R2 objects are tagged with `authorId` metadata on store, and `r2.listMetadata(ctx, userId, …)` lists by that metadata across all prefixes (`convex/attachments.ts:415`), covering `attachments/`, `references/`, `generations/` (+ blur derivatives), and persona assets uniformly.

---

## 3. Architecture overview

Status: **Implemented for the core flow.** The return path is now wired through Better Auth user/account triggers and the credit hot path reads carry-in from `prototypeCreditAccounts`.

Deletion is **purge-with-tombstone**, not full erasure:

```
DELETE:  explicit deletion orchestrator snapshots identity + usage
         -> writes durable tombstone + deletion gate
         -> cancels LS sub (if any) -> revokes sessions/auth
         -> purges DB rows -> purges R2 -> deletes Better Auth user
RETURN:  onCreate/first-login       ->  match tombstone by fingerprint
         ->  seed credit account (carry-in / pro re-link) before first message
ONGOING: LS webhooks resolve userId via subscriptionId (not stale custom_data)
```

New persistent structures:
- **`identitySuppressions`** table (the "tombstone") — never cascaded.
- **`billingSubscriptionLinks`** table — durable `subscriptionId -> tombstone/live user` mapping for webhook re-keying, independent of user-owned subscription rows.
- **`accountDeletionJobs`** table — deletion progress/gate so write paths can stop accepting new work before purge finishes.
- **Carry-in fields** on `prototypeCreditAccounts`.

---

## 4. Identity fingerprint

Status: **Implemented.** Google OAuth `accountId` is the primary anchor. Email remains as a fallback/cross-check even though production auth is Google-only.

At deletion time we read, **before destroying the user**:
- Google `sub` — from the component `account` table (`providerId="google"`, `accountId` = sub). **Primary key** — stable, user-immutable, spoof-resistant, immune to gmail dot/plus aliasing.
- Email — from the Better Auth user record. **Fallback / cross-check key.**

Hashing:
- `HMAC-SHA256(pepper, normalizedValue)`, `pepper` from env `IDENTITY_FINGERPRINT_PEPPER` — **stable, never rotated** (rotation breaks matching). Store hashes only (pseudonymized).
- Email normalization: trim + lowercase; for `gmail.com`/`googlemail.com` strip `.` and `+tag` (otherwise `a.b+x@gmail.com` evades). Google `sub` needs no normalization and is why it's primary.

Matching a returning user = **`googleSubHash` OR `emailHash`** hit.

Collision rule:
- Prefer an exact `googleSubHash` match over email-only matches.
- If `googleSubHash` and `emailHash` hit different tombstones, merge into the Google tombstone, preserving the max consumed units per matching period, earliest `firstDeletedAt`, latest `lastDeletedAt`, max `proEntitlementEndsAt`, max `refundCount`, and the latest billing context.
- If multiple rows match one key due to historical/race bugs, merge deterministically into the oldest row and delete/mark superseded duplicates before re-linking. Tests must cover this because Convex indexes are not unique.

**LemonSqueezy customer id is deliberately NOT a match key** — one customer legitimately funds multiple app users (family/team). It is stored as billing *context* only.

---

## 5. Schema changes

Status: **Implemented.** The schema exists with the planned tables/indexes and optional carry-in fields. `accountDeletionJobs.status` has additional terminal/retry states beyond the early sketch.

### 5.1 New table `identitySuppressions`
```
identitySuppressions:
  # match keys
  googleSubHash:            optional string     # index: byGoogleSubHash
  emailHash:                string              # index: byEmailHash

  # free-tier anti-abuse
  freeAnchorAt:             number              # original creditPeriodAnchorAt
  freePeriodKey:            string              # window active at last deletion
  freePeriodEndsAt:         number              # when that window resets
  freeConsumedBasicUnits:   number              # cumulative consumed in that window

  # pro entitlement
  everWasPro:               boolean
  proEntitlementEndsAt:     optional number     # = subscription.endsAt (paid-through)
  proPeriodKey:             optional string     # pro window active at deletion
  proConsumedBasicUnits:    optional number
  proConsumedProUnits:      optional number
  lemonSqueezyCustomerId:   optional string     # index: byCustomerId (context)
  lemonSqueezySubscriptionId: optional string   # index: bySubscriptionId (webhook re-key)
  refundCount:              number              # refund/chargeback abuse counter

  # linkage + meta
  relinkedToUserId:         optional string     # current live user, if returned
  priorDeletions:           number
  firstDeletedAt:           number
  lastDeletedAt:            number
```
Indexes: `byGoogleSubHash`, `byEmailHash`, `bySubscriptionId`, `byCustomerId`.

### 5.2 New table `billingSubscriptionLinks`
```
billingSubscriptionLinks:
  lemonSqueezySubscriptionId: string             # index: bySubscriptionId
  lemonSqueezyCustomerId:     optional string    # index: byCustomerId
  liveUserId:                 optional string    # current linked user if active/relinked
  suppressionId:              optional id("identitySuppressions")
  status:                     string
  plan:                       "free" | "pro"
  renewsAt:                   optional string
  endsAt:                     optional string
  trialEndsAt:                optional string
  lastEventId:                optional string
  updatedAt:                  number
```

This avoids keeping a deleted user's `lemonSqueezySubscriptions.userId` as the resolver source of truth. User-owned subscription rows may be deleted during purge once this link exists.

### 5.3 New table `accountDeletionJobs`
```
accountDeletionJobs:
  userId:        string       # index: byUser
  status:        "pending" | "purging" | "completed" | "failed"
  suppressionId: optional id("identitySuppressions")
  phase:         optional string
  error:         optional string
  createdAt:     number
  updatedAt:     number
```

Write-heavy paths must reject new user work while a non-completed job exists for `userId`.

### 5.4 Optional carry field on `prototypeCreditAccounts`
```
carriedForPeriodKey:   optional string   # period this carry-in applies to
carriedUsageMicrousd:  optional number   # pre-existing metered consumption
```
The historical Basic/Pro carry fields remain in the schema for old records but are not used by current enforcement. All fields are optional, so no backfill is required.

---

## 6. Carry-in usage accounting (the anti-reset core)

Status: **Implemented and tested.** Metered usage and reservation paths count carry-in for the matching period.

**Principle:** carry-in is resolved **once at signup** (from the tombstone) and materialized onto the account row. The credit hot path never reads the tombstone — it reads the carry-in fields off the account doc it **already fetches**, so marginal read cost ≈ one extra field. This directly answers the "extra reads" concern.

**Application rule:**
```
carriedUsage = (account.carriedForPeriodKey == currentPeriodKey)
  ? account.carriedUsageMicrousd
  : 0
effectiveUsage = settledUsageMicrousd + reservedUsageMicrousd + carriedUsage
```

Properties:
- **Self-expiring:** once the anchored window rolls, `currentPeriodKey` changes, so carry-in stops applying. No scheduled restore job or permanent limit change is needed.
- **Treated as consumption, not a smaller limit**, matching the current metered-usage model.

---

## 7. Deletion flow (ordered, idempotent, resumable)

Status: **Mostly implemented.** Snapshot/tombstone, purge job gating, auth deletion, DB purge, R2 purge, and scheduler retries exist. Fresh reauth and pending/disputed-payment blocking are not implemented.

Trigger: user confirms deletion (require fresh reauth / recent session; see §11).

1. **Snapshot + write tombstone FIRST.** Compute fingerprint hashes, current period, cumulative consumption (see §8 write-back rule), pro entitlement. Upsert `identitySuppressions` by fingerprint. *Durable before any destructive step* — a mid-cascade crash never loses the fraud record.
2. **Cancel LS subscription** (if active/on_trial/cancelled-not-expired) via LS API; snapshot `endsAt`. Retry via scheduler on API failure (does not block later steps; subscriptionId is already in the tombstone).
3. **Create/update `accountDeletionJobs` gate** before revocation. Chat, uploads, image generation, imports, and account/billing mutations check this gate and reject new work while deletion is pending/purging.
4. **Revoke auth / sessions** early so the user is logged out immediately. Do not rely on revocation alone: in-flight actions can already have resolved the old `userId`.
5. **Purge DB rows** (batched, self-rescheduling until empty):
   - Per thread: `messages` (`byThreadId`), `streams`, `threadPersonaSnapshots`, then thread + `aggregrateThreadsByFolder.delete`.
   - `userPersonas`, `projects`, `sharedThreads`, `importJobs`(+`importJobSources`+`importJobThreads`), `generatedImages`(+`generatedImageFacets`+`imageGenerationJobs`).
   - Credit/usage: `prototypeCreditAccounts`, `…Reservations`, `…Events`, `…ToolCallReservations`, `usageEvents`.
   - `settings` (encrypted API keys — high priority), `userAccess`.
   - Billing: upsert `billingSubscriptionLinks` first, then user-owned `lemonSqueezySubscriptions` can be deleted. Keep `lemonSqueezyWebhookEvents` unless retention policy says otherwise.
6. **Purge R2** via both metadata and known-key deletion:
   - `r2.listMetadata(ctx, userId, ...)` catches normal `attachments/`, `references/`, `generations/`, and persona uploads.
   - Generated-image blur derivatives use `authorId = getPrivateBlurAuthorId(sourceKey)` and keys under `blurred_generations/...`; delete them from generated image rows/known key derivation too, not only metadata listing.
7. **Delete auth/user** (component: sessions, accounts, 2FA, oauth\*, the user). Investigate whether app-schema `session`/`account`/`oauth*` tables are live duplicates or dead (see §12).
8. **Mark `accountDeletionJobs.status="completed"`** only after purge/auth deletion has finished.

Mechanism: expose an explicit authenticated deletion mutation/action that performs snapshot + tombstone before calling Better Auth deletion. Better Auth hooks can be a backup, but they must not be the only place that reads email/provider accounts because those records may already be gone. Everything is idempotent so a re-run resumes.

---

## 8. Deletion write-back rule (prevents multi-delete stacking)

Status: **Implemented.** Deletion snapshots include current events/reservations plus existing carry-in, then write the cumulative value to the tombstone.

On **every** deletion, before purge:
```
currentPeriodKey  = period(account)
carriedNow        = (account.carriedForPeriodKey == currentPeriodKey)
                      ? account.carried{Basic,Pro}Units : 0
consumedThisPeriod = carriedNow + currentPeriodEventUnits + reservations
```
Upsert tombstone:
- If `tombstone.freePeriodKey == currentPeriodKey`: **overwrite** `freeConsumedBasicUnits = consumedThisPeriod` (already includes prior carry-in → cumulative, no double count).
- Else (new window): replace with the new window's values.
- `priorDeletions += 1`, `lastDeletedAt = now`.
- Pro buckets handled analogously.

Because `consumedThisPeriod` already folds in `carriedNow`, we **write** it (not add) — idempotent, and no amount of delete→return→delete cycling within one window resets the counter.

---

## 9. Pro subscription: cancel + re-link

Status: **Partially implemented.** Webhook re-keying and refund-to-tombstone handling are implemented. Return-time Pro re-linking seeds account/subscription state, but Pro period anchoring and annual-sub behavior still need explicit validation.

### At deletion
- Cancel the LS sub (converts active→cancelled; no future renewals/charges; **no refund** — user rides out the paid period). Snapshot `everWasPro`, `proEntitlementEndsAt = endsAt`, pro period key, consumed basic+pro, `customerId`, `subscriptionId`.
- Cancelling an already-cancelled sub is a no-op (idempotent for redeletion).

### On return (before `proEntitlementEndsAt`)
- **Re-link:** insert a `lemonSqueezySubscriptions` row under the new `userId`, set `tombstone.relinkedToUserId = newUserId`, set account `plan="pro"`, restore the pro period bounds (anchor to preserve monthly resets through `endsAt`), and seed carry-in (`carriedBasicUnits`/`carriedProUnits` = consumed) for the current pro period.
- Re-link is a one-time local write and is safe *because we cancelled* — a cancelled sub isn't firing renewal webhooks we'd race.
- Re-link restores **entitlement only**, not billing. To resume paying, the user does a fresh checkout (or LS "resume" on a not-yet-expired sub) — a separate flow.

### On return after `proEntitlementEndsAt`
- Fresh **free** start (no pro carry-in). Free tombstone counters generally won't apply (they were pro), so a clean free account is correct.

### Webhook re-keying (critical)
The webhook currently trusts `custom_data.user_id` = the **old** id. After deletion/re-link that's stale. Change resolution priority to:
1. `billingSubscriptionLinks` by `subscriptionId` → `liveUserId` if present;
2. else `identitySuppressions` by `subscriptionId` → `relinkedToUserId` if present;
3. else stale `custom_data.user_id` only as a fallback for first-time webhooks.

This keeps **late refunds/chargebacks attributable** across the userId change. (Alternatively, push updated `custom_data.user_id` to LS on re-link — but the subscriptionId resolver is more robust and survives any drift.) → **Do not use a deleted user's subscription row as the retained resolver; retain a neutral `subscriptionId → tombstone/live user` link.**

### Refund after deletion
- On `subscription_payment_refunded` resolved to a tombstone: `refundCount += 1` and set `proEntitlementEndsAt = now` (revoke) — a refunded period is no longer owed, so a subsequent return gets **no** pro carry-in. Optionally tighten free grants when `refundCount > 0` (refund-abuse policy, ties to terms commit `4e86a91`).

---

## 10. Scenario matrix (incl. redeletion & sub-window cases)

Status: **Free-account scenarios A-D are covered by the implemented carry-in path.** Pro scenarios E-J are partially covered by webhook/re-link code and still need dedicated scenario tests before treating them as complete.

| # | Scenario | Outcome |
|---|---|---|
| A | **Free**, delete → return **same** window | Carry-in applies; remaining = 20 − consumed. No reset. |
| B | Free, delete → return **after** window end | Fresh 20 (window would have reset anyway). |
| C | Free, delete → return → delete → return, **all one window** | Cumulative consumed preserved each cycle (write-back rule). Never resets. |
| D | Free, **rapid multi-delete** to farm credits | Blocked — write-back is cumulative and includes carry-in. |
| E | **Pro active**, delete | LS cancelled; entitlement to `endsAt` snapshotted. Return < `endsAt` → pro restored w/ carry-in; return ≥ `endsAt` → fresh free. |
| F | Pro **already cancelled**, delete | No double-cancel; snapshot `endsAt`. |
| G | Pro, delete → return → **delete again before `endsAt`** | Re-cancel skipped (idempotent); cumulative pro+basic consumed preserved; `endsAt` unchanged. |
| H | Pro, **refund after deletion** | Webhook → tombstone via `subscriptionId`; `refundCount++`, `proEntitlementEndsAt = now`; return grants no pro. |
| I | Pro **annual** sub | `endsAt` far future w/ monthly resets; period anchoring through `endsAt` needs care — **open question §14**. |
| J | Pro **on trial**, delete | `endsAt = trialEndsAt`; return < trialEnds → remaining trial. |
| K | Family/shared payer, **different Google account** | Different `subHash`+`emailHash` → no false suppression (why LS id isn't a match key). |
| L | User **changes email** between registrations | `googleSubHash` still matches → suppression holds. |
| M | **Email/password-only** account (no Google) | Only `emailHash`; gmail normalization matters; a brand-new email evades — accepted residual risk. |

---

## 11. Guardrails on the delete action

Status: **Partially implemented.** Write gates exist across chat, uploads, image generation, imports, settings, personas, folders, threads, and credit-plan mutations. Fresh reauth and payment-state blocking are not implemented.
- Require **fresh reauth** (recent session / re-enter credential) before deletion.
- Block deletion while a **payment is pending or under dispute** (avoid mid-transaction ambiguity).
- Clear, explicit confirmation copy: what's erased, that free/pro abuse counters persist in pseudonymized form, and that a cancelled Pro sub rides out its paid period.
- Reject new writes once `accountDeletionJobs` is pending/purging. At minimum gate chat sends, file/reference uploads, image generation, imports, settings mutations, and billing checkout/resume actions.

---

## 12. Open code questions to resolve during implementation

Status: **Partially resolved.** The implementation purges both app-schema auth duplicate rows and Better Auth component rows. LemonSqueezy cancellation and `renews_at`/`ends_at` semantics still need production verification.
- Are the app-schema `session`/`account`/`verification`/`twoFactor`/`oauth*` tables (`convex/schema.ts:50-136`) **live duplicates** of the Better Auth component tables or dead? If live, cascade them; if dead, remove.
- Exact LS **cancel** API call + response shape (confirm `endsAt` semantics on cancel and on trial).
- Confirm whether `renews_at` is nulled on cancel (affects §6 pro period anchoring — see §9 "restore period bounds").

---

## 13. Privacy / legal

Status: **Implemented for minimized tombstones; retention cleanup deferred.** Tombstones store hashes and aggregate counters, not raw PII/content. Free-only tombstone pruning is intentionally not built yet.
- Store **pseudonymized hashes + minimal aggregates**, not content or raw PII. Documented **legitimate-interest / legal-obligation** basis (GDPR erasure has an explicit fraud-prevention & legal carve-out).
- Retention: free-only tombstones can be pruned once well past `freePeriodEndsAt` (e.g. a cron dropping rows where `now > freePeriodEndsAt + buffer` and `!everWasPro` and `refundCount == 0`). Pro/refund/billing records kept per accounting/tax retention (longer).

---

## 14. Open decisions / config

Status: **Still open except for free anti-reset behavior.** The stable pepper, annual-sub anchoring, refund-abuse policy, pruning policy, and Pro resume UX remain product/ops decisions.
1. Stable `IDENTITY_FINGERPRINT_PEPPER` secret and metered-usage carry-forward behavior confirmed.
2. Annual-sub monthly-reset handling (scenario I) — anchor strategy through a distant `endsAt`.
3. Refund-abuse policy: how much to restrict free grants when `refundCount > 0`.
4. Retention TTLs for tombstone pruning cron.
5. UX for a returning Pro user who wants to *resume billing* vs just consume remaining entitlement.

---

## 15. Schema + surface-area change summary

Status: **Mostly implemented.** The only notable exceptions are fresh reauth/payment blocking, full Pro edge-case validation, and pruning.
- **New table** `identitySuppressions` (+4 indexes).
- **New table** `billingSubscriptionLinks` (+2 indexes).
- **New table** `accountDeletionJobs` (+1 index).
- **New optional fields** on `prototypeCreditAccounts` (`carriedForPeriodKey`, `carriedBasicUnits`, `carriedProUnits`).
- **New shared helper** for "remaining for period" applying carry-in, used by summary + enforcement.
- **Explicit deletion orchestrator**: snapshot + tombstone before auth deletion, with Better Auth hooks only as fallback/backup.
- **Better Auth/account creation path**: seed-on-return before first quota-consuming write.
- **Deletion internal action** (cascade DB + R2 + LS cancel), idempotent/batched.
- **LS webhook resolver** change: `subscriptionId → billingSubscriptionLinks → live user/tombstone`, refund handling.
- **Delete UI** with reauth + confirmation.

---

## 16. Testing (per `docs/TEST_WRITING_GUIDE.md`)

Status: **Core coverage added.** Current tests cover fingerprinting, canonical tombstone selection, conservative merge behavior, carry-in seed behavior, carry-in enforcement/display, and webhook re-key/refund behavior. Pro scenario matrix coverage is still incomplete.
- Unit: carry-in application (matching vs non-matching periodKey), write-back cumulative rule, gmail email normalization, fingerprint match (sub OR email).
- Scenario tests A–M above (esp. C, D, G, H — the redeletion / refund cases).
- Enforcement parity: summary vs reservation path both honor carry-in.
- Idempotency: re-running a partially-failed deletion; double-cancel no-op.

---

## 17. Suggested rollout order

Status: **Through step 3 for the free anti-reset path.** Cloud dev has been pushed. Staging verification should focus on delete -> Google re-create within the same anchored window and checking that used credits are carried into the recreated account.
1. Schema (tombstone + account fields) + shared carry-in helper (no behavior change yet).
2. Deletion cascade + tombstone write + LS cancel (internal action) behind the delete UI.
3. Seed-on-return (`onCreate`) + webhook re-keying.
4. Enforcement wiring for carry-in; refund-abuse policy; pruning cron.
5. Delete UI + reauth + copy.
