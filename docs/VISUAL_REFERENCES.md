# Visual references and image search

`<visual>` represents one image. `<carousel>` groups images and specifies how the group is populated. `image_search` supplies independent candidates for model inspection.

```html
<carousel mode="quick-look" query="snow leopard winter" title="Snow leopards"></carousel>

<carousel mode="referential" title="Compare their markings">
  <visual reference="img_runA_2" title="Winter coat"></visual>
  <visual reference="img_runB_1" title="Summer coat"></visual>
</carousel>

<visual reference="img_runA_2" title="A closer look"></visual>
```

Quick-look resolves a query once after generation, independently of the visible title. It has no children; the model has not inspected those images during that reply. Referential carousels contain discrete visual references in display order and never search. Each group is a card; it can combine different searches and retained images from earlier turns. A standalone visual reference displays one image. Child titles are optional display labels and do not overwrite publisher titles or attribution. The existing adaptive gallery layout is retained; the container does not introduce slideshow controls.

There are at most three standalone blocks and three distinct images per block. Recipe steps accept one reference or a quick-look carousel; the finished-dish recipe `visual` attribute remains supported. Unknown or empty references never fall back to a search. Only retained referential selections are available across turns; unused candidates are temporary. Quick looks are display-only, excluded from image inputs, the reference index, and later reference resolution. Tool outputs supply IDs and image inputs during the loop. The suffix reference index refreshes on the next user turn. It is omitted when empty or when the model cannot call tools; labels are quoted, length-bounded, collapsed to one line, and marked as untrusted data.

## Compatibility and review expectations

Image-search activity uses the same grouped, collapsible Spotlight panel as Web Search, with its image icon, loading state, query headings, result counts, and attributed source links. Multiple tool calls appear in one activity group. Temporary candidates are not automatically rendered as answer images or re-fetched from the activity panel after expiry. Only the model's selected references appear in answer cards. A persisted response error owns its retry control; the same failure is not repeated below the response.

Hovering or focusing a card title reveals its search term. Referential groups show the distinct originating queries of their selected images, including across turns. Each captured image persists its originating `searchQuery`.

Legacy `<visual title="Heading">search keywords</visual>` remains readable. Both new and old quick-look forms normalize to the existing selection keys, so persisted images require no migration or new search. Existing recipe cues are also retained. Replies predating saved selections still require the explicit load action below.

Containers are parsed before children. During streaming, an unfinished carousel is held as one unit; its completed child tags must not become separate cards or searches. Fenced examples remain ordinary code. Missing/unknown modes, missing queries, and quick-look containers with children do not trigger searches. A referential container never uses a query as fallback, including when every child reference is invalid. Nested carousels are unsupported. Check these failure cases alongside legacy remounts, saved-key equivalence, cross-turn grouping, and independent child captions/attribution.

When streaming ends with an unclosed carousel, the remaining content is rendered as ordinary Markdown, including subsequent headings and prose. Its child tags do not become independent searches. Branches, shared snapshots, shared forks, and imports preserve completed selections but turn copied `pending` status into `failed`, because their original resolver jobs cannot update the copies. Stream finalization releases its own lock even when the terminal message write is rejected; it neither schedules visuals for that rejected write nor clears a newer stream's lock.

## Execution and persistence

Brave calls and image capture run in Convex Node actions. Generation finalization schedules quick-look resolution and promotion of selected tool results. Quick looks prefer Brave's cached thumbnails, capture at most three images concurrently per search, and store directly in the durable prefix because their selections are already final. Two cards can resolve concurrently, and each finished card is published immediately; another slow card does not hold it back. Saved message metadata contains ordered `visualSelections`, attribution, dimensions, stable IDs, and durable URLs. Renderers read this metadata and never call the search API on mount. Legacy messages offer an explicit load action; opening old conversations does not spend quota.

Search executions are deduplicated transactionally by the actual assistant document ID and request key before charging the existing allowance of 30 searches per 10 minutes. A replay does not charge again. There is no new global search cache or forced bypass of Brave/CDN/browser caches. Failed selections do not silently retry on reload. A watchdog ends pending UI state if resolution stalls.

Candidates for model inspection are captured in `tool-outputs/<userId>/image-search/<runId>/<slot>.webp` on the configured public R2 host. This makes model-facing URLs independent of publisher CORS, robots rules, and hotlink restrictions. The captured image is bounded to 1536 pixels and 1 MiB. Original downloads are HTTPS-only, byte-limited, DNS-pinned to public IPv4 addresses, and revalidated at redirects. Each source has one deadline covering DNS and redirects (five seconds for quick looks, twelve for inspection); quick-look downloads also share a twenty-second search deadline.

Tool output uses the SDK's typed file content with `mediaType: "image/webp"` and a tagged URL. This must serialize to an OpenRouter `image_url` block, not a document upload. The deprecated `image-url` tool output loses the MIME subtype and is incorrectly routed as a document by the current adapter. A wire-contract regression test covers the real SDK and provider conversion. A live check with `openai/gpt-6.1-sol-20260929` successfully inspected an existing staged Beelzebufo reconstruction and described visible details, including its scale bar.

Selected bytes are promoted unchanged to `image-search/<userId>/<runId>/<slot>.webp`. These are the same pixels supplied to the model. Attribution retains the source page, source label, title, and original image URL. Cards link to source pages. Markdown exports include durable images and source links. Account exports and Files include durable selections. Temporary candidates are excluded from Files and expire after 24 hours through scheduled cleanup, backed by an hourly sweep. Both roots have R2 author metadata and participate in account deletion.

Expiry cleanup removes quick-look run records without any staging metadata queries or slot deletes. Tool runs probe the eight staging slots and only schedule deletion for slots with metadata, including captures missing from an interrupted run's final asset list. Uploads share one account-deletion check per search, and promotions share one per message resolution; these checks run at the first write. Final persistence retains its transactional account-deletion checks.

Next-turn vision context includes model-selected referential images and their reference labels, not quick-look images or expired candidate URLs. Selected images can also be used as SilkScreen references. No extra `generated-context` copy is needed because search captures are already bounded for inference.

All retained model-selected historical images continue to be attached on later vision turns. Each SilkScreen generation keeps its own prompt label even when the same reply also contains selected search images. Selecting a durable search reference requires the current user's `image-search/<userId>/` prefix. Forks borrow the original owner's images read-only: they can be shown and reused in new cards, but are never copied into the forking user's prefix or offered as SilkScreen references. Copied and imported selections keep only `image-search/` images with https sources and rebuild their URLs from the key. Durable URLs are rebuilt from the storage key.

The stream finish event carries pending visual state after backend finalization. A stale history snapshot cannot remove that state or replace completed visuals with pending ones. A card keeps placeholders while its gallery width is first measured, avoiding an empty frame during the handoff. Review transitions from streaming to pending, partial card completion, and ready, as well as completion in a different order from the markup.

## Brave response fields

The [Image Search API reference](https://api-dashboard.search.brave.com/api-reference/images/image_search) describes the search endpoint and response. The implementation requests 12 results with worldwide country selection and strict safe search, then attempts at most eight candidates to obtain up to six inspectable images. Quick looks select up to three, or one for a recipe step.

| Field | Use |
| --- | --- |
| `properties.url` | Preferred for inspection and a quick-look fallback; preserved as original URL |
| `thumbnail.src` | Preferred for quick looks; Brave-hosted fallback for inspection |
| `url` | Publisher page for attribution |
| `source`, `title` | Attribution and untrusted model-facing labels |
| `properties.width`, `properties.height` | Early size filter; actual decoded dimensions determine acceptance and layout |
| `confidence` | Passed to the inspecting model; quick looks require high/medium, steps high |
| `page_fetched` | Source crawl metadata retained with candidates |
| `query.altered` | Reported corrected query |
| `query.show_strict_warning` | Reported safe-search warning |
| `extra.might_be_offensive` | Reject flagged response |

Live checks used snow leopard camouflage, shuwa wrapped in banana leaves, and Hagia Sophia's dome. Confidence varied sharply by query, high-confidence stock photos appeared, and publisher URLs sometimes pointed to thumbnails. Confidence is not evidence of visual relevance. The inspection tool may examine low-confidence candidates; its instructions require rejecting misleading, watermarked, or irrelevant images.

The public R2 host was checked with a temporary upload: public download returned the same bytes and its robots file allowed the relevant inference crawlers. This does not replace provider-specific end-to-end testing. Browser verification is intentionally left to the user because the application is auth-gated.
