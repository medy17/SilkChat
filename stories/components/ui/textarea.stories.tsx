import original from "../multimodal-input.stories"
export { Playground } from "../multimodal-input.stories"
export default {
    ...original,
    title: "UI/textarea",
    parameters: {
        ...original.parameters,
        docs: { description: { component: "The real composer textarea inside PromptInput." } }
    }
}
