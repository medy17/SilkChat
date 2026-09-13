# SilkChat landing redesign

## Accepted direction

Use the existing use cases as the standard: a meaningful large object beside a compact heading, a short sentence, and three specific points with distinct icons. The original workflow artwork, proportions, copy, and motion remain unchanged. Original pricing cards and their individual feature icons remain unchanged.

Ahmed explicitly prohibits product screenshots and rejected reused workflow artwork in the hero, a draped silver-cloth image, oversized introductory typography, forced horizontal gallery travel, and rotating closing text. None belongs to this revision. OSS must have a substantial independent section.

## Current composition

- Hero: the actual SilkChat conversation symbol, extruded into separate solid pieces. They settle together as the visitor scrolls. A compact headline, one sentence, and one action occupy a separate column.
- Models: six existing provider identities gather around the SilkChat symbol, with connecting curves. The adjacent heading and three points cover switching models, importing chats, and provider keys.
- Use cases: retain the original sticky material-specific artwork sequence and its original copy and proportions. This remains the longest expressive passage.
- Images: existing generated artwork in natural page flow, preserving its aspect ratios and existing detail dialog. Each artwork has a bounded reveal and drift; no pinned or horizontal gallery journey.
- Open source: a complete section with extruded source braces opening beside source inspection, running a deployment, and customization/contribution. Repository and actual setup guide links are prominent. No invented install commands or blanket provider privacy claims.
- Pricing: original component and distinct feature icons.
- Close: one static invitation and one action.

## Motion and responsive behavior

Hero and source geometries use separate physical meshes, procedural environment reflections, and scroll-driven rotation/separation. They settle during the middle reading interval rather than constantly spinning. Provider marks and gallery artwork also respond to scrolling. Copy remains still throughout.

The page uses natural flow except for the existing workflow sticky sequence. On narrow screens hero copy precedes the object; models and OSS put copy before their visuals; artwork uses one column; navigation has a second row. Theme variables supply colors and UI radii.

Sculptures load near the viewport and render on demand. Static SVGs remain available before loading, for reduced motion, and after WebGL failure. Reduced motion removes the new transforms and clipping. Keyboard focus reveals the complete gallery artwork.

## Verification boundary

Repository instructions prohibit browser visual verification and starting a dev server. Source, types, tests, geometry parsing, and production prerendering are checked instead. These checks do not establish visual quality, contrast, or interaction feel on a real device. No contact sheet or observed feel check is claimed.

## Rejected iteration history

The first attempt reused the workflow ribbon/prism and simplified pricing incorrectly. The next attempt introduced draped silver cloth and forced horizontal gallery travel. Ahmed rejected both; the cloth was removed from public assets. OSS was then restored alone, which prematurely stopped the wider work. This revision implements the complete scope, including a substantial OSS section.

The registry retains the earlier attempt as history. This is a correction of the same landing-page redesign under Ahmed's accepted direction, rather than a new unrelated build claiming a different fingerprint.

## Follow-up corrections

Ahmed requested restoring the original device-sized hero and silk background, making the gallery effects apparent, and eliminating props jumping into position.

- Restored `100svh` minimum height without a desktop cap or a mobile `auto` override. The header overlays the hero's reserved top space, so it does not add another navigation-height to the opening viewport.
- Restored the existing Silk shader with its light/dark motion settings and theme-derived color. It pauses offscreen or for reduced motion; theme changes still refresh a paused frame.
- Gallery artwork now unfolds from a narrower crop, expands, straightens, and drifts through a longer visible scroll interval. Image-detail interaction and natural layout remain intact.
- Sculpture scenes initialize their full pose before the first draw, reveal after a rendered frame, warm up one viewport ahead, and remain mounted. Flat SVGs are reserved for reduced motion or failure, eliminating the mismatched loading-placeholder swap. Hero scroll progress begins at zero beneath the overlaid navigation.

## Model diagram timing correction

The provider diagram now measures its own visual bounds rather than the padded section. Its assembly begins when the diagram center reaches 85% of the viewport space below navigation and finishes at 35%; it is still moving when centered. Provider translation, scale, and connections use that full interval. The same visual-relative trigger works after the text-first mobile layout. Other section timelines are unchanged.

Model timing refinement: assembly now finishes at the actual screen center (50% viewport height). The diagram holds fully assembled over the next 8vh of scrolling, then its identities disperse and the connections/center fade. Entry begins at 90% and exit completes at 10%. Copy stays still and reduced motion retains the complete diagram. This supersedes the earlier 85%-to-35% assembly window.

## Gallery composition rework

Ahmed rejected the gallery's uneven, independently animated arrangement. The current gallery places the existing jellyfish portrait across the opening's left column, with the compact heading/three points and reading-nook landscape on the right. The two square works align beneath that opening. Mobile preserves heading-first DOM order in a single column. Existing artwork was inspected directly from local files; no screenshots or generated replacements were used.

Motion is a vertical reveal inside a fixed frame with subtle image scale settling. Each reveal finishes when its figure reaches screen center. Frames and captions no longer rotate, translate, or float apart; images retain natural proportions and the existing detail dialog. Keyboard focus and reduced motion show the complete artwork. This supersedes the gallery's prior inset/tilt/drift treatment.

## Restored code demo and testimonials

Ahmed requested restoring both omitted sections with scroll-driven demos while preserving hierarchy, text density, and narrative structure. This is a targeted continuation of the accepted page, not a new creative brief.

- Code follows the existing use cases. Its original heading, paragraph, three icon points, counter source, and interactive Increment preview are preserved. Typography uses the current landing heading, copy, and point styles. The source reveals vertically before the preview settles into place; each pane measures its own bounds for the stacked mobile layout. Keyboard focus reveals the full demo and preserves the counter interaction.
- Testimonials follow the gallery. Ahmed rejected the quote-grid iteration. The original compact two-row layout is restored on desktop and mobile, with its original heading, paragraph, quotes, names, roles, and card dimensions. Vertical scrolling pans the rows in opposite directions. Repeated groups prevent empty track edges and are hidden from assistive technology. Reduced motion and keyboard focus provide manual horizontal scrolling through the original quotes, with the scrollbar hidden.
- Both sections use natural flow. The code demo finishes its entrance by screen center and remains visible afterward. Existing navigation dots now include both section anchors. No new marketing copy, section counters, prompts, or narrative stages were added.
- The prior navbar restoration, hidden scrollbar, and timed hero reveal remain in place.

## Superseded viewport-spacing attempt

Ahmed established the use-cases section as the design reference: the current section's copy and prop should occupy the reading view without neighboring sections crowding it. Feature sections now have a minimum height of one viewport and center their existing compositions vertically. Content that needs more space can grow naturally, including mobile layouts and the gallery.

The page remains one continuous scroll, with no new snapping, pinning, scroll interception, or timed pauses. The existing use-cases behavior remains unchanged. Pricing and everything below it retain their compact natural layout, as explicitly requested. Copy, typography, section order, and demo interactions remain unchanged.

## Shared stage with direct prop handoffs

Ahmed rejected the viewport-height spacing: the use-cases reference transforms between consecutive props rather than separating sections with empty space. The viewport-spacing attempt above is superseded.

The current implementation uses one sticky visual column from Models through Open source. Copy rows follow the workflow's `min(70svh, 40rem)` minimum with its existing 4rem reading padding; there is no section padding or spacer between rows. Prop transitions use the workflow's scene-relative phase and overlapping opacity windows at the shared row boundary. The existing workflow prop trajectories, materials, word reveals, and feature points are reused in that same stage. The workflow introduction stays with the first workflow copy row.

Provider assembly, the code reveal and counter, the four gallery images and lightbox, compact opposing testimonial rows, and source sculpture all read the moving copy's progress instead of the stationary visual's screen position. Only the active visual receives pointer or keyboard interaction; prop state survives scene changes. The working code demo scales to fit shorter stages instead of introducing a nested vertical scrollbar.

Narrow screens and reduced motion use compact inline compositions. The hero retains its independent timed reveal; pricing and everything below it remain in normal document flow. All existing visible copy was compared against the pre-refactor files and preserved. There is no scroll snapping or input interception.

## Alternating anchors and coordinated handoffs

Props alternate by section: Models left, Workflows right, Code left, Gallery right, Testimonials left, Open source right. The workflow introduction now has its own scene and a composition of the four existing workflow objects. That introduction and every workflow subsection inherit the same right anchor. Its original heading and paragraph are preserved.

Visual progress uses eased curves and a damped spring. Providers settle along curved paths, gallery images sharpen and straighten with a stagger instead of a linear wipe, and the code preview settles after its eased source reveal. Braces use a later arrival window, staying closed through the transition and opening while visible.

Ahmed's supplied screenshots revealed incoming props beneath outgoing text when the anchor changed sides. The handoff now has one coordinated sequence: outgoing copy clears, props crossfade, then incoming copy appears. Both sides use an 8vh transition band measured in viewport distance, independent of their row heights. This avoids mismatched windows on taller headings. Each prop is also clipped to its own column. There is no new spacer, scroll pause, or input interception.

## Current orchestration: one anchored composition

The browser review replaced independently scrolling text rows with complete centered text-and-prop compositions. Keep both columns anchored together through the readable hold. Scene tracks provide 125svh of continuous scroll travel, including roughly a viewport of fully visible reading time; do not reintroduce natural-flow copy over stationary props. Whole compositions fade out and in without simultaneous opposing-column content. The final source composition releases with the stage into pricing. Ahmed approved this direction after seeing it in the browser (“Looks better now”). See VERIFICATION.md for the observed checks.
