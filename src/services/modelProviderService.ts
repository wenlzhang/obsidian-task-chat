import { requestUrl } from "obsidian";
import { PluginSettings, getCurrentProviderConfig } from "../settings";

/**
 * Service for fetching available AI models from different providers
 */
export class ModelProviderService {
    /**
     * Fetch available models from OpenAI
     */
    static async fetchOpenAIModels(apiKey: string): Promise<string[]> {
        try {
            const response = await requestUrl({
                url: "https://api.openai.com/v1/models",
                method: "GET",
                headers: {
                    Authorization: `Bearer ${apiKey}`,
                },
            });

            if (response.status !== 200) {
                console.error("Failed to fetch OpenAI models:", response);
                return this.getDefaultOpenAIModels();
            }

            const data = response.json;
            // Include all models - don't filter out anything
            // OpenAI's API returns all available models including specialized ones
            const allModels = data.data
                .map((model: any) => model.id)
                .sort()
                .reverse();

            return allModels.length > 0
                ? allModels
                : this.getDefaultOpenAIModels();
        } catch (error) {
            console.error("Error fetching OpenAI models:", error);
            return this.getDefaultOpenAIModels();
        }
    }

    /**
     * Default OpenAI models (fallback)
     * Simplified to 1-2 representative models per series
     */
    static getDefaultOpenAIModels(): string[] {
        return [
            // GPT-5 series (latest generation)
            "gpt-5",
            "gpt-5-mini",
            "gpt-5-nano",
            "gpt-5-pro",

            // GPT-4.1 series
            "gpt-4.1",
            "gpt-4.1-mini",
            "gpt-4.1-nano",

            // GPT-4o series
            "gpt-4o",
            "gpt-4o-mini",

            // o-series reasoning models
            "o4-mini",
            "o4-mini-deep-research",
            "o3",
            "o3-mini",
            "o2",
            "o2-mini",
            "o1",
            "o1-mini",
            "o1-pro",

            // Specialized models
            "gpt-realtime",
            "gpt-realtime-mini",
            "gpt-audio",
            "gpt-audio-mini",
            "gpt-image-1",

            // GPT-4 Turbo
            "gpt-4-turbo",

            // GPT-4 classic
            "gpt-4",

            // GPT-3.5 Turbo
            "gpt-3.5-turbo",
        ];
    }

    /**
     * Fetch available models from Anthropic
     */
    static async fetchAnthropicModels(apiKey: string): Promise<string[]> {
        // Anthropic doesn't have a public models API endpoint yet
        // Return hardcoded list of current models
        return this.getDefaultAnthropicModels();
    }

    /**
     * Default Anthropic models
     */
    static getDefaultAnthropicModels(): string[] {
        return ["claude-sonnet-4"];
    }

    /**
     * Fetch available models from OpenRouter
     */
    static async fetchOpenRouterModels(apiKey: string): Promise<string[]> {
        try {
            const response = await requestUrl({
                url: "https://openrouter.ai/api/v1/models",
                method: "GET",
                headers: {
                    Authorization: `Bearer ${apiKey}`,
                },
            });

            if (response.status !== 200) {
                console.error("Failed to fetch OpenRouter models:", response);
                return this.getDefaultOpenRouterModels();
            }

            const data = response.json;
            // Get model IDs and sort by popularity/recency
            const models = data.data.map((model: any) => model.id).sort();

            return models.length > 0
                ? models
                : this.getDefaultOpenRouterModels();
        } catch (error) {
            console.error("Error fetching OpenRouter models:", error);
            return this.getDefaultOpenRouterModels();
        }
    }

    /**
     * Default OpenRouter models (popular ones)
     */
    static getDefaultOpenRouterModels(): string[] {
        return [
            "openai/gpt-4o",
            "openai/gpt-4o-mini",
            "openai/gpt-4-turbo",
            "openai/o1-preview",
            "anthropic/claude-sonnet-4",
            "google/gemini-pro-1.5",
            "google/gemini-flash-1.5",
            "meta-llama/llama-3.1-70b-instruct",
            "meta-llama/llama-3.1-8b-instruct",
            "mistralai/mistral-large",
            "cohere/command-r-plus",
        ];
    }

    /**
     * Fetch available models from local Ollama installation
     */
    static async fetchOllamaModels(endpoint?: string): Promise<string[]> {
        try {
            const baseUrl = endpoint
                ? endpoint.replace("/api/chat", "")
                : "http://localhost:11434";

            const response = await requestUrl({
                url: `${baseUrl}/api/tags`,
                method: "GET",
            });

            if (response.status !== 200) {
                console.error("Failed to fetch Ollama models:", response);
                return this.getDefaultOllamaModels();
            }

            const data = response.json;
            // Extract model names
            const models = data.models
                ? data.models.map((model: any) => model.name)
                : [];

            return models.length > 0 ? models : this.getDefaultOllamaModels();
        } catch (error) {
            console.error(
                "Error fetching Ollama models (is Ollama running?):",
                error,
            );
            return this.getDefaultOllamaModels();
        }
    }

    /**
     * Default Ollama models (popular suggestions)
     */
    static getDefaultOllamaModels(): string[] {
        return [
            "llama3.2:latest",
            "llama3.1:latest",
            "llama3.1:8b",
            "llama3.1:70b",
            "mistral:latest",
            "mistral:7b",
            "phi3:latest",
            "qwen2.5:latest",
            "gemma2:latest",
            "codellama:latest",
        ];
    }

    /**
     * Get current API key for provider
     */
    private static getApiKey(
        provider: string,
        settings: PluginSettings,
    ): string {
        return getCurrentProviderConfig(settings).apiKey || "";
    }

    /**
     * Test OpenAI connection and model availability
     */
    static async testOpenAIConnection(
        apiKey: string,
        model: string,
    ): Promise<{ success: boolean; message: string }> {
        try {
            // First verify API key is valid by fetching models
            const response = await requestUrl({
                url: "https://api.openai.com/v1/models",
                method: "GET",
                headers: {
                    Authorization: `Bearer ${apiKey}`,
                },
            });

            if (response.status !== 200) {
                return {
                    success: false,
                    message: `Invalid API key or connection failed (${response.status})`,
                };
            }

            // Check if the selected model exists
            const data = response.json;
            const modelExists = data.data.some((m: any) => m.id === model);

            if (!modelExists) {
                return {
                    success: true,
                    message: `API key valid, but model "${model}" not found. You may need to update the model selection.`,
                };
            }

            return {
                success: true,
                message: `✓ Connection successful! Model "${model}" is available.`,
            };
        } catch (error) {
            return {
                success: false,
                message: `Connection failed: ${error.message || "Unknown error"}`,
            };
        }
    }

    /**
     * Test Anthropic connection
     */
    static async testAnthropicConnection(
        apiKey: string,
        model: string,
    ): Promise<{ success: boolean; message: string }> {
        try {
            // Make a minimal test request to Anthropic API
            const response = await requestUrl({
                url: "https://api.anthropic.com/v1/messages",
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    "x-api-key": apiKey,
                    "anthropic-version": "2023-06-01",
                },
                body: JSON.stringify({
                    model: model,
                    messages: [{ role: "user", content: "test" }],
                    max_tokens: 10,
                }),
            });

            if (response.status === 200) {
                return {
                    success: true,
                    message: `✓ Connection successful! Model "${model}" is working.`,
                };
            } else {
                return {
                    success: false,
                    message: `API returned status ${response.status}`,
                };
            }
        } catch (error) {
            // Parse error message
            const errorMsg = error.message || String(error);
            if (errorMsg.includes("401")) {
                return {
                    success: false,
                    message:
                        "Invalid API key. Please check your Anthropic API key.",
                };
            } else if (errorMsg.includes("model")) {
                return {
                    success: false,
                    message: `Model "${model}" not available. Please select a different model.`,
                };
            }
            return {
                success: false,
                message: `Connection failed: ${errorMsg}`,
            };
        }
    }

    /**
     * Test OpenRouter connection
     */
    static async testOpenRouterConnection(
        apiKey: string,
        model: string,
    ): Promise<{ success: boolean; message: string }> {
        try {
            // Verify by fetching models list
            const response = await requestUrl({
                url: "https://openrouter.ai/api/v1/models",
                method: "GET",
                headers: {
                    Authorization: `Bearer ${apiKey}`,
                },
            });

            if (response.status !== 200) {
                return {
                    success: false,
                    message: `Invalid API key or connection failed (${response.status})`,
                };
            }

            // Check if selected model exists
            const data = response.json;
            const modelExists = data.data.some((m: any) => m.id === model);

            if (!modelExists) {
                return {
                    success: true,
                    message: `API key valid, but model "${model}" not found. Click Refresh to update model list.`,
                };
            }

            return {
                success: true,
                message: `✓ Connection successful! Model "${model}" is available.`,
            };
        } catch (error) {
            return {
                success: false,
                message: `Connection failed: ${error.message || "Unknown error"}`,
            };
        }
    }

    /**
     * Test Ollama connection
     */
    static async testOllamaConnection(
        endpoint: string,
        model: string,
    ): Promise<{ success: boolean; message: string }> {
        try {
            const baseUrl = endpoint
                ? endpoint.replace("/api/chat", "")
                : "http://localhost:11434";

            // First check if Ollama is running
            const tagsResponse = await requestUrl({
                url: `${baseUrl}/api/tags`,
                method: "GET",
            });

            if (tagsResponse.status !== 200) {
                return {
                    success: false,
                    message:
                        "Ollama server not responding. Make sure Ollama is running.",
                };
            }

            // Check if model is installed
            const data = tagsResponse.json;
            const installedModels = data.models
                ? data.models.map((m: any) => m.name)
                : [];

            const modelInstalled = installedModels.some(
                (m: string) => m === model || m.startsWith(model),
            );

            if (!modelInstalled) {
                return {
                    success: false,
                    message: `Model "${model}" not found. Install it with: ollama pull ${model}`,
                };
            }

            // Test actual generation
            const testResponse = await requestUrl({
                url: `${baseUrl}/api/generate`,
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                },
                body: JSON.stringify({
                    model: model,
                    prompt: "test",
                    stream: false,
                }),
            });

            if (testResponse.status === 200) {
                return {
                    success: true,
                    message: `✓ Ollama connection successful! Model "${model}" is ready.`,
                };
            } else {
                return {
                    success: false,
                    message: `Model test failed (${testResponse.status})`,
                };
            }
        } catch (error) {
            const errorMsg = error.message || String(error);
            if (
                errorMsg.includes("ECONNREFUSED") ||
                errorMsg.includes("fetch")
            ) {
                return {
                    success: false,
                    message:
                        "Cannot connect to Ollama. Make sure Ollama is running with CORS enabled.",
                };
            }
            return {
                success: false,
                message: `Connection failed: ${errorMsg}`,
            };
        }
    }
}
