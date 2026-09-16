import dedent from "ts-dedent"
import type { AppSkillDefinition } from "./types"

export const recipesSkill: AppSkillDefinition = {
    id: "recipes",
    label: "Recipes",
    summary:
        "Return complete cooking recipes in SilkChat's native scalable recipe format. This is a presentation markup, not a tool call. Do not use it for passing mentions, partial suggestions, or discussion about recipes.",
    toolNames: [],
    buildInstructions: () => dedent`
## Native Recipe Format
When you provide a complete, usable cooking recipe, emit one native recipe block. This is presentation markup in the response, not a tool call. Do not use it for a passing mention, a partial suggestion, or discussion about recipes. Never wrap the block in a code fence.

Types:
- 'servings' is the positive base serving count.
- The optional recipe 'visual' attribute contains 2 to 5 concrete search keywords for the finished dish.
- 'description' is a required attribute-free tag containing one short sentence that introduces the dish. Every recipe must put it immediately after the title.
- 'qty.value' is a non-negative ASCII integer or decimal such as 2, 0.5, or 1.25. Never put a fraction glyph, unit, range, or prose in 'value'.
- 'qty.unit' is exactly one of these closed types:
  - Mass: mcg, mg, g, kg, oz, lb, stone.
  - Metric volume: ml, cl, dl, l.
  - Spoons: tsp, tbsp, tbsp-au, dsp.
  - Explicit regional volume: fl-oz-us, fl-oz-imperial, cup-us, cup-metric, cup-imperial, cup-jp, pint-us, pint-imperial, quart-us, quart-imperial, gallon-us, gallon-imperial.
  - Non-convertible quantity: count.
- Bare 'scale' opts that quantity into serving adjustment. Unmarked numbers never scale.
- 'timer.value' is one positive ISO 8601 duration such as PT45S, PT8M, or PT1H30M.
- 'ingredients', 'steps', and 'notes' are attribute-free structural tags. Keep the visible Markdown heading inside each tag and localize that heading normally. Omit 'notes' when there are no notes.
- 'step' has no attributes. Its contents are one complete cooking step and may contain qty and timer tags.
- An optional attribute-free 'visual' tag inside a step contains only 2 to 5 concrete image-search keywords.

Rules:
- Keep all user-visible wording between the tags. The attributes are canonical data; the enclosed text is the readable fallback.
- Prefer ordinary decimal notation in visible quantities too: write 1.5 tbsp rather than 1½ tbsp. Do not turn a simple decimal into a fraction.
- Use 'count' for discrete items and non-convertible expressions: cloves, eggs, chillies, pinches, sprigs, heaped spoons, culturally specific counters, or an unspecified cup. Preserve their natural wording inside the tag.
- Use a specific cup unit only when the cup standard is known. Do not guess a cup standard from the cuisine or language.
- tsp, tbsp, and dsp mean level 5 ml, 15 ml, and 10 ml measures. Use tbsp-au for a 20 ml Australian tablespoon. A heaped or otherwise non-standard spoon is count.
- Mark only ingredient amounts that scale linearly. Do not mark temperatures, pan sizes, equipment, times, "to taste", "as needed", ranges, or vague amounts.
- When a scalable amount is repeated in a step, wrap it there too so adjusted ingredients and instructions stay consistent.
- Wrap only actionable clock durations in 'timer'. Keep doneness cues outside it. Pressure-cooker whistles, heat levels, "overnight", and "until golden" are ordinary prose.
- Wrap every complete instruction in one attribute-free 'step' tag. Keep Markdown numbering outside the tag as a readable fallback; do not put several numbered instructions inside one step.
- Visual cues are broad search queries, not captions. Keep only the recognizable subject, action, or vessel; drop incidental adjectives, adverbs, serving details, and recipe prose. Write <visual>foil covered lamb roasting pan</visual>, not <visual>lamb tightly sealed under two layers of foil in a deep roasting pan</visual>.
- Add step visuals only where a picture would materially help. Use no more than three visual cues total per recipe, counting the recipe 'visual' attribute; when the finished dish has a visual, this leaves at most two step visuals. If a useful cue cannot fit in 2 to 5 keywords, omit it. Do not put instructions, URLs, or invented image references in visual cues.
- Use ordinary Markdown headings and lists inside 'recipe'. Close every tag, but if a value cannot satisfy this contract, leave that phrase as ordinary readable text instead of inventing a unit or attribute.

Compact example — localized text, scalable metric amounts, counts, a non-standard measure, a repeated step amount, timer, and visual. The ~~~ fences delimit the example only; omit them from the response:
~~~text
<recipe servings="2" visual="tomato lentil soup">
# トマトレンズ豆スープ
<description>赤レンズ豆と野菜をやさしく煮込む、手軽で温かなスープです。</description>
<ingredients>
## 材料
- <qty value="150" unit="g" scale>150 g</qty> 赤レンズ豆
- <qty value="400" unit="ml" scale>400 ml</qty> スープストック
- <qty value="3" unit="count" scale>3個</qty> じゃがいも
- <qty value="2" unit="count" scale>山盛り小さじ2</qty> 刻んだハーブ
- 塩 適量
</ingredients>
<steps>
## 手順
1. <step><qty value="400" unit="ml" scale>400 ml</qty>のスープストックを加え、<timer value="PT18M">18分</timer>煮ます。 <visual>lentil soup simmering pot</visual></step>
2. <step>塩で味を調え、温かいうちに出します。</step>
</steps>
</recipe>
~~~`
}
