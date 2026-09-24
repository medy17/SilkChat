import { createLucideIcon } from "lucide-react"

// Travel modes Lucide does not ship, drawn on its 24px grid so they share stroke
// width and caps with the rest of the scene gutter.

// Horse and unicorn heads from Lucide Lab (ISC, lucide-icons/lucide-lab).
export const HorseHead = createLucideIcon("horse-head", [
    ["path", { d: "M11.5 12H11", key: "horse-eye" }],
    [
        "path",
        {
            d: "M5 15a4 4 0 0 0 4 4h7.8l.3.3a3 3 0 0 0 4-4.46L12 7c0-3-1-5-1-5S8 3 8 7c-4 1-6 3-6 3",
            key: "horse-head"
        }
    ],
    ["path", { d: "M6.14 17.8S4 19 2 22", key: "horse-neck" }]
])

export const UnicornHead = createLucideIcon("unicorn-head", [
    ["path", { d: "m15.6 4.8 2.7 2.3", key: "unicorn-horn-band" }],
    ["path", { d: "M15.5 10S19 7 22 2c-6 2-10 5-10 5", key: "unicorn-horn" }],
    ["path", { d: "M11.5 12H11", key: "unicorn-eye" }],
    [
        "path",
        {
            d: "M5 15a4 4 0 0 0 4 4h7.8l.3.3a3 3 0 0 0 4-4.46L12 7c0-3-1-5-1-5S8 3 8 7c-4 1-6 3-6 3",
            key: "unicorn-head"
        }
    ],
    ["path", { d: "M2 4.5C4 3 6 3 6 3l2 4", key: "unicorn-mane" }],
    ["path", { d: "M6.14 17.8S4 19 2 22", key: "unicorn-neck" }]
])

// Flying saucer from Lucide Lab (ISC, lucide-icons/lucide-lab).
export const Ufo = createLucideIcon("ufo", [
    ["path", { d: "M18 8c0 1-3 2-6 2S6 9 6 8a6 6 0 0 1 12 0", key: "ufo-dome" }],
    ["path", { d: "M7 13h.01", key: "ufo-light-left" }],
    ["path", { d: "M12 14h.01", key: "ufo-light-middle" }],
    ["path", { d: "M17 13h.01", key: "ufo-light-right" }],
    [
        "path",
        {
            d: "M6 8.1c-2.4 1-4 2.6-4 4.4 0 3 4.5 5.5 10 5.5s10-2.5 10-5.5c0-1.8-1.6-3.4-4-4.4",
            key: "ufo-hull"
        }
    ],
    ["path", { d: "m7 22 2-4", key: "ufo-leg-left" }],
    ["path", { d: "m17 22-2-4", key: "ufo-leg-right" }]
])

// A membrane wing reads as dragon, wyvern, or drake where feathered wings do not.
export const DragonWing = createLucideIcon("dragon-wing", [
    ["path", { d: "M4 19C7 12 12 6.5 21 4", key: "dragon-wing-arm" }],
    [
        "path",
        {
            d: "M21 4c-1 4-1 7 0 10-2-1.5-4-1-5 1-1-2-3-2.5-5-1.5 0-2-1.5-3.5-3.5-3",
            key: "dragon-wing-membrane"
        }
    ],
    ["path", { d: "M21 4l-5 11", key: "dragon-wing-finger-outer" }],
    ["path", { d: "M21 4l-10 9.5", key: "dragon-wing-finger-inner" }]
])

export const Carriage = createLucideIcon("carriage", [
    ["path", { d: "M4 14V7a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v7", key: "carriage-cabin" }],
    ["path", { d: "M3 14h15l3-3", key: "carriage-shaft" }],
    ["path", { d: "M8 8h5v3H8z", key: "carriage-window" }],
    ["circle", { cx: "7", cy: "18", r: "3", key: "carriage-wheel-rear" }],
    ["circle", { cx: "16", cy: "18.5", r: "2.5", key: "carriage-wheel-front" }]
])
