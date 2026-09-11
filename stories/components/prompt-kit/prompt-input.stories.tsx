import original from "../multimodal-input.stories"
export { Playground } from "../multimodal-input.stories"
export default {
    ...original,
    title: "Chat/Prompt input",
    parameters: {
        ...original.parameters,
        docs: {
            description: {
                component:
                    "Actual PromptInput composition from MultimodalInput, with its textarea and toolbar."
            }
        }
    }
}
