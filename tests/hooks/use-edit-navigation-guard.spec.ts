import { createElement } from "react"
// @vitest-environment jsdom
import { act, cleanup, render, waitFor } from "@testing-library/react"
import {
    createMemoryHistory,
    createRootRoute,
    createRoute,
    createRouter,
    RouterProvider
} from "@tanstack/react-router"
import { afterEach, expect, it, vi } from "vitest"
import { useEditNavigationGuard } from "@/hooks/use-edit-navigation-guard"

afterEach(cleanup)

async function setup(dirty: boolean) {
    const cancelEdit = vi.fn()
    let guard: ReturnType<typeof useEditNavigationGuard>
    function Editor() {
        guard = useEditNavigationGuard(dirty, cancelEdit)
        return createElement("div", null, "Editing message")
    }
    const root = createRootRoute()
    const editorRoute = createRoute({
        getParentRoute: () => root,
        path: "/thread/one",
        component: Editor
    })
    const otherRoute = createRoute({
        getParentRoute: () => root,
        path: "/thread/two",
        component: () => createElement("div", null, "Other thread")
    })
    const router = createRouter({
        routeTree: root.addChildren([editorRoute, otherRoute]),
        history: createMemoryHistory({ initialEntries: ["/thread/two", "/thread/one"] })
    })
    await act(async () => {
        await router.load()
    })
    render(createElement(RouterProvider, { router }))
    await waitFor(() => expect(guard!.status).toBe("idle"))
    return { router, cancelEdit, getGuard: () => guard! }
}

it("cancels an unchanged edit before switching threads", async () => {
    const { router, cancelEdit } = await setup(false)
    act(() => {
        router.history.push("/thread/two")
    })
    await waitFor(() => expect(router.state.location.pathname).toBe("/thread/two"))
    expect(cancelEdit).toHaveBeenCalledOnce()
})

it("keeps dirty edits on rejected navigation and allows a later confirmed switch", async () => {
    const { router, cancelEdit, getGuard } = await setup(true)
    act(() => {
        router.history.push("/thread/two")
    })
    await waitFor(() => expect(getGuard().status).toBe("blocked"))
    expect(router.state.location.pathname).toBe("/thread/one")
    expect(cancelEdit).not.toHaveBeenCalled()
    act(() => getGuard().reset?.())
    await waitFor(() => expect(getGuard().status).toBe("idle"))
    expect(router.state.location.pathname).toBe("/thread/one")

    act(() => {
        router.history.push("/thread/two")
    })
    await waitFor(() => expect(getGuard().status).toBe("blocked"))
    act(() => {
        // The shared discard dialog runs edit cleanup before resuming navigation.
        cancelEdit()
        getGuard().proceed?.()
    })
    await waitFor(() => expect(router.state.location.pathname).toBe("/thread/two"))
    expect(cancelEdit).toHaveBeenCalledOnce()
})

it("leaves the edit active for same-page hash navigation", async () => {
    const { router, cancelEdit, getGuard } = await setup(true)
    act(() => {
        router.history.replace("/thread/one#message")
    })
    await waitFor(() => expect(router.state.location.hash).toBe("message"))
    expect(getGuard().status).toBe("idle")
    expect(cancelEdit).not.toHaveBeenCalled()
})
