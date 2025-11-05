import { Logger } from "../../utils/logger";
import { ModelProviderService } from "../ai/modelProviderService";

/**
 * Structured error information for display in chat UI
 */
export interface StructuredError {
    type: "parser" | "analysis" | "api" | "network";
    message: string; // Brief error message
    details: string; // Detailed error information
    solution: string; // Suggested solution
    docsLink?: string; // Link to documentation
    model?: string; // AI model that failed (e.g., "OpenAI: gpt-4o-mini")
    statusCode?: number; // HTTP status code (e.g., 400, 401, 500)
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
        error: unknown,
        model: string,
        operation: "parser" | "analysis",
    ): StructuredError {
        const errorMsg = error instanceof Error 
            ? error.message 
            : (error && typeof error === "object" && "message" in error && typeof (error as any).message === "string")
                ? (error as any).message
                : String(error);
        const errorBody = (error && typeof error === "object" && "json" in error)
            ? (error as any).json
            : (error && typeof error === "object" && "response" in error && (error as any).response?.json)
                ? (error as any).response.json
                : {};

        // Extract HTTP status code if available
        const statusCode = this.extractStatusCode(error, errorMsg);

        Logger.debug("Parsing API error:", {
            message: errorMsg,
            body: errorBody,
            model: model,
            operation: operation,
            statusCode: statusCode,
        });

        // Check for context length errors
        if (
            errorMsg.includes("context length") ||
            errorMsg.includes("maximum") ||
            errorMsg.includes("token") ||
            errorBody?.error?.code === "context_length_exceeded"
        ) {
            return this.createContextLengthError(
                errorMsg,
                errorBody,
                model,
                statusCode,
            );
        }

        // Check for model not found errors
        if (
            errorMsg.includes("model") &&
            (errorMsg.includes("not found") ||
                errorMsg.includes("does not exist") ||
                errorMsg.includes("not available"))
        ) {
            return this.createModelNotFoundError(errorMsg, model, statusCode);
        }

        // Check for 400 Bad Request errors (invalid request/model/parameters)
        if (
            errorMsg.includes("400") ||
            errorMsg.includes("bad request") ||
            errorMsg.includes("invalid request") ||
            errorBody?.error?.code === "invalid_request_error"
        ) {
            return this.createBadRequestError(
                errorMsg,
                errorBody,
                model,
                statusCode || 400,
            );
        }

        // Check for API key errors
        if (
            errorMsg.includes("API key") ||
            errorMsg.includes("authentication") ||
            errorMsg.includes("unauthorized") ||
            errorBody?.error?.code === "invalid_api_key"
        ) {
            return this.createAPIKeyError(errorMsg, model, statusCode || 401);
        }

        // Check for rate limit errors
        if (
            errorMsg.includes("rate limit") ||
            errorMsg.includes("too many requests") ||
            errorBody?.error?.code === "rate_limit_exceeded"
        ) {
            return this.createRateLimitError(
                errorMsg,
                model,
                statusCode || 429,
            );
        }

        // Check for server errors
        if (
            errorMsg.includes("500") ||
            errorMsg.includes("503") ||
            errorMsg.includes("server error") ||
            errorMsg.includes("overloaded")
        ) {
            return this.createServerError(errorMsg, model, statusCode || 500);
        }

        // Check for connection errors (Ollama, network issues)
        if (
            errorMsg.includes("ECONNREFUSED") ||
            errorMsg.includes("fetch") ||
            errorMsg.includes("network") ||
            errorMsg.includes("connect")
        ) {
            return this.createConnectionError(errorMsg, model, statusCode);
        }

        // Generic error fallback
        return this.createGenericError(errorMsg, model, operation, statusCode);
    }

    /**
     * Extract HTTP status code from error
     */
    private static extractStatusCode(
        error: unknown,
        errorMsg: string,
    ): number | undefined {
        // Try to extract from error object
        if (error && typeof error === "object") {
            if ("status" in error && typeof (error as any).status === "number") {
                return (error as any).status;
            }
            if ("response" in error && (error as any).response && typeof (error as any).response === "object") {
                const response = (error as any).response;
                if ("status" in response && typeof response.status === "number") {
                    return response.status;
                }
            }
            if ("statusCode" in error && typeof (error as any).statusCode === "number") {
                return (error as any).statusCode;
            }
        }

        // Try to extract from error message
        const statusMatch = errorMsg.match(
            /\b(400|401|403|404|429|500|502|503)\b/,
        );
        if (statusMatch) {
            return parseInt(statusMatch[1], 10);
        }

        return undefined;
    }

    /**
     * Context length exceeded error
     */
    private static createContextLengthError(
        errorMsg: string,
        errorBody: unknown,
        model: string,
        statusCode?: number,
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
            statusCode: statusCode,
        };
    }

    /**
     * Model not found error
     */
    private static createModelNotFoundError(
        errorMsg: string,
        model: string,
        statusCode?: number,
    ): StructuredError {
        // Detect provider from model string
        const isOllama = model.includes("ollama");
        const isAnthropic =
            model.includes("anthropic") || model.includes("claude");
        const isOpenRouter = model.includes("openrouter");

        // Get first model from each provider's default list (most recommended)
        const defaultOllama = ModelProviderService.getDefaultOllamaModels()[0];
        const defaultAnthropic =
            ModelProviderService.getDefaultAnthropicModels()[0];
        const defaultOpenRouter =
            ModelProviderService.getDefaultOpenRouterModels()[0];
        const defaultOpenAI = ModelProviderService.getDefaultOpenAIModels()[0];

        // Provide provider-specific suggestions with default models
        let solution: string;
        if (isOllama) {
            solution = `1. Pull the model: ollama pull <model-name>\n2. Check available models: ollama list\n3. Verify model name in settings matches exactly\n4. Try default: ${defaultOllama}`;
        } else if (isAnthropic) {
            solution = `1. Check model name in settings (case-sensitive)\n2. Verify API key has access to this model\n3. Try default: ${defaultAnthropic}`;
        } else if (isOpenRouter) {
            solution = `1. Check model format: provider/model-name\n2. Verify model exists on OpenRouter\n3. Try default: ${defaultOpenRouter}`;
        } else {
            // OpenAI or generic
            solution = `1. Check model name in settings (case-sensitive)\n2. Verify model exists for your provider\n3. Try default: ${defaultOpenAI}`;
        }

        return {
            type: "api",
            message: "Model not found",
            details: errorMsg,
            solution: solution,
            docsLink:
                "https://github.com/wenlzhang/obsidian-task-chat/blob/main/docs/TROUBLESHOOTING.md#2-model-not-found",
            model: model,
            statusCode: statusCode,
        };
    }

    /**
     * 400 Bad Request error
     */
    private static createBadRequestError(
        errorMsg: string,
        errorBody: unknown,
        model: string,
        statusCode: number,
    ): StructuredError {
        // Try to extract specific error from response body
        let details = errorMsg;
        let solution =
            "1. Check model name is correct\n2. Verify request parameters are valid\n3. Check API endpoint configuration\n4. Try a different model";

        // Check if it's a model validation error
        if (
            errorBody &&
            typeof errorBody === "object" &&
            "error" in errorBody &&
            (errorBody as any).error &&
            typeof (errorBody as any).error === "object" &&
            "message" in (errorBody as any).error &&
            typeof (errorBody as any).error.message === "string"
        ) {
            details = (errorBody as any).error.message;

            // Specific guidance for model errors
            if (details.toLowerCase().includes("model")) {
                solution =
                    "1. The model name may be invalid or not exist\n2. Check available models for your provider\n3. Try 'gpt-4o-mini' for OpenAI\n4. Verify model format for OpenRouter (provider/model)";
            }
        }

        return {
            type: "api",
            message: "Bad Request (400)",
            details: details,
            solution: solution,
            docsLink:
                "https://github.com/wenlzhang/obsidian-task-chat/blob/main/docs/TROUBLESHOOTING.md",
            model: model,
            statusCode: statusCode,
        };
    }

    /**
     * API key error
     */
    private static createAPIKeyError(
        errorMsg: string,
        model: string,
        statusCode: number,
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
            statusCode: statusCode,
        };
    }

    /**
     * Rate limit error
     */
    private static createRateLimitError(
        errorMsg: string,
        model: string,
        statusCode: number,
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
            statusCode: statusCode,
        };
    }

    /**
     * Server error (500/503)
     */
    private static createServerError(
        errorMsg: string,
        model: string,
        statusCode: number,
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
            statusCode: statusCode,
        };
    }

    /**
     * Connection error (Ollama, network)
     */
    private static createConnectionError(
        errorMsg: string,
        model: string,
        statusCode?: number,
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
            statusCode: statusCode,
        };
    }

    /**
     * Generic error fallback
     */
    private static createGenericError(
        errorMsg: string,
        model: string,
        operation: "parser" | "analysis",
        statusCode?: number,
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
            statusCode: statusCode,
        };
    }

    /**
     * Create parser error with fallback info
     */
    static createParserError(
        error: unknown,
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
    static createAnalysisError(error: unknown, model: string): StructuredError {
        const structured = this.parseAPIError(error, model, "analysis");

        // Analysis errors don't have automatic fallback
        // User needs to fix the issue (reduce tokens, change model, etc.)
        return structured;
    }
}
