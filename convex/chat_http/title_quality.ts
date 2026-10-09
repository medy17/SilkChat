// Detects corrupted title-model output so the caller can retry with another model.
// Small models occasionally derail mid-title, e.g. a Portuguese title ending in "_久久爱" or a
// Japanese one ending in "」veys". These checks stay narrow: a cleanly translated title is a
// quality issue, not corruption, and is left alone.

// Letter ranges per script; punctuation is excluded, so a Dhivehi "؟" doesn't count as Arabic.
const SCRIPTS = {
    latin: /[A-Za-z]/,
    kana: /[぀-ヿ]/,
    han: /[㐀-䶿一-鿿]/,
    hangul: /[ᄀ-ᇿ㄰-㆏가-힯]/,
    arabic: /[ؠ-يٮ-ۓۺ-ۿݐ-ݿ]/,
    thaana: /[ހ-ޥ]/,
    devanagari: /[ऀ-ॣॱ-ॿ]/,
    thai: /[ก-ฺเ-๎]/
}
export type TitleScript = keyof typeof SCRIPTS

export const scriptsIn = (text: string) =>
    new Set(
        (Object.entries(SCRIPTS) as [TitleScript, RegExp][]).flatMap(([name, re]) =>
            re.test(text) ? [name] : []
        )
    )

// Symbols, zero-width, private-use, and unassigned characters that small models leak into titles.
const STRAY_CHARACTERS = /[{}_|【】\u200b-\u200d\u2060\ufeff\ue000-\uf8ff]|[\u{40000}-\u{10ffff}]/gu

// Junk: stray characters the user never typed (so `__init__` and Persian ZWNJ pass), a script
// the user never used (kana in a Chinese title, han in a Portuguese one), or Latin fragments
// glued onto a non-Latin title the user wrote without Latin. `allowScripts` permits deliberate
// switches.
export const hasJunkText = (output: string, userText: string, allowScripts: string[] = []) => {
    const strays = output.match(STRAY_CHARACTERS) ?? []
    if (strays.some((character) => !userText.includes(character))) return true
    const user = new Set<string>(scriptsIn(userText))
    for (const script of allowScripts) user.add(script)
    const out = scriptsIn(output)
    if ([...out].some((script) => script !== "latin" && !user.has(script))) return true
    const nonLatinShared = [...out].some((script) => script !== "latin" && user.has(script))
    return nonLatinShared && out.has("latin") && !user.has("latin")
}
