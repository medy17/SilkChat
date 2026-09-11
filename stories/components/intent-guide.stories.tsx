import original from "./multimodal-input.stories"
export { Playground } from "./multimodal-input.stories"
export default {
    ...original,
    title: "Chat/Intent guide",
    parameters: {
        ...original.parameters,
        docs: {
            description: {
                component:
                    "The intent shortcuts are rendered inside the real composer. Choose a shortcut to inspect its guide."
            }
        }
    }
}
