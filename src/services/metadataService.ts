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

        // For API errors with status codes, ONLY show mode (simplified)
        if (message.error?.statusCode) {
            return "📊 " + parts.join(" • ");
        }

        // For errors without tokenUsage, show minimal info
        if (message.error && !message.tokenUsage) {
            if (message.error.model) {
                parts.push(message.error.model);
            }
            const detectedLang =
                message.parsedQuery?.aiUnderstanding?.detectedLanguage;
            parts.push(`Language: ${detectedLang || "Unknown"}`);
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
                    // Task Chat: Show parser failed + analysis not executed
                    const { provider: analysisProvider, model: analysisModel } =
                        getProviderForPurpose(settings, "analysis");
                    const analysisProviderName =
                        this.formatProvider(analysisProvider);

                    parts.push(
                        `${providerName}: ${modelInfo} (parser failed), ${analysisProviderName}: ${analysisModel} (not executed - 0 tasks)`,
                    );
                } else if (isSmartSearch && message.error.type === "api") {
                    // Smart Search: Show parser failed only
                    parts.push(`${providerName}: ${modelInfo} (parser failed)`);
                } else {
                    parts.push(`${providerName}: ${modelInfo}`);
                }

                // Show token counts (even if zero for failed requests)
                const totalTokens = message.tokenUsage.totalTokens || 0;
                const promptTokens = message.tokenUsage.promptTokens || 0;
                const completionTokens =
                    message.tokenUsage.completionTokens || 0;
                parts.push(
                    `${totalTokens.toLocaleString()} tokens (${promptTokens.toLocaleString()} in, ${completionTokens.toLocaleString()} out)`,
                );

                // Show cost (always $0.00 for failed requests)
                const cost = message.tokenUsage.estimatedCost || 0;
                parts.push(`$${cost.toFixed(2)}`);

                // Show language info (or Undetected for failed parsing)
                const detectedLang =
                    message.parsedQuery?.aiUnderstanding?.detectedLanguage;
                if (detectedLang) {
                    parts.push(`Language: ${detectedLang}`);
                } else {
                    parts.push("Language: Undetected");
                }
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

            // Token count
            const tokenStr = message.tokenUsage.isEstimated ? "~" : "";
            const totalTokens = message.tokenUsage.totalTokens || 0;
            const promptTokens = message.tokenUsage.promptTokens || 0;
            const completionTokens = message.tokenUsage.completionTokens || 0;
            parts.push(
                `${tokenStr}${totalTokens.toLocaleString()} tokens (${promptTokens.toLocaleString()} in, ${completionTokens.toLocaleString()} out)`,
            );

            // Cost
            if (message.tokenUsage.provider === "ollama") {
                parts.push("Free (local)");
            } else {
                const cost = message.tokenUsage.estimatedCost || 0;
                if (cost === 0) {
                    parts.push("$0.00");
                } else if (cost < 0.01) {
                    parts.push(`~$${cost.toFixed(4)}`);
                } else {
                    parts.push(`~$${cost.toFixed(2)}`);
                }
            }

            // Language (for Smart Search and Task Chat)
            if (!isSimpleSearch) {
                const detectedLang =
                    message.parsedQuery?.aiUnderstanding?.detectedLanguage;
                if (detectedLang) {
                    parts.push(`Language: ${detectedLang}`);
                } else if (message.error) {
                    parts.push("Language: Undetected");
                }
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

            // Add status indicator for Smart Search
            const isSmartSearch = message.role === "smart";
            let suffix = "";
            if (isSmartSearch && hasParsingModel) {
                // Check if parser failed (error exists and is parser-related)
                const parserFailed =
                    message.error &&
                    (message.error.type === "parser" ||
                        message.error.type === "api");
                suffix = parserFailed ? " (parser failed)" : " (parser)";
            }

            return `${this.formatProvider(provider)}: ${model}${suffix}`;
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

            if (message.error && message.error.type === "api") {
                // Parser failed, analysis not executed
                return `${this.formatProvider(provider)}: ${model} (parser failed, analysis not executed - 0 tasks)`;
            } else {
                // Both succeeded
                return `${this.formatProvider(provider)}: ${model} (parser + analysis)`;
            }
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
                return `${parsingProviderName}: ${message.tokenUsage!.parsingModel} (parser failed), ${analysisModel} (analysis not executed - 0 tasks)`;
            } else {
                // Different providers
                return `${parsingProviderName}: ${message.tokenUsage!.parsingModel} (parser failed), ${analysisProviderName}: ${analysisModel} (analysis not executed - 0 tasks)`;
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
