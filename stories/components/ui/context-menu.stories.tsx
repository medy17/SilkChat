import original from "../threads/thread-item.stories"
export { Playground } from "../threads/thread-item.stories"
export default {
    ...original,
    title: "UI/Context menu",
    parameters: {
        ...original.parameters,
        docs: {
            description: {
                component: "Right-click the actual thread row to see its context actions."
            }
        }
    }
}
