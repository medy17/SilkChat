import { expect, it, vi } from "vitest"
import { dispatchComposerDrop, registerComposerDropTarget } from "@/lib/composer-drop"
it("routes drops to the last active surface within the matching chat", () => {
    const compose = vi.fn(),
        edit = vi.fn(),
        other = vi.fn()
    const main = registerComposerDropTarget("chat", { kind: "compose", receive: compose })
    const editor = registerComposerDropTarget("chat", { kind: "edit", receive: edit })
    const second = registerComposerDropTarget("other", { kind: "compose", receive: other })
    dispatchComposerDrop("chat", [])
    expect(edit).toHaveBeenCalledOnce()
    main.activate()
    dispatchComposerDrop("chat", [])
    expect(compose).toHaveBeenCalledOnce()
    expect(other).not.toHaveBeenCalled()
    editor.activate()
    editor.unregister()
    dispatchComposerDrop("chat", [])
    expect(compose).toHaveBeenCalledTimes(2)
    main.unregister()
    second.unregister()
})
