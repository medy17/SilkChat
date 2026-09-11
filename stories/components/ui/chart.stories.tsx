import original from "../renderers/native-chart-tool.stories"
export { Playground } from "../renderers/native-chart-tool.stories"
export default {
    ...original,
    title: "UI/Chart",
    parameters: {
        ...original.parameters,
        docs: {
            description: {
                component:
                    "The actual chart renderer uses ChartContainer and theme-based series colors."
            }
        }
    }
}
