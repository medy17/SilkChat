import original from "../commandk.stories"
export { Playground } from "../commandk.stories"
export default {
    ...original,
    title: "UI/Command",
    parameters: {
        ...original.parameters,
        docs: { description: { component: "Actual chat-search command dialog from the sidebar." } }
    }
}
