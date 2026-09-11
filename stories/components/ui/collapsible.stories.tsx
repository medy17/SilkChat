import original from "../threads/folder-item.stories"
export { Playground } from "../threads/folder-item.stories"
export default {
    ...original,
    title: "UI/Collapsible",
    parameters: {
        ...original.parameters,
        docs: { description: { component: "Actual sidebar folder expansion." } }
    }
}
