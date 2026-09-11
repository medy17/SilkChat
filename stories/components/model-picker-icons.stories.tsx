import original from "./model-selector.stories"
export { Open as Playground } from "./model-selector.stories"
export default {
    ...original,
    title: "Brand/Model picker icons",
    parameters: {
        ...original.parameters,
        docs: { description: { component: "Provider icons in the real model picker." } }
    }
}
