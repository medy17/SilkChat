# Thread Titles

How thread titles and share questions are generated, what a good title is, and what we learned
choosing a model for them. Read this before changing the title prompt or the title model.

## Where titles come from

All generation lives in `convex/chat_http/generate_thread_name.ts`.

- **New chat:** `post.route.ts` titles a thread on its first send, while the reply streams. The
  model sees the first user message, plus the persona's opening if the persona speaks first.
- **Regenerate title:** `threads.regenerateThreadTitle` sends the full history.
- **Share question:** `generateShareQuestion` writes the question shown on shared-thread links.

Both prompts receive bounded excerpts from `getTitlePromptMessages`: the first 2 and last 4
user/assistant messages, at most 1,200 characters each. Code blocks collapse to
`[code block: lang]` and inline files to `[file: name]`.

## Model selection

`orderTitleModelCandidates` tries, in order:

1. `TITLE_MODEL_PREFERRED` (`gemini-3.1-flash-lite`)
2. the user's `titleGenerationModel` setting (no UI; defaults to Gemini)
3. `TITLE_MODEL_FALLBACKS` (`gpt-6-luna` first)

Only models with an `i3-` or `openrouter:` adapter qualify, since titles run on the app's own
keys. `titleReasoningOptions` turns reasoning off where the model allows it, otherwise uses its
lowest effort.

`firstUsableGeneration` gives each request two attempts. A model that errors, returns nothing,
or returns corrupted text (see [Junk guard](#junk-guard)) hands off to the next candidate; after
two failures the thread gets the local fallback title (persona name, or the first words of the
user's message).

## What a good title is

The chat prompt (`CHAT_TITLE_INSTRUCTIONS`) encodes this:

- **A compressed version of what the user asked, in the words they'd search for.** Sidebar
  search matches titles only (`search_title`), by whole words plus a prefix on the last word, so
  the title's words are what make a chat findable.
- **Keep the specific things:** names, products, model numbers, terms. Name a product family
  once and spend the remaining words on the actual ask. "P12 P12 Pro P12 Max Fan Comparison"
  lost both of the user's real questions (price-performance and deshrouding).
- **The user's language, script, romanized form, and spelling.** Japanese stays Japanese,
  Arabizi stays Arabizi with the user's digits ("El Far2 Bein El Zakat Wel Sada2a"), Hinglish
  stays Hinglish. Never translate. Users who write a register search in it.
- **2–6 words is a target, not a rule.** Length is the least important quality; a 7-word title
  in the user's own words beats a 5-word one in the wrong language.

The persona prompt (`PERSONA_TITLE_INSTRUCTIONS`) titles the scene for roleplay and the task for
assistant personas, and carries the same language rules (7 and 8).

### Editing the prompt

- **Examples steer more than rules.** Bland examples ("Python Data Analysis Help") produced
  bland titles from every model; a single Swahili example was enough to keep other languages in
  their own language.
- **Change one thing at a time** and compare against `production` (see [Evaluating](#evaluating)).
- **Don't repeat an instruction.** Saying "use the user's own words" in two rules made models
  copy messages nearly verbatim.
- **Literal models follow every rule, positive or negative.** "Drop filler words" plus "keep
  model numbers" is how Luna produced the P12 title. Missing rules matter just as much: models
  translated romanized input until the prompt said "Never translate".
- **Models count badly without reasoning.** Word budgets get overshot by one or two words.

## Junk guard

`convex/chat_http/title_quality.ts` (`hasJunkText`) catches corrupted output, judged against the
excerpt text the model saw:

- stray symbols (`{}_|【】`), zero-width, private-use, or unassigned characters the conversation
  doesn't contain, so `__init__` or a Persian ZWNJ the user typed passes
- a script the conversation never used (kana in a Chinese title, han in a Portuguese one)
- Latin fragments glued onto a non-Latin title when the conversation has no Latin text

Seen in evals: `ビジネスメールでの「了解しました」veys`, `Ler CSV Grande em Python_久久爱`. A cleanly
translated title is a quality issue, not junk, and passes. Deliberately mixed titles such as
"English Translation of よろしくお願いします" are flagged, which only costs a retry. Discarded
output is reported to PostHog with `errorType: "junk_output"`.

## Share questions

`buildShareQuestionPrompt` asks for 4–10 words and at most 72 characters. `normalizeShareQuestion`
enforces only the 72 characters, cutting at a word boundary. A 10-word cap used to chop fine
questions mid-phrase ("How can I cope with the end of a six-year?").

## Choosing a model (Oct 2026)

We compared Gemini 3.1 Flash Lite, GPT 6 Luna, Claude Haiku 5.5, DeepSeek V4.1 Flash, and GLM 5.3
Flash on ~100 synthetic conversations, then on the app itself.

- **Luna won every synthetic eval** (relevance, speed, cost) and **failed in real use**. The
  same message gave a great title or a silly one: on the P12 question, 2 of 5 runs gave "Arctic
  P12 Fan Price Performance and Deshroud Mod" and 3 gave "P12 P12 Pro P12 Max Fan Comparison".
  With reasoning off it also corrupted about 1 in 6 titles for one Japanese message; low
  reasoning moved the corruption elsewhere rather than removing it.
- **Gemini is consistent.** It gave "Arctic P12 Fan Performance Comparison" 5 of 5 times. It has
  strong priors: it follows the prompt's example style closely, translates to English unless
  told not to, and occasionally titles the typical question instead of the user's ("Perfecting
  Creamy Risotto Technique" for a gluey risotto).
- **Cost doesn't decide it.** The gap is about $0.05 per 1,000 titles.

Lessons:

- **Refine the prompt before swapping the model.** Gemini's blandness came from the prompt's
  examples; the prompt work fixed it, while no prompt fixed Luna's inconsistency.
- **Judge titles by their worst run, not the average.** Titles are seen constantly; one silly
  title in three is what users remember. Averages over 1–3 runs per conversation hid this.
- **Test on real first messages.** Short, curated synthetic conversations missed what real use
  surfaced within minutes.

### OpenRouter routing

Gemini latency once sat near 11.5s: OpenRouter tried Google Vertex, which returned 504 after
~10s, then fell back to AI Studio (~0.7s). The `gemini-3.1-flash-lite` entry is therefore pinned
with `preferredOpenRouterProviders: ["google-ai-studio"]` (see
[MODEL_PROVIDER_GUIDE.md](MODEL_PROVIDER_GUIDE.md)). Vertex stays an allowed fallback, the pin
applies to chat as well as titles, and only the default routing mode uses it. AI Studio Flex is
half price but best-effort; titles would need a per-call provider override to use it.

## Evaluating

`scripts/evals/title-models.ts` is an opt-in live run against OpenRouter using the app's key,
covering titles and share questions across `scripts/evals/title-models-cases.ts`: everyday
questions, coding, topic shifts, attachments, personas, math and science from basic to research,
non-Latin scripts, romanized Arabizi and Hinglish, and a `real` category of first messages that
produced bad titles in the app. Add new real failures there.

```
bun scripts/evals/title-models.ts --dry
bun scripts/evals/title-models.ts --filter=gemini --repeat=5
bun scripts/evals/title-models.ts --filter=gemini --variants=production,<candidate> --repeat=5
```

Prompt candidates go in `scripts/evals/title-prompt-variants.ts`. A full run of all models is
about 700 calls and $0.07. Results go to `temp/` as JSON and CSV.

The summary tables (relevance keywords, length, kept script, junk, latency, cost) catch outright
failures; the keyword checks are lenient. Read the **distinct outputs by case** at the end, with
`--repeat=5` or more: that's where inconsistency shows.
