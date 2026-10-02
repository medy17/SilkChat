type Target = { kind: "compose" | "edit"; receive: (files: File[]) => void }
const targets = new Map<string, Map<symbol, Target>>()
const active = new Map<string, symbol>()
export function registerComposerDropTarget(scope: string, target: Target) {
    const id = Symbol()
    const group = targets.get(scope) ?? new Map<symbol, Target>()
    group.set(id, target)
    targets.set(scope, group)
    if (target.kind === "edit" || !active.has(scope)) active.set(scope, id)
    return {
        activate: () => active.set(scope, id),
        unregister: () => {
            group.delete(id)
            if (active.get(scope) === id) active.delete(scope)
            if (!group.size) targets.delete(scope)
        }
    }
}
export function dispatchComposerDrop(scope: string, files: File[]): boolean {
    const group = targets.get(scope)
    const target =
        group?.get(active.get(scope)!) ??
        [...(group?.values() ?? [])].find((target) => target.kind === "compose")
    if (!target) return false
    target.receive(files)
    return true
}
