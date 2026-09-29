# Settings Loading States

Every Settings section loads the same way: its header shows at once, a skeleton shaped like the
real content fills the body, and the content replaces it without shifting. After the first load,
the skeleton never comes back for a change the user made.

## Owners

| Piece | Owner |
| --- | --- |
| `SettingsSkeleton` wrapper and shared primitives (`SkeletonSectionHeading`, `SkeletonField`, `SkeletonCardRow`) | `src/components/settings/settings-skeletons.tsx` |
| Per-section skeletons (`AccountSettingsSkeleton`, `MemoryListSkeleton`, etc.) | `src/components/settings/settings-skeletons.tsx` |
| Base `Skeleton` bar | `src/components/ui/skeleton.tsx` |
| Sign-in gate for all sections | `src/routes/settings/route.lazy.tsx` |
| Memory list patches (`prependMemories`, `replaceMemory`, `removeMemory`) | `src/lib/memory.ts` |

Read the owner for current shapes. This guide records the rules.

## Rules

**The header is never a skeleton.** `SettingsLayout` titles and descriptions are static, so the
section renders them immediately. Only data-dependent regions become skeletons. The settings shell
gates on sign-in only. It does not wait for user settings, because a shared gate shows a generic
placeholder before every section's own skeleton.

**Skeletons mirror the layout.** Use the same `Card`, grid, and row structure as the loaded
content, so nothing jumps when data arrives. Build from the shared primitives. Add a new
per-section skeleton to `settings-skeletons.tsx` rather than inline in the route.

**Wrap in `SettingsSkeleton`.** It gives screen readers one `role="status"` with a label and hides
the bars themselves. Pass a label such as "Loading personas".

**Spinners are for actions only.** A `Loader2` belongs in a button while a save or delete is in
flight. First loads never use spinners, "Loading…" text, or a bare `Skeleton` bar.

**Theme radii only.** `Skeleton` uses `rounded-md`, which resolves to `--radius-md`. Override with
theme radii (`rounded-[var(--radius-lg)]`) or `rounded-full` for avatars and switches.

**Don't imply data you don't have.** A default like `plan = "free"` must not render as fact while
loading. Billing, for example, hides the current-plan highlight and up/downgrade buttons until the
billing summary arrives.

**Mutations keep content mounted.** After the first load, a user action must not bring the
skeleton back.

- Convex queries (`useQuery`, `useConvexQuery`) update reactively, so this holds automatically.
- Queries that change arguments (the Files filters, the Usage timeframe) show the skeleton for data
  not seen before. Usage uses `convex-helpers/react/cache`, so revisiting a timeframe is instant.
- Pages fed by actions rather than reactive queries, like Memory, must manage this by hand. See
  below.

## Section map

| Section | Skeleton | Waits on |
| --- | --- | --- |
| Account | `AccountSettingsSkeleton`, `SessionListSkeleton` | Auth session, session list |
| AI Setup | `ProviderListSkeleton`, `ModelListSkeleton` | User settings |
| Personalization | `PersonalizationSettingsSkeleton` | User settings |
| Memory | `MemoryListSkeleton` | Tool availability, first list page |
| Personas | `PersonasSettingsSkeleton` | Built-in and user personas |
| Look & Feel | `ThemeGridSkeleton`, `ComposerSettingSkeleton` | Imported theme fetches; user settings for the desktop composer row (haptics is local) |
| Files | `FilesTableSkeleton` | File list page |
| Privacy | `PrivacySettingsSkeleton` | User settings |
| Usage | `UsageDashboardSkeleton` | Usage stats and chart data |
| Billing | Inline `Skeleton` in plan buttons and plan title | Billing summary, credit summary |

## Files pagination

The All files view uses an opaque cursor over the R2 component's
`bucket_author_lastModified` index, descending for Newest and ascending for Oldest.
Its metadata-only query is maintained in
`patches/@convex-dev+r2+0.10.2.patch`; it returns no signed URLs and bounds each read to
512 rows / 2 MiB, including rows skipped by the visibility filter. Pending uploads and
non-user-visible storage prefixes remain excluded. A bounded empty page can still have
a continuation, so it must not be treated as exhaustion.

Files and Library share `src/lib/cursor-pagination.ts`. Files prefetches only the next All files
page, keeping the current page mounted until it is ready. Cursor history is scoped by account,
filter, sort, and page size. Reloading a later All files page without history restarts at page one.
Explicit type filters retain their full-inventory offset query and are not
prefetched. Backend deployment must include the patched component and its index.

## Memory list

`/settings/memory` reads from Supermemory through the `listMemories` action, so it has no reactive
subscription. The page owns the loaded page in local state.

- **First load** shows `MemoryListSkeleton`.
- **Page changes** keep the current list on screen, dimmed and `aria-busy`, until the next page
  arrives.
- **Add, edit, and forget** keep the dialog in its "Saving…" or "Forgetting…" state until the
  refetched page arrives, then swap it in with one state update.

The single swap matters on a full page. The page holds 20 memories. Deleting one locally leaves
19 until the refetch pulls the next memory up from page 2, so a card pops in at the bottom. Adding
one locally shows 21 until the refetch drops the last one. Editing moves the memory to the top,
because the list sorts by `updatedAt`. Waiting for the refetch makes each of these one change.

The patches in `src/lib/memory.ts` are applied to the refetched page. They do nothing when that
page already reflects the change. They cover a Supermemory list that lags a write, so a forgotten
memory can't reappear and a new one can't go missing. If the refetch fails, the patch is applied
to the current page instead. Patches that change the count trim the page to its `limit` and
recompute `totalPages`, so pagination never offers an empty next page. A successful refetch also
clears an earlier load error.

Stale responses are dropped by request id, so a slow earlier page can't overwrite a newer one.

Two edge cases:

- Adding from a page other than 1 jumps to page 1, where new memories appear.
- Forgetting the only memory on a later page steps back one page.
