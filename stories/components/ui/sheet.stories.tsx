import original from "../threads-sidebar.stories"
export { Playground } from "../threads-sidebar.stories"
export default {
    ...original,
    title: "UI/sheet",
    parameters: {
        ...original.parameters,
        docs: {
            description: {
                component:
                    "The real sidebar uses Sheet on mobile. Reduce the preview width to inspect it."
            }
        }
    }
}
