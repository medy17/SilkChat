export const DefaultSettings = (userId: string) => ({
    userId,
    coreAIProviders: {},
    customAIProviders: {},
    customModels: {},
    titleGenerationModel: "gemini-3.1-flash-lite",
    toolCallLimitPerTurn: 3,
    customThemes: [],
    mcpServers: [],
    invertSendNewlineBehavior: false,
    imageGenerationDefaults: undefined,
    generalProviders: {
        supermemory: undefined
    },
    customization: undefined,
    onboardingCompleted: false
})
