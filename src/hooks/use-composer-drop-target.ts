import { useCallback, useEffect, useRef } from "react"
import { registerComposerDropTarget } from "@/lib/composer-drop"
export function useComposerDropTarget(
    scope: string,
    kind: "compose" | "edit",
    receive: (files: File[]) => void,
    enabled = true
) {
    const receiveRef = useRef(receive)
    receiveRef.current = receive
    const targetRef = useRef<ReturnType<typeof registerComposerDropTarget> | null>(null)
    useEffect(() => {
        if (!enabled) return
        const target = registerComposerDropTarget(scope, {
            kind,
            receive: (files) => receiveRef.current(files)
        })
        targetRef.current = target
        return () => {
            target.unregister()
            targetRef.current = null
        }
    }, [scope, kind, enabled])
    return useCallback(() => targetRef.current?.activate(), [])
}
