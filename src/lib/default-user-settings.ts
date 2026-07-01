export const DefaultSettings = (userId: string) => ({
    userId,
    searchProvider: "firecrawl" as const,
    searchIncludeSourcesByDefault: false,
    coreAIProviders: {},
    customAIProviders: {},
    customModels: {},
    titleGenerationModel: "gemini-3.1-flash-lite-preview",
    toolCallLimitPerTurn: 3,
    customThemes: [],
    mcpServers: [],
    invertSendNewlineBehavior: false,
    imageGenerationDefaults: undefined,
    generalProviders: {
        supermemory: undefined,
        firecrawl: undefined,
        tavily: undefined,
        brave: undefined,
        serper: undefined
    },
    customization: undefined,
    onboardingCompleted: false
})
