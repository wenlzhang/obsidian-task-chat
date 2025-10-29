import { ChatMessage } from "../models/task";
import { PluginSettings, getProviderForPurpose } from "../settings";

/**
 * Service for formatting chat message metadata
 * Centralizes complex metadata display logic
 */
export class MetadataService {
    /**
     * Format metadata string for a chat message
     * Returns null if no metadata should be shown
     */
    static formatMetadata(
        message: ChatMessage,
        settings: PluginSettings,
    ): string | null {
        const parts: string[] = [];

        // Always show mode first
        if (message.role === "simple") {
            parts.push("Mode: Simple Search");
        } else if (message.role === "smart") {
            parts.push("Mode: Smart Search");
        } else if (message.role === "chat") {
            parts.push("Mode: Task Chat");
        }

        // For API errors with status codes AND no token usage, ONLY show mode (simplified)
        // This means BOTH operations failed (parsing + analysis in Task Chat)
        // If tokenUsage exists, at least one operation succeeded and incurred costs → show full metadata
        if (message.error?.statusCode && !message.tokenUsage) {
            return "📊 " + parts.join(" • ");
        }

        // For errors without tokenUsage, show minimal info
        if (message.error && !message.tokenUsage) {
            if (message.error.model) {
                parts.push(message.error.model);
            }
            const detectedLang =
                message.parsedQuery?.aiUnderstanding?.detectedLanguage;
            parts.push(`Lang: ${detectedLang || "Undetected"}`);
            return "📊 " + parts.join(" • ");
        }

        // For errors WITH tokenUsage but showTokenUsage is false, show FULL error metadata
        // This ensures users see complete error context even with token display disabled
        if (message.error && !settings.showTokenUsage) {
            if (message.tokenUsage && message.tokenUsage.model !== "none") {
                const modelInfo =
                    message.tokenUsage.parsingModel || message.tokenUsage.model;
                const providerInfo =
                    message.tokenUsage.parsingProvider ||
                    message.tokenUsage.provider;
                const providerName = this.formatProvider(providerInfo);

                // Add failure indicator for parser/analysis errors
                const isSmartSearch = message.role === "smart";
                const isTaskChat = message.role === "chat";

                if (isTaskChat && message.error.type === "api") {
                    const { provider: analysisProvider, model: analysisModel } =
                        getProviderForPurpose(settings, "analysis");
                    const analysisProviderName =
                        this.formatProvider(analysisProvider);

                    parts.push(
                        `${providerName}: ${modelInfo} (parser), ${analysisProviderName}: ${analysisModel} (analysis)`,
                    );
                } else if (isSmartSearch && message.error.type === "api") {
                    parts.push(`${providerName}: ${modelInfo} (parser)`);
                } else {
                    parts.push(`${providerName}: ${modelInfo}`);
                }

                // Show token counts and cost together (even if zero for failed requests)
                const totalTokens = message.tokenUsage.totalTokens || 0;
                const promptTokens = message.tokenUsage.promptTokens || 0;
                const completionTokens =
                    message.tokenUsage.completionTokens || 0;
                const cost = message.tokenUsage.estimatedCost || 0;

                // Format cost with appropriate precision
                let costStr: string;
                if (cost === 0) {
                    costStr = "$0.00";
                } else if (cost < 0.0001) {
                    costStr = `$${cost.toFixed(6)}`;
                } else if (cost < 1.0) {
                    costStr = `$${cost.toFixed(4)}`;
                } else {
                    costStr = `$${cost.toFixed(2)}`;
                }

                parts.push(
                    `${totalTokens.toLocaleString()} tokens (${promptTokens.toLocaleString()} in, ${completionTokens.toLocaleString()} out), ${costStr}`,
                );

                // Show language info (or Undetected for failed parsing)
                const detectedLang =
                    message.parsedQuery?.aiUnderstanding?.detectedLanguage;
                parts.push(`Lang: ${detectedLang || "Undetected"}`);
            }
            return "📊 " + parts.join(" • ");
        }

        // From here, either no error OR showTokenUsage is enabled
        if (!message.tokenUsage) {
            return null; // No metadata to show
        }

        // If showTokenUsage is disabled and no error, don't show metadata
        if (!settings.showTokenUsage && !message.error) {
            return null;
        }

        const isSimpleSearch = message.tokenUsage.model === "none";

        // Show model info for AI-powered modes
        if (message.tokenUsage.model && message.tokenUsage.model !== "none") {
            const modelInfo = this.formatModelInfo(message, settings);
            if (modelInfo) {
                parts.push(modelInfo);
            }

            // Token count and cost together (grouped with comma)
            const totalTokens = message.tokenUsage.totalTokens || 0;
            const promptTokens = message.tokenUsage.promptTokens || 0;
            const completionTokens = message.tokenUsage.completionTokens || 0;

            // Determine if using ONLY local models (both parser and analysis)
            // If ANY cloud model is involved, show actual cost
            const parsingProvider =
                message.tokenUsage.parsingProvider ||
                message.tokenUsage.provider;
            const analysisProvider =
                message.tokenUsage.analysisProvider ||
                message.tokenUsage.provider;

            const bothLocal =
                parsingProvider === "ollama" && analysisProvider === "ollama";

            // Get token source (actual vs estimated)
            const tokenSource = message.tokenUsage.tokenSource ?? "actual";
            const sourceLabel = tokenSource === "actual" ? "actual" : "est";

            // Add tilde (~) prefix for estimated tokens (approximate values)
            const tokenPrefix = tokenSource === "estimated" ? "~" : "";

            // Format token display with source indicator
            const tokenDisplay = `${tokenPrefix}${promptTokens.toLocaleString()} in (${sourceLabel}), ${tokenPrefix}${completionTokens.toLocaleString()} out (${sourceLabel})`;

            if (bothLocal) {
                // Both parser and analysis use local models → Free
                parts.push(`${tokenDisplay} • Free (local)`);
            } else {
                // At least one cloud model is used → Show actual cost
                const cost = message.tokenUsage.estimatedCost || 0;
                const costMethod =
                    message.tokenUsage.costMethod ?? "calculated";

                // Format cost with precision
                let costStr: string;
                if (cost === 0) {
                    costStr = "$0.00";
                } else if (cost < 0.0001) {
                    costStr = cost.toFixed(6);
                } else if (cost < 0.01) {
                    costStr = cost.toFixed(4);
                } else if (cost < 1.0) {
                    costStr = cost.toFixed(4);
                } else {
                    costStr = cost.toFixed(2);
                }

                // Add tilde (~) prefix for calculated/estimated costs (approximate values)
                const costPrefix =
                    costMethod === "calculated" || costMethod === "estimated"
                        ? "~"
                        : "";

                // Add cost method indicator
                const costMethodLabel =
                    costMethod === "actual"
                        ? "actual"
                        : costMethod === "calculated"
                          ? "calc"
                          : "est";

                const costDisplay = `${costPrefix}$${costStr} (${costMethodLabel})`;

                parts.push(`${tokenDisplay} • ${costDisplay}`);
            }

            // Language (for Smart Search and Task Chat)
            if (!isSimpleSearch) {
                const detectedLang =
                    message.parsedQuery?.aiUnderstanding?.detectedLanguage;
                parts.push(`Lang: ${detectedLang || "Undetected"}`);
            }
        } else if (isSimpleSearch) {
            // Simple Search: No AI used
            parts.push("$0.00");
        }

        return parts.length > 1 ? "📊 " + parts.join(" • ") : null;
    }

    /**
     * Format model information based on mode and configuration
     */
    private static formatModelInfo(
        message: ChatMessage,
        settings: PluginSettings,
    ): string | null {
        const hasParsingModel =
            message.tokenUsage?.parsingModel &&
            message.tokenUsage?.parsingProvider;
        const hasAnalysisModel =
            message.tokenUsage?.analysisModel &&
            message.tokenUsage?.analysisProvider;

        // Simple/Smart Search - show single model
        if (message.role !== "chat") {
            const model = hasParsingModel
                ? message.tokenUsage!.parsingModel!
                : message.tokenUsage!.model;
            const provider = hasParsingModel
                ? message.tokenUsage!.parsingProvider!
                : message.tokenUsage!.provider;

            return `${this.formatProvider(provider)}: ${model} (parser)`;
        }

        // Task Chat - show parsing and/or analysis models
        const modelsSame =
            hasParsingModel &&
            hasAnalysisModel &&
            message.tokenUsage!.parsingModel ===
                message.tokenUsage!.analysisModel &&
            message.tokenUsage!.parsingProvider ===
                message.tokenUsage!.analysisProvider;

        if (modelsSame) {
            // Same model for both
            const provider = message.tokenUsage!.parsingProvider!;
            const model = message.tokenUsage!.parsingModel!;

            return `${this.formatProvider(provider)}: ${model} (parser + analysis)`;
        }

        if (!hasAnalysisModel && message.error && message.error.model) {
            // Task Chat: Parsing failed, analysis not executed
            // Get analysis model from settings since it was never run
            const { provider: analysisProvider, model: analysisModel } =
                getProviderForPurpose(settings, "analysis");
            const parsingProviderName = this.formatProvider(
                message.tokenUsage!.parsingProvider!,
            );
            const analysisProviderName = this.formatProvider(analysisProvider);

            if (parsingProviderName === analysisProviderName) {
                // Same provider, show combined
                return `${parsingProviderName}: ${message.tokenUsage!.parsingModel} (parser), ${analysisModel} (analysis)`;
            } else {
                // Different providers
                return `${parsingProviderName}: ${message.tokenUsage!.parsingModel} (parser), ${analysisProviderName}: ${analysisModel} (analysis)`;
            }
        }

        if (hasParsingModel && hasAnalysisModel) {
            // Different models
            const sameProvider =
                message.tokenUsage!.parsingProvider ===
                message.tokenUsage!.analysisProvider;

            if (sameProvider) {
                const provider = message.tokenUsage!.parsingProvider!;
                return `${this.formatProvider(provider)}: ${message.tokenUsage!.parsingModel} (parser), ${message.tokenUsage!.analysisModel} (analysis)`;
            } else {
                const parsingProvider = message.tokenUsage!.parsingProvider!;
                const analysisProvider = message.tokenUsage!.analysisProvider!;
                return `${this.formatProvider(parsingProvider)}: ${message.tokenUsage!.parsingModel} (parser), ${this.formatProvider(analysisProvider)}: ${message.tokenUsage!.analysisModel} (analysis)`;
            }
        }

        // Fallback: show whatever model info we have
        if (hasParsingModel) {
            const provider = message.tokenUsage!.parsingProvider!;
            const model = message.tokenUsage!.parsingModel!;
            return `${this.formatProvider(provider)}: ${model}`;
        }

        return null;
    }

    /**
     * Format provider name
     */
    private static formatProvider(
        provider: "openai" | "anthropic" | "openrouter" | "ollama",
    ): string {
        const map: Record<string, string> = {
            openai: "OpenAI",
            anthropic: "Anthropic",
            openrouter: "OpenRouter",
            ollama: "Ollama",
        };
        return map[provider] || provider;
    }
}
