# Usage Limits

How hosted usage is metered and capped, and how operators reset it. Read this before changing
limits, credit periods, reservations, or usage resets.

Hosted usage is anything SilkChat pays for: models on the app's own keys, image generation, and
deployment-funded tools. BYOK and custom-provider requests are not counted.

## Limits

Each plan has two caps, in US dollars:

- **5-hour window:** `HOSTED_USAGE_5H_USD_FREE` / `HOSTED_USAGE_5H_USD_PRO`
- **Monthly period:** `HOSTED_USAGE_MONTHLY_USD_FREE` / `HOSTED_USAGE_MONTHLY_USD_PRO`

The fallbacks in `convex/lib/usage_metering.ts` are only for local work. Deployments set their own
values, so read the Convex environment rather than the code for the real limits. Amounts are
stored as micro-USD (1,000,000 per dollar).

Users with `userAccess.bypassLimits` skip both caps. Tool-call counts have their own limit and
their own bypass, `bypassToolCallLimits`.

## Windows and periods

- **5-hour window:** starts at the first spend after the previous window ended, and lasts five
  hours. It isn't a rolling window: once it ends, the next spend starts a fresh one.
- **Monthly period:** Pro periods are anchored to the Lemon Squeezy subscription's `renewsAt`.
  Free periods are anchored to `prototypeCreditAccounts.creditPeriodAnchorAt`, falling back to the
  account's creation time. Every usage row carries the `periodKey` of the period it was made in.

Because Free and Pro periods have different keys, changing plan starts a fresh month.

## What counts

`getHostedUsageState` in `convex/credits.ts` adds up the current period's:

- settled usage events (`prototypeCreditEvents` with `accountingKind: "usage"`)
- active usage reservations (`prototypeCreditReservations`)
- the unspent remainder of active tool-call budgets (`prototypeToolCallReservations`)
- usage carried in from a deleted account in the same period (see
  [Account Deletion](./ACCOUNT_DELETION.md#usage-carry-forward))

A settled event keeps its reservation's `createdAt`, so a message counts from when it started.

Computer storage is a background charge: `chargeComputerStorage` adds a daily event with
`pricingSource: "storage_reported"`. It counts toward the month only, so it can't open or fill a
5-hour window. It's never refused, so storage can take an account over its monthly limit, which
stops new usage until the period ends and leaves files alone. The computer's storage limit is a
separate rule, covered in [Code Execution Architecture](./CODE_EXECUTION_ARCHITECTURE.md).

## Where limits are enforced

Every check goes through `getHostedUsageState`, called from `evaluateHostedUsageReservation`:

- `reserveCreditForMessage` before a model call
- `reserveToolCallBudget` before a turn's tool calls
- `consumeReservedToolCall` when a call goes past its reserved budget

`getMyCreditUsageSummary` feeds the usage meter from the same function, so the meter and
enforcement always agree. The chat readiness check doesn't look at usage.

A request is refused when its reservation would take either window over its cap. Reservations
estimate the prompt plus up to `HOSTED_USAGE_OUTPUT_RESERVE_TOKENS` (default 4,096) reply tokens
at the model's price. Models without price data fall back to
`HOSTED_USAGE_UNKNOWN_INPUT_USD_PER_1M` and `HOSTED_USAGE_UNKNOWN_OUTPUT_USD_PER_1M`. So a long
request can be refused before the window is full, especially in the Free 5-hour window. The
refusal reports which window was hit and when it recovers.

## Usage resets

Operators can give usage back. Code is in `convex/usage_resets.ts`, with the pure rules in
`convex/lib/usage_resets.ts`.

### Kinds

- **5-hour:** clears the 5-hour window.
- **Weekly:** forgives up to a quarter of the monthly limit (`WEEKLY_RESET_FRACTION`).
- **Monthly:** clears the monthly period.

Weekly and monthly resets can also clear the 5-hour window (`includesFiveHour`).

A reset is either **instant**, applied when it's granted, or a **Banked Reset** the user redeems
from the usage popover or a limit error. Banked Resets expire after 1, 3 (default) or 6 months, or
never, and can be revoked until used. Revoking a global one only takes it back from people who
haven't used it.

### Breakpoints

A reset never deletes usage. It sets a breakpoint, and usage before it stops counting. Billing
history and settlement are untouched.

- **5-hour and monthly:** usage before the breakpoint is ignored. A monthly breakpoint also drops
  carried usage.
- **Weekly:** forgives up to its fraction of the current monthly limit, taken only from usage
  that existed before it. Redeeming early can't bank headroom, and two weekly resets can't
  forgive the same usage twice.
- Breakpoints from before the current period are ignored, and a monthly breakpoint supersedes
  earlier weekly ones.

`computeMonthlyUsedMicrousd` applies them. The 5-hour breakpoint feeds the window calculation
alongside the dev credit lab's window boundary.

### Where breakpoints live

- **Per-user resets and redemptions** are written to the credit account
  (`usageResetFiveHourAt`, `usageResetMonthlyAt`, `usageResetWeekly`), which every usage check
  already reads.
- **Global instant resets** stay as `usageResetGrants` rows. `resolveUsageBreakpoints` reads them
  with one indexed lookup from the start of the period, instead of writing to every account.

### Who gets a global reset

A global grant has an optional plan filter and a signup cutoff (`signedUpBefore`). The cutoff
defaults to, and can't be later than, the time of the grant, so people who sign up later never
qualify. The plan filter is checked against the user's current plan, so a "Free only" Banked
Reset disappears if its holder upgrades before using it.

### When a Banked Reset is usable

`isResetUsable` only allows a redeem once a window the reset clears is used past the plan's line
in `USAGE_RESET_USABLE_AT`: 70% on Free, 85% on Pro. A bundle needs only one of its windows
there. Free is lower because one long request is a large share of its small 5-hour window and
can be refused well before the limit (see above). The dialog shows "Usable at N% used" until
then.

### Notices and impersonation

An instant reset shows a one-time notice. The account's `usageResetNoticeSeenAt` records the
newest one seen. Users without a credit account have never used anything, so they don't get
one.

A session where an operator is viewing as the user can't redeem Banked Resets or use up the
notice (`convex/lib/impersonation_session.ts`).

### Account deletion

The deletion snapshot applies the same breakpoints, so deleting and re-creating an account can't
bring back usage a reset cleared. `mergeSuppressedUsageMicrousd` keeps the higher total across
repeated deletions, except when a reset came after the earlier one. Unused Banked Resets are
forfeited. Details in [Account Deletion](./ACCOUNT_DELETION.md#usage-carry-forward).

### Operator surfaces

- **One account:** the Usage step of its moderation profile (`/settings/moderation`) shows its
  usage, unused Banked Resets, the grant form, and its reset history.
- **Everyone:** the operator-only Usage Resets page (`/settings/usage-resets`), with plan and
  signup-date filters and the global reset history.

Both are gated by `canImpersonate`, like moderation.

## Dev tools

The dev credit lab in the usage popover sets the plan, access flags, and preset usage states
(5-hour near or at the limit, month near or at the limit, and a 5-hour window reset). See
[Dev Tools Guide](./DEV_TOOLS_GUIDE.md). The dev sidebar can open the usage reset notice.

## Code map

- `convex/credits.ts`: periods, usage state, reservations, enforcement, dev credit lab
- `convex/lib/usage_metering.ts`: limits, price fallbacks, reservation estimates
- `convex/lib/credits.ts`: period bounds and keys
- `convex/usage_resets.ts`: grant, revoke, redeem, Banked Reset lists, notices
- `convex/lib/usage_resets.ts`: breakpoint maths, eligibility, usability thresholds
- `convex/lib/usage_reset_state.ts`: merging account and global breakpoints, signup cutoffs
- `src/components/credits/prototype-credits.tsx`: usage popover and settings card
- `src/components/credits/usage-reset-tickets-dialog.tsx`: Banked Resets dialog
- `src/components/moderation/usage-reset-controls.tsx`: operator grant form and history

## Tests

- `tests/backend/credits-module.spec.ts`: windows, caps, reservations, dev credit lab
- `tests/backend/usage-resets.spec.ts`: breakpoints, eligibility, grants, redemption, revoking,
  notices, impersonation, and the deletion snapshot
