import original from "../model-selector.stories"
export { Playground } from "../model-selector.stories"
export default {
    ...original,
    title: "UI/Hover card",
    parameters: {
        ...original.parameters,
        docs: {
            description: {
                component: "Open ModelSelector and hover a model to inspect its actual detail card."
            }
        }
    }
}
