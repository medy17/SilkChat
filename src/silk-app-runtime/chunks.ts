/**
 * Heavy modules apps load on demand, one file per chunk. Each chunk is built from its
 * imports and provides the listed registry keys, each set to a binding from those
 * imports. Read by modules.ts and scripts/build-silk-app-runtime.mjs.
 */
export const SILK_APP_CHUNKS = {
    lucide: {
        imports: ['import * as lucide from "lucide-react"'],
        provides: { "lucide-react": "lucide" }
    },
    three: {
        imports: [
            'import * as THREE from "three"',
            'import { OrbitControls } from "three/addons/controls/OrbitControls.js"'
        ],
        provides: { three: "THREE", "three/addons": "{ OrbitControls }" }
    },
    d3: {
        imports: ['import * as d3 from "d3"'],
        provides: { d3: "d3" }
    }
} as const satisfies Record<
    string,
    { imports: readonly string[]; provides: Readonly<Record<string, string>> }
>
