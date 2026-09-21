import { tool } from "ai"
import { z } from "zod"
import type { ToolAdapter } from "../toolkit"
import { PerplexitySearchAdapter } from "./adapters"
import { getDeploymentSearchApiKey } from "./availability"

const dateFilterSchema = z
    .string()
    .regex(/^(0?[1-9]|1[0-2])\/(0?[1-9]|[12][0-9]|3[01])\/[0-9]{4}$/, "Use MM/DD/YYYY")

export const webSearchInputSchema = z.object({
    query: z
        .union([z.string().min(1), z.array(z.string().min(1)).min(1).max(5)])
        .describe("One focused query, or up to five related queries for a multi-angle search"),
    searchType: z
        .enum(["web", "people"])
        .optional()
        .describe(
            "Leave unset for web search. Use people only for individual employee profiles, career history, or work-related candidate matching—not general public figures or leadership news"
        ),
    country: z
        .string()
        .regex(/^[A-Z]{2}$/)
        .optional()
        .describe(
            "Set only when the user requests regional results or geography is essential; ISO 3166-1 alpha-2, such as US or DE"
        ),
    maxResults: z
        .number()
        .int()
        .min(1)
        .max(50)
        .optional()
        .describe("Leave unset unless the user requests a result count or the task needs one"),
    contextSize: z
        .enum(["low", "medium", "high"])
        .optional()
        .describe("Leave unset normally; set only when extraction depth materially matters"),
    maxTokens: z
        .number()
        .int()
        .min(1)
        .max(1_000_000)
        .optional()
        .describe("Leave unset normally; use only for precise extraction budgeting"),
    maxTokensPerPage: z
        .number()
        .int()
        .min(1)
        .max(1_000_000)
        .optional()
        .describe("Leave unset normally; use only for precise per-page extraction budgeting"),
    languages: z
        .array(z.string().regex(/^[a-z]{2}$/))
        .min(1)
        .max(20)
        .optional()
        .describe("Set only when the user requests a language boundary; ISO 639-1 codes"),
    domains: z
        .array(
            z
                .string()
                .min(1)
                .max(253)
                .refine(
                    (domain) =>
                        /^-?(?:[a-z0-9](?:[a-z0-9.-]*[a-z0-9])?(?:\/[^\s]*)?|\.[a-z]{2,})$/i.test(
                            domain
                        ),
                    "Use a domain or domain/path without a protocol"
                )
        )
        .min(1)
        .max(20)
        .optional()
        .describe(
            "Set only for an explicit or necessary site boundary—not merely to seek reliable sources. Domains or paths allowlisted normally or denylisted with -"
        ),
    publishedAfter: dateFilterSchema
        .optional()
        .describe("Set only for a necessary exact publication boundary"),
    publishedBefore: dateFilterSchema
        .optional()
        .describe("Set only for a necessary exact publication boundary"),
    updatedAfter: dateFilterSchema
        .optional()
        .describe("Set only for a necessary exact last-updated boundary"),
    updatedBefore: dateFilterSchema
        .optional()
        .describe("Set only for a necessary exact last-updated boundary"),
    recency: z
        .enum(["hour", "day", "week", "month", "year"])
        .optional()
        .describe("Set only when a relative publication window is materially needed")
})

export const WebSearchAdapter: ToolAdapter = async (params) => {
    if (!params.enabledTools.includes("web_search")) return {}
    if (!params.toolAvailability.web_search.enabled) return {}

    const apiKey = getDeploymentSearchApiKey()
    if (!apiKey) return {}

    return {
        web_search: tool({
            description:
                "Use only after loading Web Search, and only for an explicit web request, time-sensitive facts, external datasets or records needed for analysis, requested citations, or professional people lookups. Do not use for stable factual questions merely because they are niche, technical, unfamiliar, or worth verifying. Start with one query and no optional refinements; narrow only when the user requests a boundary or a broad search proves insufficient.",
            inputSchema: webSearchInputSchema,
            execute: async ({
                query,
                searchType = "web",
                country,
                maxResults,
                contextSize,
                maxTokens,
                maxTokensPerPage,
                languages,
                domains,
                publishedAfter,
                publishedBefore,
                updatedAfter,
                updatedBefore,
                recency
            }) => {
                try {
                    const search = new PerplexitySearchAdapter({ apiKey })
                    const exactDateFilterSelected = Boolean(
                        publishedAfter || publishedBefore || updatedAfter || updatedBefore
                    )
                    const hasAllowedDomains = domains?.some((domain) => !domain.startsWith("-"))
                    const normalizedDomains = hasAllowedDomains
                        ? domains?.filter((domain) => !domain.startsWith("-"))
                        : domains
                    const response = await search.search(query, {
                        searchType,
                        limit: maxResults ?? 8,
                        country,
                        contextSize,
                        maxTokens: contextSize ? undefined : (maxTokens ?? 4000),
                        maxTokensPerPage: contextSize ? undefined : (maxTokensPerPage ?? 600),
                        languageFilter: languages,
                        domainFilter: normalizedDomains,
                        publishedAfter,
                        publishedBefore,
                        updatedAfter,
                        updatedBefore,
                        recency: exactDateFilterSelected ? undefined : recency
                    })

                    return {
                        success: true,
                        query,
                        searchType,
                        results: response.results,
                        count: response.results.length,
                        ...(response.id ? { requestId: response.id } : {}),
                        ...(response.serverTime !== undefined
                            ? { serverTime: response.serverTime }
                            : {})
                    }
                } catch (error) {
                    console.error("Web search error:", error)
                    return {
                        success: false,
                        error: error instanceof Error ? error.message : "Unknown error occurred",
                        query,
                        results: []
                    }
                }
            }
        })
    }
}
