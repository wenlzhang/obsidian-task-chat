import { StructuredError } from "./errorHandler";

/**
 * Service for rendering error messages in chat UI
 * Centralizes error message formatting and display logic
 */
export class ErrorMessageService {
    /**
     * Render structured error message in chat UI
     * Creates DOM elements with simplified metadata
     */
    static renderError(containerEl: HTMLElement, error: StructuredError): void {
        const errorEl = containerEl.createDiv({
            cls: "task-chat-api-error",
        });

        // Error header with icon
        const headerText = this.getErrorTitle(error);
        errorEl.createEl("div", {
            cls: "task-chat-api-error-header",
            text: `⚠️ ${headerText}`,
        });

        const detailsEl = errorEl.createDiv({
            cls: "task-chat-api-error-details",
        });

        // Model info - ONLY metadata we show
        if (error.model) {
            detailsEl.createEl("div", {
                cls: "task-chat-error-model",
                text: `Model: ${error.model}`,
            });
        }

        // Status code (if available)
        if (error.statusCode) {
            detailsEl.createEl("div", {
                cls: "task-chat-error-status",
                text: `Status: ${error.statusCode} ${this.getStatusDescription(error.statusCode)}`,
            });
        }

        // Error details
        detailsEl.createEl("div", {
            cls: "task-chat-error-details-text",
            text: `${error.details}`,
        });

        // Solutions (if available)
        if (error.solution) {
            this.renderSolutions(detailsEl, error.solution);
        }

        // Fallback information (if used)
        if (error.fallbackUsed) {
            this.renderFallback(detailsEl, error.fallbackUsed);
        }

        // Troubleshooting link
        this.renderTroubleshootingLink(detailsEl, error);
    }

    /**
     * Get user-friendly error title
     */
    private static getErrorTitle(error: StructuredError): string {
        // Customize title based on error type
        if (error.type === "parser") {
            return "AI parser failed";
        } else if (error.type === "analysis") {
            return "AI analysis failed";
        } else if (error.message) {
            return error.message;
        }
        return "Error occurred";
    }

    /**
     * Get description for HTTP status code
     */
    private static getStatusDescription(statusCode: number): string {
        const descriptions: Record<number, string> = {
            400: "Bad Request",
            401: "Unauthorized",
            403: "Forbidden",
            404: "Not Found",
            429: "Rate Limit Exceeded",
            500: "Internal Server Error",
            502: "Bad Gateway",
            503: "Service Unavailable",
        };
        return descriptions[statusCode] || "";
    }

    /**
     * Render solutions section
     */
    private static renderSolutions(
        containerEl: HTMLElement,
        solution: string,
    ): void {
        const solutionEl = containerEl.createEl("div", {
            cls: "task-chat-api-error-solution",
        });
        solutionEl.createEl("strong", { text: "💡 solutions: " });

        // Split solution by newlines and create list
        const solutions = solution.split("\n").filter((s: string) => s.trim());
        if (solutions.length > 1) {
            const listEl = solutionEl.createEl("ol");
            solutions.forEach((sol: string) => {
                listEl.createEl("li", {
                    text: sol.replace(/^\d+\.\s*/, ""),
                });
            });
        } else {
            solutionEl.createSpan({ text: solution });
        }
    }

    /**
     * Render fallback information
     */
    private static renderFallback(
        containerEl: HTMLElement,
        fallbackUsed: string,
    ): void {
        const fallbackEl = containerEl.createEl("div", {
            cls: "task-chat-api-error-fallback",
        });
        fallbackEl.createEl("strong", { text: "✓ fallback: " });

        // Check if message contains newlines (numbered list format)
        if (fallbackUsed.includes("\n")) {
            // Split by newlines for numbered list format
            const fallbackMessages = fallbackUsed
                .split("\n")
                .filter((s: string) => s.trim())
                .map((s: string) => s.trim().replace(/^\d+\.\s*/, "")); // Remove leading numbers

            const listEl = fallbackEl.createEl("ol");
            fallbackMessages.forEach((msg: string) => {
                listEl.createEl("li", { text: msg });
            });
        } else {
            // Fallback to old format (split by period)
            const fallbackMessages = fallbackUsed
                .split(". ")
                .filter((s: string) => s.trim())
                .map((s: string) => s.trim() + (s.endsWith(".") ? "" : "."));

            if (fallbackMessages.length > 1) {
                fallbackMessages.forEach((msg: string) => {
                    fallbackEl.createEl("div", { text: msg });
                });
            } else {
                fallbackEl.createSpan({ text: fallbackUsed });
            }
        }
    }

    /**
     * Render troubleshooting link with status code reference
     */
    private static renderTroubleshootingLink(
        containerEl: HTMLElement,
        error: StructuredError,
    ): void {
        const docsEl = containerEl.createEl("div", {
            cls: "task-chat-api-error-docs",
        });
        docsEl.createEl("strong", { text: "📖 help: " });

        // Link to troubleshooting guide (with anchor to status code section if available)
        const baseUrl =
            "https://github.com/wenlzhang/obsidian-task-chat/blob/main/docs/TROUBLESHOOTING.md";
        const linkUrl = error.docsLink || baseUrl;

        const linkEl = docsEl.createEl("a", {
            text: "Troubleshooting guide",
            href: linkUrl,
        });

        // Add provider-specific link if relevant
        if (error.model) {
            const providerLink = this.getProviderDocsLink(error.model);
            if (providerLink) {
                docsEl.appendText(" • ");
                docsEl.createEl("a", {
                    text: "Provider docs",
                    href: providerLink,
                });
            }
        }
    }

    /**
     * Get provider-specific documentation link
     */
    private static getProviderDocsLink(model: string): string | null {
        const modelLower = model.toLowerCase();

        if (modelLower.includes("openai") || modelLower.includes("gpt")) {
            return "https://platform.openai.com/docs/guides/error-codes";
        } else if (
            modelLower.includes("anthropic") ||
            modelLower.includes("claude")
        ) {
            return "https://docs.anthropic.com/en/api/errors";
        } else if (modelLower.includes("openrouter")) {
            return "https://openrouter.ai/docs#errors";
        } else if (modelLower.includes("ollama")) {
            return "https://github.com/ollama/ollama/blob/main/docs/troubleshooting.md";
        }

        return null;
    }
}
