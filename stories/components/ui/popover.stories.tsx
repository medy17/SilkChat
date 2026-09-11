import original from "../recipe-card.stories"
export { Playground } from "../recipe-card.stories"
export default {
    ...original,
    title: "UI/popover",
    parameters: {
        ...original.parameters,
        docs: {
            description: {
                component:
                    "Click an ingredient quantity to open the actual recipe conversion popover."
            }
        }
    }
}
