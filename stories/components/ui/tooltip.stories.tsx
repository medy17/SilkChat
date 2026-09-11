import original from "../image-cost-indicator.stories"
export { Playground } from "../image-cost-indicator.stories"
export default {
    ...original,
    title: "UI/Tooltip",
    parameters: {
        ...original.parameters,
        docs: {
            description: {
                component:
                    "Hover or focus the image cost indicator used in image-generation estimates."
            }
        }
    }
}
