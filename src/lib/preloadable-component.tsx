import { type ComponentType, use, useSyncExternalStore } from "react"

export type Preloadable = {
    preload: () => Promise<unknown>
    isLoaded: () => boolean
    subscribe: (onLoad: () => void) => () => void
}

/**
 * A code-split component that can start loading before it is rendered and, once loaded,
 * renders synchronously. React.lazy always suspends on its first render even when the
 * chunk is already in memory, which flashes the Suspense fallback for a frame.
 */
export function createPreloadableComponent<Props extends object>(
    load: () => Promise<ComponentType<Props>>
) {
    let loaded: ComponentType<Props> | null = null
    let pending: Promise<ComponentType<Props>> | null = null
    const listeners = new Set<() => void>()

    const preload = () => {
        pending ??= load().then(
            (component) => {
                loaded = component
                for (const listener of listeners) listener()
                return component
            },
            (error) => {
                // A failed chunk load may succeed on the next attempt (deploy, flaky network).
                pending = null
                throw error
            }
        )
        return pending
    }

    function PreloadableComponent(props: Props) {
        const Component = loaded ?? use(preload())
        return <Component {...props} />
    }

    return {
        Component: PreloadableComponent,
        preload,
        isLoaded: () => loaded !== null,
        subscribe: (onLoad: () => void) => {
            listeners.add(onLoad)
            return () => {
                listeners.delete(onLoad)
            }
        }
    }
}

const subscribeToNothing = () => () => {}

/** Whether a preloadable's chunk has loaded, re-rendering when it does by any path. */
export function useIsPreloadableLoaded(preloadable: Preloadable | null) {
    return useSyncExternalStore(
        preloadable ? preloadable.subscribe : subscribeToNothing,
        () => preloadable?.isLoaded() ?? true,
        () => false
    )
}
