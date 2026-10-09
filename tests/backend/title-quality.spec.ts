import { describe, expect, it } from "vitest"
import { hasJunkText } from "../../convex/chat_http/title_quality"

describe("hasJunkText", () => {
    const japanese = "ビジネスメールで「了解しました」は失礼ですか？"
    const portuguese = "Como faço para ler um arquivo CSV grande em Python sem estourar a memória?"

    // Real corrupted titles from small-model evals.
    it.each([
        ["Latin fragment after Japanese", "ビジネスメールでの「了解しました」veys", japanese],
        ["stray JSON characters", 'ビジネスメールでの「了解しました」"}', japanese],
        ["stray brackets", "ビジネスメールでの「了解しました」】【。", japanese],
        ["zero-width character", "ビジネスメールでの「了解しました」‌", japanese],
        ["unassigned code point", "ビジネスメールでの「了解しました」\u{4e7ff}", japanese],
        ["a script the user never used", "Ler CSV Grande em Python_久久爱", portuguese]
    ])("flags %s", (_label, output, userText) => {
        expect(hasJunkText(output, userText)).toBe(true)
    })

    it.each([
        ["a native-script title", "ビジネスメールでの「了解しました」の使い方", japanese],
        ["a translated title", "Business Email Etiquette", japanese],
        ["a Latin-script title", "Ler CSV Grande em Python", portuguese],
        [
            "English terms the user also used",
            "إصلاح خطأ undefined في JavaScript",
            "كيف أصلح خطأ undefined is not a function في جافاسكربت؟"
        ],
        [
            "identifiers the user typed",
            "Python __init__ Method Explained",
            "what does __init__ do in python classes?"
        ],
        [
            "a ZWNJ the user also used",
            "یادگیری پایتون برای مبتدی\u200cها",
            "چطور می\u200cتوانم پایتون یاد بگیرم؟"
        ],
        [
            "a romanized title",
            "El Far2 Bein El Zakat Wel Sada2a",
            "shu el far2 bein el zakat wel sada2a?"
        ]
    ])("accepts %s", (_label, output, userText) => {
        expect(hasJunkText(output, userText)).toBe(false)
    })
})
