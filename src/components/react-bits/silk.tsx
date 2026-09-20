import { lazy, Suspense } from "react"
import type { SilkProps } from "./silk-canvas"

const SilkCanvas = lazy(() => import("./silk-canvas"))

export function Silk(props: SilkProps) {
    return (
        <Suspense fallback={<div className={props.className} aria-hidden="true" />}>
            <SilkCanvas {...props} />
        </Suspense>
    )
}

export default Silk
