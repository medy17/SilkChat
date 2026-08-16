# Hosted Memory Setup

SilkChat treats Supermemory as deployment infrastructure, not as a user-connected account.
Users never enter a Supermemory API key and their existing personal Supermemory memories are not
imported.

## Supermemory account and dashboard model

Create the deployment key in the Supermemory Developer Platform organization that should own
SilkChat's data and billing. The API describes settings, API keys, storage, and reset operations at
the organization level. A personal Supermemory product account is therefore not a second memory
store that SilkChat should try to synchronize with; it is only relevant if it is also the account
through which the deployment organization and API key are administered.

SilkChat uses one organization API key on the server. Each SilkChat user is isolated with a stable,
opaque `containerTag`, following Supermemory's documented multi-tenant container pattern. The raw
SilkChat user ID is never sent to Supermemory.

References:

- [Authentication and organization API keys](https://supermemory.ai/docs/authentication)
- [Container tags for user isolation](https://supermemory.ai/docs/concepts/filtering)
- [Organization settings](https://supermemory.ai/docs/api-reference/settings/get-settings)
- [V4 memory management](https://supermemory.ai/docs/api-reference/memories)

## Environment

Configure these values in every Convex deployment:

```text
SUPERMEMORY_API_KEY=sm_...
SUPERMEMORY_CONTAINER_PREFIX=silkchat
```

`SUPERMEMORY_CONTAINER_PREFIX` is part of the stable per-user container identity. Set it once per
environment and do not change it after launch unless intentionally starting a new, empty memory
namespace. The key must belong to an organization where it has permission to delete container tags,
because account deletion removes the user's complete hosted-memory container.

Use the repository's environment sync commands to publish the values to cloud dev, staging, and
production. Do not expose either value through a `VITE_` variable.

## Product behavior

- Memory is enabled by default for new and existing browsers.
- The composer Tools flyout remains the turn-by-turn control; turning Memory off excludes it from
  that message's prompt and tool set and prevents that completed turn from being ingested.
- Enabled turns retrieve the user's profile and query-relevant memories before generation. After a
  successful visible response, SilkChat incrementally ingests the user/assistant turn under a
  stable, opaque per-thread `customId` with dynamic dreaming.
- Explicit add, update, and forget requests remain confirmation-card actions. A turn that creates
  one of these cards is not also ingested automatically, so confirmation cannot be bypassed.
- `/settings/memory` lists, adds, edits, and forgets memories in the signed-in user's container.
- Existing BYOK settings are ignored. There is no memory migration or cross-account synchronization.
- Account exports include `memory/memories.json`.
- Account deletion deletes the user's Supermemory container before removing authentication data.

The schema temporarily retains the legacy per-user key field so existing Convex documents remain
valid. Application reads mask that field, and ordinary settings saves clear it. No bulk data
migration is required.
