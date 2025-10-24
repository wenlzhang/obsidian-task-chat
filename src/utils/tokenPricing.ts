/**
 * Token pricing utility for calculating actual AI costs
 * Prices are per 1 million tokens (input/output)
 * Updated: January 2025
 */
export class TokenPricing {
    /**
     * Pricing table for all supported models
     * Format: { input: price per 1M tokens, output: price per 1M tokens }
     */
    private static readonly PRICING_TABLE: Record<
        string,
        Record<string, { input: number; output: number }>
    > = {
        openai: {
            // GPT-4o models
            "gpt-4o": { input: 2.5, output: 10.0 },
            "gpt-4o-mini": { input: 0.15, output: 0.6 },
            "gpt-4o-2024-11-20": { input: 2.5, output: 10.0 },
            "gpt-4o-2024-08-06": { input: 2.5, output: 10.0 },
            "gpt-4o-2024-05-13": { input: 5.0, output: 15.0 },
            "gpt-4o-mini-2024-07-18": { input: 0.15, output: 0.6 },

            // GPT-4 Turbo models
            "gpt-4-turbo": { input: 10.0, output: 30.0 },
            "gpt-4-turbo-2024-04-09": { input: 10.0, output: 30.0 },
            "gpt-4-turbo-preview": { input: 10.0, output: 30.0 },

            // GPT-4 models
            "gpt-4": { input: 30.0, output: 60.0 },
            "gpt-4-0613": { input: 30.0, output: 60.0 },
            "gpt-4-32k": { input: 60.0, output: 120.0 },

            // GPT-3.5 Turbo models
            "gpt-3.5-turbo": { input: 0.5, output: 1.5 },
            "gpt-3.5-turbo-0125": { input: 0.5, output: 1.5 },
            "gpt-3.5-turbo-16k": { input: 3.0, output: 4.0 },
        },
        anthropic: {
            // Claude 3.5 models
            "claude-3-5-sonnet-20241022": { input: 3.0, output: 15.0 },
            "claude-3-5-sonnet-20240620": { input: 3.0, output: 15.0 },
            "claude-3-5-haiku-20241022": { input: 0.8, output: 4.0 },

            // Claude 3 models
            "claude-3-opus-20240229": { input: 15.0, output: 75.0 },
            "claude-3-sonnet-20240229": { input: 3.0, output: 15.0 },
            "claude-3-haiku-20240307": { input: 0.25, output: 1.25 },
        },
        openrouter: {
            // Popular OpenRouter models (sample - prices may vary)
            "anthropic/claude-3.5-sonnet": { input: 3.0, output: 15.0 },
            "anthropic/claude-3-opus": { input: 15.0, output: 75.0 },
            "anthropic/claude-3-haiku": { input: 0.25, output: 1.25 },
            "openai/gpt-4o": { input: 2.5, output: 10.0 },
            "openai/gpt-4o-mini": { input: 0.15, output: 0.6 },
            "openai/gpt-4-turbo": { input: 10.0, output: 30.0 },
            "google/gemini-pro-1.5": { input: 1.25, output: 5.0 },
            "google/gemini-flash-1.5": { input: 0.075, output: 0.3 },
            "meta-llama/llama-3.1-70b-instruct": { input: 0.52, output: 0.75 },
            "meta-llama/llama-3.1-8b-instruct": { input: 0.06, output: 0.06 },
        },
        ollama: {
            // Ollama is local/free
            "*": { input: 0, output: 0 },
        },
    };

    /**
     * Get pricing for a specific model
     * @param provider AI provider (openai, anthropic, openrouter, ollama)
     * @param model Model name
     * @returns Pricing object with input/output costs per 1M tokens, or null if not found
     */
    static getPricing(
        provider: string,
        model: string,
    ): { input: number; output: number } | null {
        const providerPricing = this.PRICING_TABLE[provider.toLowerCase()];
        if (!providerPricing) {
            console.warn(
                `[Token Pricing] Unknown provider: ${provider}. Using zero cost.`,
            );
            return { input: 0, output: 0 };
        }

        // Ollama is always free (local)
        if (provider.toLowerCase() === "ollama") {
            return { input: 0, output: 0 };
        }

        // Try exact model match
        const pricing = providerPricing[model];
        if (pricing) {
            return pricing;
        }

        // Try partial match (e.g., "gpt-4o-2024-11-20" → "gpt-4o")
        const modelPrefix = model.split("-").slice(0, 2).join("-");
        const prefixPricing = providerPricing[modelPrefix];
        if (prefixPricing) {
            return prefixPricing;
        }

        // Default fallback
        console.warn(
            `[Token Pricing] Unknown model: ${model} for provider: ${provider}. Using zero cost.`,
        );
        return { input: 0, output: 0 };
    }

    /**
     * Calculate cost for a given token usage
     * @param inputTokens Number of input/prompt tokens
     * @param outputTokens Number of output/completion tokens
     * @param provider AI provider
     * @param model Model name
     * @returns Cost in USD
     */
    static calculateCost(
        inputTokens: number,
        outputTokens: number,
        provider: string,
        model: string,
    ): number {
        const pricing = this.getPricing(provider, model);
        if (!pricing) {
            return 0;
        }

        // Pricing is per 1M tokens, so divide by 1,000,000
        const inputCost = (inputTokens * pricing.input) / 1_000_000;
        const outputCost = (outputTokens * pricing.output) / 1_000_000;

        return inputCost + outputCost;
    }

    /**
     * Format cost for display (handles very small amounts)
     * @param cost Cost in USD
     * @returns Formatted string (e.g., "$0.0012" or "<$0.0001")
     */
    static formatCost(cost: number): string {
        if (cost === 0) {
            return "$0.00";
        }
        if (cost < 0.0001) {
            return "<$0.0001";
        }
        if (cost < 0.01) {
            return `$${cost.toFixed(4)}`;
        }
        if (cost < 1) {
            return `$${cost.toFixed(3)}`;
        }
        return `$${cost.toFixed(2)}`;
    }

    /**
     * Get all supported providers
     */
    static getSupportedProviders(): string[] {
        return Object.keys(this.PRICING_TABLE);
    }

    /**
     * Get all models for a provider
     */
    static getModelsForProvider(provider: string): string[] {
        const providerPricing = this.PRICING_TABLE[provider.toLowerCase()];
        return providerPricing ? Object.keys(providerPricing) : [];
    }
}
