# User impersonation

Authorized operators can open **Impersonate user** below **Sign Out** in their account menu.
Submit a full email address, auth ID, or legacy app user ID to look up one account,
then review its avatar, name, ID, recorded last activity, and subscription before
choosing **Continue as this user**. **Back** allows another selection. The preview
uses matching skeletons while loading; typing and opening the dialog make no requests.
Email and legacy ID lookups use existing indexes; auth IDs use direct document reads. While impersonating, the same menu item becomes
**Return to my account**, which restores the original session. Impersonation uses the customer's real data and permissions;
messages, edits, and usage charges apply to that account. Browser-only settings on the
customer's own device are not available.

## Access

Set `AUTH_IMPERSONATION_USER_IDS` on each Convex deployment to a comma-separated list
of Better Auth user document IDs. These are auth `_id` values, not the optional legacy
application `userId`. Resolve the operator's verified email in the deployment's
`betterAuth` component before configuring it. IDs differ between deployments.

The allowlist defaults to empty. Staff flags, billing bypasses, and an `admin` role do
not grant access. The server permits only exact account lookup, starting impersonation, and
returning to the original account. Other admin-plugin operations remain disabled.
Operator/admin accounts cannot be impersonated, and sessions cannot nest impersonation.
Returning still works if the original operator is removed from the allowlist while
impersonating, provided their original session is still valid.

Better Auth's impersonation session expires after one hour. Its signed cookie retains
the original session for the return operation. Once the impersonation session expires,
sign in again if the return control is no longer available.

## Package patch

`patches/@convex-dev+better-auth+0.12.5.patch` extends the existing package component.
It adds optional `role`, `banned`, `banReason`, and `banExpires` user fields, plus the
optional session field `impersonatedBy`. Existing records do not need a backfill.
It also adds admin schema metadata to the component adapter's auth options and updates
the shipped type declarations. Most of the patch is generated API declaration repetition.
The component registration and existing tables remain in place.

Both Better Auth packages are pinned. `postinstall` applies patches with
`--error-on-fail`, so a failed patch stops installation. On an upgrade, update the
patch against the new package, inspect its schema and adapter changes, and run:

```sh
bun install
bun run check-types
bun run test
```

Verify patch application in a fresh installation too. Do not remove added schema fields
as a rollback after sessions/users have begun storing them. Disable access by clearing
the allowlist while retaining the optional fields.

## Account switching

The server expires the cached Convex JWT cookie after either switch. Account views
unmount before the request; a full navigation resets queries, router state, in-memory
stores, and Convex subscriptions. Other open tabs receive a storage event and reload.
Drafts and account-specific browser preferences are saved separately per auth ID.
Query caches and last-opened routes are cleared. The same boundary handles subsequent
sign-out or sign-in to avoid restoring the wrong account's browser state.

`tests/backend/impersonation.spec.ts` runs the real Better Auth HTTP handler against
the patched, shipped Convex component in `convex-test`. It verifies legacy sessions,
exact lookup and confirmation details, authorization, token signatures and identities, cookie invalidation, session cleanup,
and returning to the original account. Storage and component tests cover draft
restoration, blocking stale account views, network failures, and other open tabs.

After backend changes, use `bun run cloud:dev:push` for cloud development. Staging and
production must use the repository's normal synchronized deployment commands.
