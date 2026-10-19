# Commit Conventions

Adopted 2026-10-19.

This is the standard for every commit. Commits from the one that adds this file onward
follow it and can be used as examples; find that commit with
`git log --diff-filter=A -- docs/COMMIT_CONVENTIONS.md`. Earlier commits weren't written to
it, though many recent ones match it. Use an earlier commit as an example only where it
follows the rules below.

## Title

Say what the commit does, then what that fixes, changes, or achieves.

    Overhaul math rendering so equations stop breaking apart
    Redesign the import dialog around files and outcomes
    Stop a workspace when the history that requested it is rewritten

- Imperative mood, sentence case, no trailing period, no type prefix, no length limit.
- The leading verb signals the kind and scale of the change:

  | Verb | Use for |
  |---|---|
  | Add | a new feature, model, or capability |
  | Redesign | a UI rework |
  | Overhaul / Replace | a subsystem rework or swap |
  | Keep / Stop / Show / Let / Ask… | a fix, phrased as the corrected behaviour |
  | Simplify / Flatten / Align | cleanup with no new behaviour |
  | Restructure | a refactor with no user-visible change |
  | Update / Pin | dependencies, content, legal pages |
  | Remove | deleting a feature, model, or dependency |
  | Tell the model… | prompt and tool-description changes |
  | Document | docs-only changes |

- Scale wins over trigger: an overhaul prompted by a bug is still titled as an overhaul.
- Describe the outcome, not the problem. Not "Fix X" or "X was broken".

## Body

- Fixes: first say what went wrong and why (cause → what the user saw), then what happens
  now.
- Features, redesigns, overhauls: start with what users see, then one paragraph per
  secondary area (API changes, moved files, new docs).
- Past tense for old behaviour, present tense for new.
- Give the reason for any non-obvious decision. Note what deliberately didn't change.
- Name code identifiers only when they help a future reader of the code.
- Prose. Bullets only for independent exceptions, such as pinned dependencies.
- Don't mention tests, validation, deploys, or process, and don't write "this commit".
- Trivial changes get a title only.

## Templates

Placeholders are in `<angle brackets>`, optional parts in `[square brackets]`.

### Bug fix

    <Keep/Stop/Show/…> <corrected behaviour> <where or when>

    <What went wrong, its cause, and what the user saw.>

    <What happens now. Anything deliberately left as is.>

Example:

    Keep typing working on Android after sending a message

    Clearing the composer replaced the editor state wholesale, which skipped
    syncing the keyboard's EditContext. The keyboard kept the sent text, and
    whatever was typed next was lost until the composer was refocused.

    Clearing is now a regular edit that also starts a fresh undo history.

### Feature

    Add <feature> <to/in where> [so <outcome>]

    <What users can now do and how it behaves.>

    <Secondary areas, one paragraph each: settings, API, docs.>

Example:

    Add Shift-click range selection to the sidebar so threads can be picked in bulk

    In selection mode, Shift-clicking a thread selects or clears every visible
    thread between it and the last one clicked, following the rendered order so
    threads inside folders are included. Esc leaves selection mode.

    Both shortcuts are listed in the shortcut help.

### UI redesign

    Redesign <surface> around <organizing idea>

    <What was wrong with the old layout, concretely.>

    <The new layout as users see it, top to bottom.>

    <Behaviour changes that came with it. What is unchanged.>

Example:

    Redesign the workspace card around a cover and a model-written title

    Every workspace card was titled "Persistent workspace" and used an icon
    tile, badge, and footer band unlike any other generated content.

    The card now leads with a cover showing the runtime, with one pill for the
    budget, countdown, or outcome, and the remaining time draining along its
    edge. Settled cards grey out and drop their actions.

    The model now gives each workspace a 2–5 word title. Cards without one fall
    back to the runtime name.

### Subsystem overhaul or replacement

    Overhaul <subsystem> so <outcome>
    Replace <old system> with <new system> [so <outcome>]

    <Why the old design failed or no longer fit.>

    <The new design: what users notice, then how it's structured.>

    <Migration and compatibility: data, settings, existing threads. What's unchanged.>

    <Docs added or moved.>

Example:

    Overhaul math rendering so equations stop breaking apart

    Replies render block by block, so display math broke apart when one of its
    lines looked like Markdown: "+ 2x" became a bullet, "=" a heading, and a
    blank line inside an aligned block split the equation.

    Display math in every delimiter style is now rewritten as a $$ block kept
    inside its list item or blockquote, and is closed while it streams.
    Single-dollar math follows Pandoc's rule, so prices like "$100-$200" stay
    text.

    Inline $$…$$ written mid-sentence still renders inline, as before.

### Dependency update (bulk)

    Update dependencies to their latest compatible versions

    Bumps <n> packages, including the majors for <pkg major>, <pkg major>.

    - <pkg> stays on <version>: <reason>.
    - <pkg> is pinned to <version>: <what breaks on newer>.
    - <integration> adapts to <pkg>'s <change>.

Example:

    Update dependencies to their latest compatible versions

    Bumps 98 packages, including the majors for vitest 5, mermaid 12, and
    motion 14.

    - better-auth stays on 1.6: @convex-dev/better-auth requires <1.7.
    - @vercel/og is pinned to 1.0.1: later releases crash /api/og under Node ESM.
    - Mermaid diagrams keep the dagre layout and classic look that version 12
      no longer defaults to.

### Dependency update (targeted)

    Update <pkg> to <version> [so <outcome>]
    Pin <pkg> to <version> so <what keeps working>

    <Why this package, why now. Code that adapted to it.>

Example:

    Pin @vercel/og to 1.0.1 so link previews keep rendering

    Versions 1.0.2 and 1.0.3 crash under Node ESM with a dynamic require of
    "fs", which takes down /api/og.

### Model addition

    Add <Model Name> [and <Model Name>] to the model registry

    <Provider and routing, e.g. pinned providers and why.>

    <Capabilities enabled, and any forced on or off as the provider advertises.>

    <Neighbouring entries touched, e.g. predecessor's description shortened.>

Example:

    Add GPT 6.1 Sol to the model registry

    Routed through OpenRouter with vision, native PDF input, tool calling, and
    adjustable reasoning. Reasoning can't be turned off, matching the provider.

    GPT 6 Sol's picker description now points to 6.1 as the newer option.

### Model metadata update

    Update <Model Name>'s <pricing/capabilities/description> [to match <source>]

    <What changed and where the new values come from.>

Example:

    Update Gemini 3.8 Flash's pricing to match Google's new rates

### Legacy marking

    Move <Model Name> to legacy models [now that <successor> replaces it]

    <Why it's superseded. It stays callable from the legacy picker, and
    existing threads keep using it.>

Example:

    Move GPT 6 Sol to legacy models now that GPT 6.1 Sol replaces it

    It stays selectable under legacy models, and threads already using it
    keep doing so.

### Sunsetting

    Sunset <Model Name> on <YYYY-MM-DD> in favor of <Replacement>

    <Source of the date. What users see before and after it, and where
    existing threads migrate.>

Example:

    Sunset GPT 6 Sol on 2026-12-01 in favor of GPT 6.1 Sol

    OpenAI retires the endpoint on that date. Until then it stays selectable;
    afterwards threads on it continue with GPT 6.1 Sol.

### Model removal

    Remove <Model Name> from the model registry

    <Why now. What happens to threads and saved settings that referenced it.>

Example:

    Remove GPT-5.1 and GPT-5.2 from the model registry

    Both passed their sunset dates, and their threads already continue on
    GPT 6.1 Sol.

### Feature removal

    Remove <feature> [now that / since <reason>]

    <Why it's going. What users lose, and what's left behind (data, settings).>

Example:

    Remove the MCP integration since no model path uses it anymore

    Saved MCP server settings are left in place but no longer read.

### Prompt or tool-description change

    Tell the model to <behaviour> [when <situation>]

    <What the model did wrong and what the user saw.>

    <What the prompt or tool description now says, and where.>

Example:

    Tell the model to wait for skill loads before calling their tools

    A skill's tools become callable only in the step after load_skill returns.
    The model called them in the same step, got an unavailable-tool error, and
    told the user the tools didn't exist.

    The skill index and load_skill description now say to wait for the load
    and to retry afterwards instead of giving up.

### Refactor (no user-visible change)

    Restructure <area> [so <developer-facing outcome>]

    <What moved and why.>

Example:

    Restructure the math normalizer into its own module so it can grow its rules

### Docs only

    Document <topic> [in <file>]

Example:

    Document commit conventions in docs/COMMIT_CONVENTIONS.md

### Revert

    Revert "<original title>"

    <Why: what the original broke, and what replaces it, if anything.>
