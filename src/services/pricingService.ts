import { requestUrl } from "obsidian";
import { Logger } from "../utils/logger";

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
                data.data.forEach((model: any) => {
                    if (model.id && model.pricing) {
                        // OpenRouter returns pricing per token, convert to per million tokens
                        const promptCost = parseFloat(
                            model.pricing.prompt || 0,
                        );
                        const completionCost = parseFloat(
                            model.pricing.completion || 0,
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
            // OpenAI via OpenRouter
            "openai/gpt-4o": { input: 2.5, output: 10.0 },
            "openai/gpt-4o-mini": { input: 0.15, output: 0.6 },
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
            return { input: 0, output: 0 };
        }

        // Construct OpenRouter format: "provider/model"
        // This gives us the most accurate pricing from OpenRouter's database
        const openRouterFormat = this.constructOpenRouterModelId(
            provider,
            model,
        );

        // Try OpenRouter format first (most accurate)
        if (cachedPricing[openRouterFormat]) {
            Logger.debug(`Found exact match in cache: ${openRouterFormat}`);
            return cachedPricing[openRouterFormat];
        }

        // Try exact model name match in cache
        if (cachedPricing[model]) {
            Logger.debug(`Found model in cache: ${model}`);
            return cachedPricing[model];
        }

        // Try embedded pricing with OpenRouter format
        const embedded = this.getEmbeddedPricing();
        if (embedded[openRouterFormat]) {
            Logger.debug(`Using embedded rate for: ${openRouterFormat}`);
            return embedded[openRouterFormat];
        }

        // Try exact model name in embedded pricing
        if (embedded[model]) {
            Logger.debug(`Using embedded rate for: ${model}`);
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
                    `Found partial match in cache: ${key} for ${model}`,
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
                    `Found partial match in embedded: ${key} for ${model}`,
                );
                return value;
            }
        }

        Logger.warn(
            `No pricing found for: ${model} (provider: ${provider}, tried: ${openRouterFormat})`,
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
}
