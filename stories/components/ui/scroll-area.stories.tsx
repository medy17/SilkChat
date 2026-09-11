import original from "../model-selector.stories"
export { Playground } from "../model-selector.stories"
export default {
    ...original,
    title: "UI/Scroll area",
    parameters: {
        ...original.parameters,
        docs: {
            description: { component: "Open ModelSelector to use the app's scrollable model list." }
        }
    }
}
