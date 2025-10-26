import { Logger } from "./logger";

/**
 * Structured error information for display in chat UI
 */
export interface StructuredError {
    type: "parser" | "analysis" | "api" | "network";
    message: string; // Brief error message
    details: string; // Detailed error information
    solution: string; // Suggested solution
    docsLink?: string; // Link to documentation
    model?: string; // AI model that failed (provider/model)
    fallbackUsed?: string; // Description of fallback mechanism used
}

/**
 * Enhanced error for AI operations with structured information
 */
export class AIError extends Error {
    readonly structured: StructuredError;
    readonly isAIError = true;

    constructor(structured: StructuredError) {
        super(structured.message);
        this.structured = structured;
        this.name = "AIError";
    }
}

/**
 * Error handling utility for AI operations
 * Parses API errors and provides user-friendly messages with solutions
 */
export class ErrorHandler {
    /**
     * Parse API error response and create structured error
     */
    static parseAPIError(
        error: any,
        model: string,
        operation: "parser" | "analysis",
    ): StructuredError {
        const errorMsg = error?.message || String(error);
        const errorBody = error?.json || error?.response?.json || {};

        Logger.debug("Parsing API error:", {
            message: errorMsg,
            body: errorBody,
            model: model,
            operation: operation,
        });

        // Check for context length errors
        if (
            errorMsg.includes("context length") ||
            errorMsg.includes("maximum") ||
            errorMsg.includes("token") ||
            errorBody?.error?.code === "context_length_exceeded"
        ) {
            return this.createContextLengthError(errorMsg, errorBody, model);
        }

        // Check for model not found errors
        if (
            errorMsg.includes("model") &&
            (errorMsg.includes("not found") ||
                errorMsg.includes("does not exist") ||
                errorMsg.includes("not available"))
        ) {
            return this.createModelNotFoundError(errorMsg, model);
        }

        // Check for API key errors
        if (
            errorMsg.includes("API key") ||
            errorMsg.includes("authentication") ||
            errorMsg.includes("unauthorized") ||
            errorBody?.error?.code === "invalid_api_key"
        ) {
            return this.createAPIKeyError(errorMsg, model);
        }

        // Check for rate limit errors
        if (
            errorMsg.includes("rate limit") ||
            errorMsg.includes("too many requests") ||
            errorBody?.error?.code === "rate_limit_exceeded"
        ) {
            return this.createRateLimitError(errorMsg, model);
        }

        // Check for server errors
        if (
            errorMsg.includes("500") ||
            errorMsg.includes("503") ||
            errorMsg.includes("server error") ||
            errorMsg.includes("overloaded")
        ) {
            return this.createServerError(errorMsg, model);
        }

        // Check for connection errors (Ollama, network issues)
        if (
            errorMsg.includes("ECONNREFUSED") ||
            errorMsg.includes("fetch") ||
            errorMsg.includes("network") ||
            errorMsg.includes("connect")
        ) {
            return this.createConnectionError(errorMsg, model);
        }

        // Generic error fallback
        return this.createGenericError(errorMsg, model, operation);
    }

    /**
     * Context length exceeded error
     */
    private static createContextLengthError(
        errorMsg: string,
        errorBody: any,
        model: string,
    ): StructuredError {
        // Try to extract token limits from error message
        const maxMatch =
            errorMsg.match(/maximum.*?(\d+)/i) ||
            errorMsg.match(/limit.*?(\d+)/i);
        const requestedMatch = errorMsg.match(/requested.*?(\d+)/i);

        let details = errorMsg;
        if (maxMatch && requestedMatch) {
            details = `Maximum context: ${maxMatch[1]} tokens, but you requested: ${requestedMatch[1]} tokens`;
        }

        return {
            type: "api",
            message: "Context length exceeded",
            details: details,
            solution:
                "1. Reduce 'Max response tokens' in settings (try 2000-4000)\n2. Clear chat history or start new session\n3. Switch to model with larger context window",
            docsLink:
                "https://github.com/wenlzhang/obsidian-task-chat/blob/main/docs/TROUBLESHOOTING.md#1-context-length-exceeded",
            model: model,
        };
    }

    /**
     * Model not found error
     */
    private static createModelNotFoundError(
        errorMsg: string,
        model: string,
    ): StructuredError {
        const isOllama = model.includes("ollama");

        return {
            type: "api",
            message: "Model not found",
            details: errorMsg,
            solution: isOllama
                ? `1. Pull the model: ollama pull <model-name>\n2. Check available models: ollama list\n3. Verify model name in settings matches exactly`
                : `1. Check model name in settings (case-sensitive)\n2. Verify model exists for your provider\n3. Try a different model (e.g., gpt-4o-mini)`,
            docsLink:
                "https://github.com/wenlzhang/obsidian-task-chat/blob/main/docs/TROUBLESHOOTING.md#2-model-not-found",
            model: model,
        };
    }

    /**
     * API key error
     */
    private static createAPIKeyError(
        errorMsg: string,
        model: string,
    ): StructuredError {
        return {
            type: "api",
            message: "Invalid or missing API key",
            details: errorMsg,
            solution:
                "1. Check API key in settings (no extra spaces)\n2. Verify key is active in provider dashboard\n3. Generate new key if needed\n4. Ensure provider matches API key",
            docsLink:
                "https://github.com/wenlzhang/obsidian-task-chat/blob/main/docs/TROUBLESHOOTING.md#3-invalid-api-key",
            model: model,
        };
    }

    /**
     * Rate limit error
     */
    private static createRateLimitError(
        errorMsg: string,
        model: string,
    ): StructuredError {
        return {
            type: "api",
            message: "Rate limit exceeded",
            details: errorMsg,
            solution:
                "1. Wait a few minutes and try again\n2. Upgrade plan for higher limits\n3. Try alternative provider (OpenRouter)\n4. Reduce request frequency",
            docsLink:
                "https://github.com/wenlzhang/obsidian-task-chat/blob/main/docs/TROUBLESHOOTING.md#4-rate-limit-exceeded",
            model: model,
        };
    }

    /**
     * Server error (500/503)
     */
    private static createServerError(
        errorMsg: string,
        model: string,
    ): StructuredError {
        return {
            type: "api",
            message: "Provider server error",
            details: errorMsg,
            solution:
                "1. Wait 1-5 minutes (usually temporary)\n2. Check provider status page\n3. Try alternative provider\n4. If persists, report to provider",
            docsLink:
                "https://github.com/wenlzhang/obsidian-task-chat/blob/main/docs/TROUBLESHOOTING.md#5-server-error-500503",
            model: model,
        };
    }

    /**
     * Connection error (Ollama, network)
     */
    private static createConnectionError(
        errorMsg: string,
        model: string,
    ): StructuredError {
        const isOllama = model.includes("ollama");

        return {
            type: "network",
            message: isOllama
                ? "Cannot connect to Ollama"
                : "Network connection error",
            details: errorMsg,
            solution: isOllama
                ? "1. Start Ollama: ollama serve\n2. Check Ollama is running: open http://localhost:11434\n3. Verify endpoint in settings\n4. Check firewall settings"
                : "1. Check internet connection\n2. Verify API endpoint URL\n3. Check firewall/proxy settings\n4. Try again in a moment",
            docsLink:
                "https://github.com/wenlzhang/obsidian-task-chat/blob/main/docs/TROUBLESHOOTING.md#6-ollama-connection-failed",
            model: model,
        };
    }

    /**
     * Generic error fallback
     */
    private static createGenericError(
        errorMsg: string,
        model: string,
        operation: "parser" | "analysis",
    ): StructuredError {
        return {
            type: operation === "parser" ? "parser" : "analysis",
            message: `AI ${operation} failed`,
            details: errorMsg,
            solution:
                "1. Check console for detailed error\n2. Verify settings (API key, model, endpoint)\n3. Try different model\n4. Check troubleshooting guide",
            docsLink:
                "https://github.com/wenlzhang/obsidian-task-chat/blob/main/docs/TROUBLESHOOTING.md",
            model: model,
        };
    }

    /**
     * Create parser error with fallback info
     */
    static createParserError(
        error: any,
        model: string,
        fallbackType: "simple" | "semantic",
    ): StructuredError {
        const structured = this.parseAPIError(error, model, "parser");

        // Add fallback information
        structured.fallbackUsed =
            fallbackType === "simple"
                ? "Simple Search mode (regex + character-level keywords)"
                : "Semantic expansion succeeded, using filtered results";

        return structured;
    }

    /**
     * Create analysis error (no fallback for analysis - user must fix)
     */
    static createAnalysisError(error: any, model: string): StructuredError {
        const structured = this.parseAPIError(error, model, "analysis");

        // Analysis errors don't have automatic fallback
        // User needs to fix the issue (reduce tokens, change model, etc.)
        return structured;
    }
}
