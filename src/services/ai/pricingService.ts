import { requestUrl } from "obsidian";
import { Logger } from "../../utils/logger";

/**
 * OpenRouter API model response structure
 */
interface OpenRouterModel {
    id: string;
    pricing?: {
        prompt?: string | number;
        completion?: string | number;
    };
}

/**
 * OpenRouter Generation API usage data structure
 */
interface OpenRouterUsageData {
    data?: {
        native_tokens_prompt?: number;
        native_tokens_completion?: number;
        tokens_prompt?: number;
        tokens_completion?: number;
        total_cost?: number | string;
        usage?: number | string;
    };
}

/**
 * Service for fetching and managing AI model pricing data
 * Fetches real-time pricing from OpenRouter API and falls back to embedded rates
 */
export class PricingService {
    /**
     * Fetch pricing from OpenRouter API (covers all models including OpenAI, Anthropic)
     */
    static async fetchPricingFromOpenRouter(): Promise<
        Record<string, { input: number; output: number }>
    > {
        try {
            const response = await requestUrl({
                url: "https://openrouter.ai/api/v1/models",
                method: "GET",
            });

            if (response.status !== 200) {
                Logger.warn(
                    "Failed to fetch pricing from OpenRouter:",
                    response.status,
                );
                return {};
            }

            const data = response.json;
            const pricing: Record<string, { input: number; output: number }> =
                {};

            // Parse OpenRouter models response
            if (data.data && Array.isArray(data.data)) {
                data.data.forEach((model: OpenRouterModel) => {
                    if (model.id && model.pricing) {
                        // OpenRouter returns pricing per token, convert to per million tokens
                        const promptCost = parseFloat(
                            String(model.pricing.prompt || 0),
                        );
                        const completionCost = parseFloat(
                            String(model.pricing.completion || 0),
                        );

                        if (promptCost > 0 || completionCost > 0) {
                            pricing[model.id] = {
                                input: promptCost * 1000000, // Convert to per million
                                output: completionCost * 1000000, // Convert to per million
                            };

                            // Also add without provider prefix for direct matching
                            const modelName = model.id.split("/").pop();
                            if (modelName) {
                                pricing[modelName] = {
                                    input: promptCost * 1000000,
                                    output: completionCost * 1000000,
                                };
                            }
                        }
                    }
                });
            }

            Logger.debug(
                `Fetched pricing for ${Object.keys(pricing).length} models from OpenRouter`,
            );
            return pricing;
        } catch (error) {
            Logger.error("Error fetching pricing from OpenRouter:", error);
            return {};
        }
    }

    /**
     * Get embedded fallback pricing (2025 rates from official sources)
     * Includes latest models: Claude Sonnet 4, GPT-4o series, and more
     * All prices are per 1 million tokens
     */
    static getEmbeddedPricing(): Record<
        string,
        { input: number; output: number }
    > {
        return {
            // OpenAI models (as of 2025)
            // GPT-4o series
            "gpt-4o": { input: 2.5, output: 10.0 },

            // GPT-4o-mini series
            "gpt-4o-mini": { input: 0.15, output: 0.6 },

            // GPT-4 Turbo series
            "gpt-4-turbo": { input: 10.0, output: 30.0 },

            // GPT-4 series
            "gpt-4": { input: 30.0, output: 60.0 },

            // GPT-3.5 series
            "gpt-3.5-turbo": { input: 0.5, output: 1.5 },

            // O1 series
            o1: { input: 15.0, output: 60.0 },
            "o1-mini": { input: 3.0, output: 12.0 },

            // Anthropic models (as of 2025)
            // Claude Sonnet 4 series (latest)
            "claude-sonnet-4": { input: 3.0, output: 15.0 },

            // OpenRouter format (with provider prefix)
            // OpenAI via OpenRouter (includes OpenRouter markup)
            "openai/gpt-4o": { input: 2.5, output: 10.0 },
            "openai/gpt-4o-mini": { input: 0.15, output: 0.6 },
            "openai/gpt-5-mini": { input: 0.25, output: 2.0 }, // OpenRouter markup
            "openai/gpt-4-turbo": { input: 10.0, output: 30.0 },
            "openai/gpt-4": { input: 30.0, output: 60.0 },
            "openai/gpt-3.5-turbo": { input: 0.5, output: 1.5 },
            "openai/o1": { input: 15.0, output: 60.0 },
            "openai/o1-mini": { input: 3.0, output: 12.0 },

            // Anthropic via OpenRouter
            "anthropic/claude-sonnet-4": { input: 3.0, output: 15.0 },
            "meta-llama/llama-3.1-405b-instruct": { input: 2.7, output: 2.7 },
            "meta-llama/llama-3.1-70b-instruct": { input: 0.35, output: 0.4 },
            "meta-llama/llama-3.1-8b-instruct": { input: 0.05, output: 0.08 },
            "meta-llama/llama-3.2-90b-vision-instruct": {
                input: 0.9,
                output: 0.9,
            },
            "google/gemini-pro-1.5": { input: 1.25, output: 5.0 },
            "google/gemini-flash-1.5": { input: 0.075, output: 0.3 },
            "mistralai/mistral-large-2411": { input: 2.0, output: 6.0 },
            "mistralai/mistral-small": { input: 0.2, output: 0.6 },
            "qwen/qwen-2.5-72b-instruct": { input: 0.35, output: 0.4 },
            "deepseek/deepseek-chat": { input: 0.14, output: 0.28 },
        };
    }

    /**
     * Get pricing for a specific model, checking cache first, then embedded rates
     * Uses provider-prefixed format for accurate OpenRouter lookup
     */
    static getPricing(
        model: string,
        provider: "openai" | "anthropic" | "openrouter" | "ollama",
        cachedPricing: Record<string, { input: number; output: number }>,
    ): { input: number; output: number } | null {
        // Ollama is always free
        if (provider === "ollama") {
            Logger.debug(`[Pricing] Ollama model ${model}: $0.00 (local)`);
            return { input: 0, output: 0 };
        }

        // Construct OpenRouter format: "provider/model"
        // This gives us the most accurate pricing from OpenRouter's database
        const openRouterFormat = this.constructOpenRouterModelId(
            provider,
            model,
        );

        Logger.debug(
            `[Pricing] Looking up: model="${model}", provider="${provider}", openRouterFormat="${openRouterFormat}"`,
        );

        // Try OpenRouter format first (most accurate)
        if (cachedPricing[openRouterFormat]) {
            Logger.debug(
                `[Pricing] ✓ Found exact match in cache: ${openRouterFormat} ($${cachedPricing[openRouterFormat].input}/$${cachedPricing[openRouterFormat].output} per 1M)`,
            );
            return cachedPricing[openRouterFormat];
        }

        // Try exact model name match in cache
        if (cachedPricing[model]) {
            Logger.debug(
                `[Pricing] ✓ Found model in cache: ${model} ($${cachedPricing[model].input}/$${cachedPricing[model].output} per 1M)`,
            );
            return cachedPricing[model];
        }

        // Try embedded pricing with OpenRouter format
        const embedded = this.getEmbeddedPricing();
        if (embedded[openRouterFormat]) {
            Logger.debug(
                `[Pricing] ✓ Using embedded rate for: ${openRouterFormat} ($${embedded[openRouterFormat].input}/$${embedded[openRouterFormat].output} per 1M)`,
            );
            return embedded[openRouterFormat];
        }

        // Try exact model name in embedded pricing
        if (embedded[model]) {
            Logger.debug(
                `[Pricing] ✓ Using embedded rate for: ${model} ($${embedded[model].input}/$${embedded[model].output} per 1M)`,
            );
            return embedded[model];
        }

        // Fallback: Try partial match in cache (case insensitive)
        const modelLower = model.toLowerCase();
        for (const [key, value] of Object.entries(cachedPricing)) {
            if (
                key.toLowerCase().includes(modelLower) ||
                modelLower.includes(key.toLowerCase())
            ) {
                Logger.debug(
                    `[Pricing] ✓ Found partial match in cache: ${key} for ${model} ($${value.input}/$${value.output} per 1M)`,
                );
                return value;
            }
        }

        // Last resort: Try partial match in embedded pricing
        for (const [key, value] of Object.entries(embedded)) {
            if (
                key.toLowerCase().includes(modelLower) ||
                modelLower.includes(key.toLowerCase())
            ) {
                Logger.debug(
                    `[Pricing] ✓ Found partial match in embedded: ${key} for ${model} ($${value.input}/$${value.output} per 1M)`,
                );
                return value;
            }
        }

        Logger.warn(
            `[Pricing] ✗ No pricing found for: ${model} (provider: ${provider}, tried: ${openRouterFormat})`,
        );
        return null;
    }

    /**
     * Construct OpenRouter model ID from provider and model name
     * Examples:
     *   openai + "gpt-4o-mini" → "openai/gpt-4o-mini"
     *   anthropic + "claude-sonnet-4-20250514" → "anthropic/claude-sonnet-4-20250514"
     *   openrouter + "openai/gpt-4o" → "openai/gpt-4o" (already has prefix)
     */
    private static constructOpenRouterModelId(
        provider: "openai" | "anthropic" | "openrouter" | "ollama",
        model: string,
    ): string {
        // If model already has a slash, it's likely already in OpenRouter format
        if (model.includes("/")) {
            return model;
        }

        // Map provider to OpenRouter prefix
        const providerPrefix: Record<string, string> = {
            openai: "openai",
            anthropic: "anthropic",
            openrouter: "", // OpenRouter models already have provider prefix
            ollama: "", // Ollama is local
        };

        const prefix = providerPrefix[provider];
        if (!prefix) {
            return model; // Return as-is if no prefix
        }

        return `${prefix}/${model}`;
    }

    /**
     * Check if pricing cache needs refresh (older than 24 hours)
     */
    static shouldRefreshPricing(lastUpdated: number): boolean {
        const ONE_DAY = 24 * 60 * 60 * 1000; // 24 hours in milliseconds
        return Date.now() - lastUpdated > ONE_DAY;
    }

    /**
     * Get human-readable time since last update
     */
    static getTimeSinceUpdate(lastUpdated: number): string {
        if (lastUpdated === 0) {
            return "Never (using embedded rates)";
        }

        const diff = Date.now() - lastUpdated;
        const hours = Math.floor(diff / (60 * 60 * 1000));
        const days = Math.floor(hours / 24);

        if (days > 0) {
            return `${days} day${days > 1 ? "s" : ""} ago`;
        } else if (hours > 0) {
            return `${hours} hour${hours > 1 ? "s" : ""} ago`;
        } else {
            return "Just now";
        }
    }

    /**
     * Fetch actual token usage and cost from OpenRouter's generation API
     * OpenRouter provides accurate usage data via their generation endpoint
     *
     * @param generationId - The generation ID from the streaming response
     * @param apiKey - OpenRouter API key
     * @param retryCount - Current retry attempt (for internal use)
     * @param useFetch - Use native fetch() instead of requestUrl() (for different contexts)
     */
    static async fetchOpenRouterUsage(
        generationId: string,
        apiKey: string,
        retryCount = 0,
        useFetch = false,
    ): Promise<{
        promptTokens: number;
        completionTokens: number;
        actualCost?: number;
    } | null> {
        const maxRetries = 2;
        const retryDelay = 1500; // 1.5 seconds

        try {
            if (useFetch) {
                // NOTE: Using native fetch() for non-Obsidian contexts (e.g., testing).
                // For Obsidian plugins, requestUrl is preferred (see else branch below).
                // eslint-disable-next-line @typescript-eslint/no-unsafe-call
                const response = await fetch(
                    `https://openrouter.ai/api/v1/generation?id=${generationId}`,
                    {
                        headers: {
                            Authorization: `Bearer ${apiKey}`,
                        },
                    },
                );

                if (!response.ok) {
                    if (response.status === 404 && retryCount < maxRetries) {
                        Logger.debug(
                            `[OpenRouter] Generation API returned 404 (attempt ${retryCount + 1}/${maxRetries + 1}), retrying in ${retryDelay}ms...`,
                        );
                        await new Promise((resolve) =>
                            setTimeout(resolve, retryDelay),
                        );
                        return this.fetchOpenRouterUsage(
                            generationId,
                            apiKey,
                            retryCount + 1,
                            useFetch,
                        );
                    }

                    Logger.warn(
                        `[OpenRouter] Generation API returned ${response.status} after ${retryCount + 1} attempts`,
                    );
                    return null;
                }

                const data = await response.json();
                return this.parseOpenRouterUsageData(data);
            } else {
                // Use requestUrl (for Obsidian context)
                const response = await requestUrl({
                    url: `https://openrouter.ai/api/v1/generation?id=${generationId}`,
                    method: "GET",
                    headers: {
                        Authorization: `Bearer ${apiKey}`,
                    },
                });

                if (response.status !== 200) {
                    Logger.warn(
                        `[OpenRouter] Generation API returned ${response.status}`,
                    );
                    return null;
                }

                return this.parseOpenRouterUsageData(response.json);
            }
        } catch (error) {
            // Check if it's a 404 error (data not ready yet) and retry
            const is404 =
                error.toString().includes("404") ||
                error.toString().includes("Not Found");

            if (is404 && retryCount < maxRetries) {
                Logger.debug(
                    `[OpenRouter] Generation API returned 404 (attempt ${retryCount + 1}/${maxRetries + 1}), retrying in ${retryDelay}ms...`,
                );
                await new Promise((resolve) => setTimeout(resolve, retryDelay));
                return this.fetchOpenRouterUsage(
                    generationId,
                    apiKey,
                    retryCount + 1,
                    useFetch,
                );
            }

            Logger.warn(
                `[OpenRouter] Failed to fetch generation data after ${retryCount + 1} attempts: ${error instanceof Error ? error.message : String(error)}`,
            );
            return null;
        }
    }

    /**
     * Parse OpenRouter Generation API response data
     * Extracts token counts and actual cost from the API response
     */
    private static parseOpenRouterUsageData(data: OpenRouterUsageData): {
        promptTokens: number;
        completionTokens: number;
        actualCost?: number;
    } | null {
        Logger.debug(`[OpenRouter] ✓ Generation API response received`);
        Logger.debug(
            `[OpenRouter] Raw generation data: ${JSON.stringify(data.data)}`,
        );

        // Check response structure
        if (!data || !data.data) {
            Logger.warn(
                `[OpenRouter] ⚠️ Invalid response structure: ${JSON.stringify(data)}`,
            );
            return null;
        }

        // OpenRouter Generation API returns tokens directly in data.data
        // Prefer native_tokens (provider-specific) over normalized tokens
        const promptTokens =
            data.data.native_tokens_prompt ?? data.data.tokens_prompt ?? 0;
        const completionTokens =
            data.data.native_tokens_completion ??
            data.data.tokens_completion ??
            0;

        Logger.debug(
            `[OpenRouter] Extracted tokens - prompt: ${promptTokens}, completion: ${completionTokens}`,
        );

        // Validate we got actual tokens
        if (promptTokens === 0 && completionTokens === 0) {
            Logger.warn(
                `[OpenRouter] ⚠️ No token data found in generation API response`,
            );
            Logger.debug(
                `[OpenRouter] Response fields: ${JSON.stringify(Object.keys(data.data))}`,
            );
            return null;
        }

        // Extract actual cost from OpenRouter
        let actualCost: number | undefined = undefined;

        if (
            data.data.total_cost !== undefined &&
            data.data.total_cost !== null
        ) {
            const parsedCost =
                typeof data.data.total_cost === "number"
                    ? data.data.total_cost
                    : parseFloat(data.data.total_cost);

            // Only set actualCost if parsing succeeded
            if (!isNaN(parsedCost)) {
                actualCost = parsedCost;
                Logger.debug(
                    `[OpenRouter] ✓ Got actual cost from API: $${parsedCost.toFixed(6)}`,
                );
            }
        } else if (data.data.usage !== undefined && data.data.usage !== null) {
            // Fallback: some responses might have cost in 'usage' field
            const parsedCost =
                typeof data.data.usage === "number"
                    ? data.data.usage
                    : parseFloat(data.data.usage);

            // Only set actualCost if parsing succeeded
            if (!isNaN(parsedCost)) {
                actualCost = parsedCost;
                Logger.debug(
                    `[OpenRouter] ✓ Got actual cost from 'usage' field: $${parsedCost.toFixed(6)}`,
                );
            }
        }

        if (actualCost === undefined) {
            Logger.warn(
                `[OpenRouter] ⚠️ No valid cost field found in API response`,
            );
        }

        const usageData = {
            promptTokens,
            completionTokens,
            actualCost,
        };

        Logger.debug(
            `[OpenRouter] ✓ Returning usage data: ${promptTokens} prompt + ${completionTokens} completion, cost: ${actualCost !== undefined ? `$${actualCost.toFixed(6)}` : "N/A"}`,
        );

        return usageData;
    }

    /**
     * Calculate cost based on token usage and model
     * Uses pricing data from cache or embedded rates
     *
     * @param promptTokens - Number of prompt tokens
     * @param completionTokens - Number of completion tokens
     * @param model - Model name
     * @param provider - Provider name
     * @param cachedPricing - Cached pricing data
     * @returns Calculated cost in dollars
     */
    static calculateCost(
        promptTokens: number,
        completionTokens: number,
        model: string,
        provider: "openai" | "anthropic" | "openrouter" | "ollama",
        cachedPricing: Record<string, { input: number; output: number }>,
    ): number {
        // Ollama is free (local)
        if (provider === "ollama") {
            Logger.debug(`[Cost] Ollama model ${model}: $0.00 (local)`);
            return 0;
        }

        Logger.debug(
            `[Cost] Calculating for: ${model} (${provider}), ${promptTokens} prompt + ${completionTokens} completion tokens`,
        );

        // Get pricing from cache or embedded rates
        const rates = this.getPricing(model, provider, cachedPricing);

        // Default to gpt-4o-mini pricing if unknown
        if (!rates) {
            Logger.warn(
                `[Cost] Unknown model pricing for: ${model}, using gpt-4o-mini fallback`,
            );
            const fallback = this.getPricing("gpt-4o-mini", "openai", {});
            if (!fallback) {
                Logger.error(`[Cost] Fallback pricing not found! Returning $0`);
                return 0; // Should never happen
            }
            // Calculate cost (pricing is per 1M tokens)
            const inputCost = (promptTokens / 1000000) * fallback.input;
            const outputCost = (completionTokens / 1000000) * fallback.output;
            const total = inputCost + outputCost;
            Logger.debug(
                `[Cost] Fallback: ${promptTokens} × $${fallback.input}/1M + ${completionTokens} × $${fallback.output}/1M = $${total.toFixed(6)}`,
            );
            return total;
        }

        // Calculate cost (pricing is per 1M tokens)
        const inputCost = (promptTokens / 1000000) * rates.input;
        const outputCost = (completionTokens / 1000000) * rates.output;
        const total = inputCost + outputCost;

        Logger.debug(
            `[Cost] ${model}: ${promptTokens} × $${rates.input}/1M + ${completionTokens} × $${rates.output}/1M = $${total.toFixed(6)}`,
        );

        return total;
    }

    /**
     * Get detailed cost breakdown (input + output costs separately)
     * Useful for transparency and debugging
     */
    static getCostBreakdown(
        promptTokens: number,
        completionTokens: number,
        model: string,
        provider: "openai" | "anthropic" | "openrouter" | "ollama",
        cachedPricing: Record<string, { input: number; output: number }>,
    ): {
        inputCost: number;
        outputCost: number;
        totalCost: number;
        inputRate: number;
        outputRate: number;
        rateSource: "cached" | "embedded" | "fallback";
    } {
        // Ollama is free
        if (provider === "ollama") {
            return {
                inputCost: 0,
                outputCost: 0,
                totalCost: 0,
                inputRate: 0,
                outputRate: 0,
                rateSource: "fallback",
            };
        }

        // Get pricing rates
        let rates = this.getPricing(model, provider, cachedPricing);
        let rateSource: "cached" | "embedded" | "fallback" = "cached";

        // Determine source of rates
        const openRouterFormat = this.constructOpenRouterModelId(
            provider,
            model,
        );
        if (cachedPricing[openRouterFormat] || cachedPricing[model]) {
            rateSource = "cached";
        } else if (
            this.getEmbeddedPricing()[openRouterFormat] ||
            this.getEmbeddedPricing()[model]
        ) {
            rateSource = "embedded";
        } else {
            rateSource = "fallback";
        }

        // Fallback to gpt-4o-mini if no rates found
        if (!rates) {
            rates = this.getPricing("gpt-4o-mini", "openai", {});
            rateSource = "fallback";
        }

        if (!rates) {
            // Should never happen, but just in case
            return {
                inputCost: 0,
                outputCost: 0,
                totalCost: 0,
                inputRate: 0,
                outputRate: 0,
                rateSource: "fallback",
            };
        }

        // Calculate costs (rates are per 1M tokens)
        const inputCost = (promptTokens / 1000000) * rates.input;
        const outputCost = (completionTokens / 1000000) * rates.output;

        return {
            inputCost,
            outputCost,
            totalCost: inputCost + outputCost,
            inputRate: rates.input,
            outputRate: rates.output,
            rateSource,
        };
    }

    /**
     * Enhanced cost calculation with full tracking metadata
     * Returns cost along with information about how it was calculated
     *
     * @param promptTokens - Input tokens
     * @param completionTokens - Output tokens
     * @param model - Model name
     * @param provider - Provider (openai, anthropic, openrouter, ollama)
     * @param cachedPricing - Cached pricing data from OpenRouter API
     * @param tokenSource - Whether tokens are "actual" or "estimated"
     * @param actualCost - Actual cost from provider API (if available)
     * @returns Cost amount and tracking metadata
     */
    static calculateCostWithTracking(
        promptTokens: number,
        completionTokens: number,
        model: string,
        provider: "openai" | "anthropic" | "openrouter" | "ollama",
        cachedPricing: Record<string, { input: number; output: number }>,
        tokenSource: "actual" | "estimated",
        actualCost?: number,
    ): {
        cost: number;
        costMethod: "actual" | "calculated" | "estimated";
        pricingSource: "openrouter" | "embedded";
        tokenSource: "actual" | "estimated";
    } {
        // Ollama is free (local)
        if (provider === "ollama") {
            Logger.debug(
                `[Cost Tracking] Ollama model ${model}: $0.00 (local)`,
            );
            return {
                cost: 0,
                costMethod: "actual",
                pricingSource: "embedded",
                tokenSource: "actual",
            };
        }

        // Layer 1: Use actual cost from provider API if available
        if (actualCost !== undefined && actualCost !== null) {
            Logger.debug(
                `[Cost Tracking] Using actual cost from provider API: $${actualCost.toFixed(6)}`,
            );
            return {
                cost: actualCost,
                costMethod: "actual",
                pricingSource: "openrouter", // Currently only OpenRouter provides actual costs
                tokenSource,
            };
        }

        // Layer 2 & 3: Calculate cost from tokens + pricing data
        const breakdown = this.getCostBreakdown(
            promptTokens,
            completionTokens,
            model,
            provider,
            cachedPricing,
        );

        // Determine pricing source (OpenRouter API vs embedded)
        const pricingSource: "openrouter" | "embedded" =
            breakdown.rateSource === "cached" ? "openrouter" : "embedded";

        // Determine cost method based on token source
        const costMethod: "calculated" | "estimated" =
            tokenSource === "actual" ? "calculated" : "estimated";

        Logger.debug(
            `[Cost Tracking] ${model}: Cost = $${breakdown.totalCost.toFixed(6)}, ` +
                `Method = ${costMethod}, Pricing = ${pricingSource}, Tokens = ${tokenSource}`,
        );

        return {
            cost: breakdown.totalCost,
            costMethod,
            pricingSource,
            tokenSource,
        };
    }

    /**
     * Determine if pricing data came from OpenRouter API or embedded fallback
     *
     * @param model - Model name
     * @param provider - Provider (openai, anthropic, openrouter, ollama)
     * @param cachedPricing - Cached pricing from OpenRouter API
     * @returns "openrouter" if from API, "embedded" if from fallback
     */
    static determinePricingSource(
        model: string,
        provider: "openai" | "anthropic" | "openrouter" | "ollama",
        cachedPricing: Record<string, { input: number; output: number }>,
    ): "openrouter" | "embedded" {
        if (provider === "ollama") {
            return "embedded";
        }

        const openRouterFormat = this.constructOpenRouterModelId(
            provider,
            model,
        );

        // Check if pricing exists in cache (from OpenRouter API)
        if (cachedPricing[openRouterFormat] || cachedPricing[model]) {
            return "openrouter";
        }

        // Check if it exists in embedded pricing
        const embeddedPricing = this.getEmbeddedPricing();
        if (embeddedPricing[openRouterFormat] || embeddedPricing[model]) {
            return "embedded";
        }

        // Fallback - considered embedded
        return "embedded";
    }

    /**
     * Format cost display with calculation method indicator
     *
     * @param cost - Cost amount
     * @param costMethod - How cost was calculated
     * @returns Formatted string like "$0.0114 (actual)" or "$0.0114 (estimated)"
     */
    static formatCostWithMethod(
        cost: number,
        costMethod: "actual" | "calculated" | "estimated",
    ): string {
        let costStr: string;

        if (cost === 0) {
            return "$0.00 (free)";
        } else if (cost < 0.0001) {
            costStr = cost.toFixed(6);
        } else if (cost < 0.01) {
            costStr = cost.toFixed(4);
        } else if (cost < 1.0) {
            costStr = cost.toFixed(4);
        } else {
            costStr = cost.toFixed(2);
        }

        // Add method indicator
        const methodLabel =
            costMethod === "actual"
                ? "actual"
                : costMethod === "calculated"
                  ? "calc"
                  : "est";

        return `$${costStr} (${methodLabel})`;
    }

    /**
     * Format token count with source indicator
     *
     * @param tokenCount - Number of tokens
     * @param tokenSource - Whether tokens are "actual" or "estimated"
     * @returns Formatted string like "26,149 (actual)" or "26,149 (est)"
     */
    static formatTokensWithSource(
        tokenCount: number,
        tokenSource: "actual" | "estimated",
    ): string {
        const formatted = tokenCount.toLocaleString();
        const sourceLabel = tokenSource === "actual" ? "actual" : "est";
        return `${formatted} (${sourceLabel})`;
    }
}
