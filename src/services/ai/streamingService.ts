import { Logger } from "../../utils/logger";

/**
 * Server-Sent Events (SSE) Parser for AI Streaming
 *
 * Handles provider-specific SSE formats for:
 * - OpenAI / OpenRouter (OpenAI-compatible)
 * - Anthropic Claude
 * - Ollama
 */

export interface StreamChunk {
    content: string;
    done: boolean;
    tokenUsage?: {
        promptTokens?: number;
        completionTokens?: number;
        totalTokens?: number;
        tokenSource?: "actual" | "estimated"; // Whether tokens came from API or were estimated
    };
    generationId?: string; // For OpenRouter
}

export class StreamingService {
    /**
     * Parse SSE stream and yield text chunks
     *
     * @param reader - ReadableStream reader from fetch response
     * @param provider - AI provider name
     * @yields Text chunks as they arrive
     */
    static async *parseSSE(
        reader: ReadableStreamDefaultReader<Uint8Array>,
        provider: string,
    ): AsyncGenerator<StreamChunk> {
        const decoder = new TextDecoder();
        let buffer = "";

        try {
            while (true) {
                const { done, value } = await reader.read();

                if (done) {
                    Logger.debug("Stream completed");
                    break;
                }

                // Decode chunk and add to buffer
                buffer += decoder.decode(value, { stream: true });

                // Split by newlines (SSE format)
                const lines = buffer.split("\n");

                // Keep last incomplete line in buffer
                buffer = lines.pop() || "";

                // Process complete lines
                for (const line of lines) {
                    const chunk = this.parseChunk(line, provider);
                    if (chunk) {
                        yield chunk;
                        if (chunk.done) return; // Stream complete
                    }
                }
            }

            // Process any remaining buffer
            if (buffer.trim()) {
                const chunk = this.parseChunk(buffer, provider);
                if (chunk) yield chunk;
            }
        } catch (error) {
            Logger.error("SSE parsing error:", error);
            throw error;
        }
    }

    /**
     * Parse a single SSE line based on provider format
     */
    private static parseChunk(
        line: string,
        provider: string,
    ): StreamChunk | null {
        // Skip empty lines
        if (!line.trim()) return null;

        try {
            switch (provider.toLowerCase()) {
                case "openai":
                case "openrouter":
                    return this.parseOpenAIChunk(line);
                case "anthropic":
                    return this.parseAnthropicChunk(line);
                case "ollama":
                    return this.parseOllamaChunk(line);
                default:
                    Logger.warn(`Unknown provider for streaming: ${provider}`);
                    return null;
            }
        } catch (error) {
            Logger.debug(`Failed to parse chunk: ${line}`, error);
            return null;
        }
    }

    /**
     * Parse OpenAI / OpenRouter SSE format
     *
     * Format:
     * data: {"id":"chatcmpl-123","choices":[{"delta":{"content":"Hello"},"finish_reason":null}]}
     * data: [DONE]
     */
    private static parseOpenAIChunk(line: string): StreamChunk | null {
        // SSE lines start with "data: "
        if (!line.startsWith("data: ")) return null;

        const data = line.substring(6).trim();

        // Stream end marker - but don't mark as done yet
        // With stream_options.include_usage, OpenAI sends usage AFTER [DONE]
        if (data === "[DONE]") {
            return { content: "", done: false }; // Don't stop, wait for usage
        }

        try {
            const json = JSON.parse(data);

            // Extract content from delta
            const content = json.choices?.[0]?.delta?.content || "";
            const finishReason = json.choices?.[0]?.finish_reason;

            // Extract token usage (sent in final chunk with stream_options)
            const usage = json.usage
                ? {
                      promptTokens: json.usage.prompt_tokens,
                      completionTokens: json.usage.completion_tokens,
                      totalTokens: json.usage.total_tokens,
                      tokenSource: "actual" as const, // Tokens from API are actual, not estimated
                  }
                : undefined;

            // Log raw usage data from API for debugging
            if (json.usage) {
                Logger.debug(
                    `[Streaming] ✓ Raw API usage data: ${JSON.stringify(json.usage)}`,
                );
                Logger.debug(
                    `[Streaming] ✓ Token counts: ${String((json.usage as Record<string, unknown>).prompt_tokens)} prompt + ${String((json.usage as Record<string, unknown>).completion_tokens)} completion = ${String((json.usage as Record<string, unknown>).total_tokens)} total`,
                );
            }

            // Debug: Log chunk ID (could be generation ID for OpenRouter)
            // This ID is crucial for fetching actual costs from OpenRouter
            if (json.id) {
                Logger.debug(
                    `[Streaming] ✓ Chunk ID from response: ${String(json.id)} (type: ${typeof json.id})`,
                );
                if (
                    json.id.startsWith("gen-") ||
                    json.id.startsWith("chatcmpl-")
                ) {
                    Logger.debug(
                        `[Streaming] ✓ ID format looks valid for generation ID`,
                    );
                }
            } else if (finishReason || usage) {
                // If we're finishing but don't have an ID, that's a problem
                Logger.warn(
                    `[Streaming] ⚠️ No generation ID in final chunk! Cannot fetch actual costs.`,
                );
            }

            // Done when we have finish_reason OR when we receive usage info
            // (usage comes in last chunk after [DONE])
            const isDone =
                finishReason === "stop" ||
                finishReason === "length" ||
                usage !== undefined;

            return {
                content,
                done: isDone,
                tokenUsage: usage,
                generationId: json.id || undefined, // Capture generation ID for OpenRouter
            };
        } catch (error) {
            Logger.debug("Failed to parse OpenAI chunk:", data);
            return null;
        }
    }

    /**
     * Parse Anthropic SSE format
     *
     * Format:
     * event: message_start
     * data: {"type":"message_start","message":{"id":"msg_123"}}
     *
     * event: content_block_delta
     * data: {"type":"content_block_delta","delta":{"type":"text_delta","text":"Hello"}}
     *
     * event: message_stop
     * data: {"type":"message_stop"}
     */
    private static parseAnthropicChunk(line: string): StreamChunk | null {
        // Anthropic uses event-based format
        // We need to handle both "event:" and "data:" lines

        // Check if this is an event line
        if (line.startsWith("event: ")) {
            const eventType = line.substring(7).trim();

            // Stream complete
            if (
                eventType === "message_stop" ||
                eventType === "content_block_stop"
            ) {
                return { content: "", done: true };
            }

            // For other events, return null (wait for data line)
            return null;
        }

        // Parse data line
        if (line.startsWith("data: ")) {
            const data = line.substring(6).trim();

            try {
                const json = JSON.parse(data);

                // Extract text from content_block_delta
                if (json.type === "content_block_delta") {
                    const text = json.delta?.text || "";
                    return { content: text, done: false };
                }

                // Extract token usage from message_start (input tokens only)
                if (json.type === "message_start") {
                    const usage = json.message?.usage;
                    if (usage) {
                        return {
                            content: "",
                            done: false,
                            tokenUsage: {
                                promptTokens: usage.input_tokens,
                                completionTokens: usage.output_tokens || 0,
                                totalTokens:
                                    usage.input_tokens +
                                    (usage.output_tokens || 0),
                                tokenSource: "actual" as const, // Tokens from API are actual
                            },
                        };
                    }
                }

                // Extract final token usage from message_delta (complete counts)
                if (json.type === "message_delta") {
                    const usage = json.usage;
                    if (usage) {
                        return {
                            content: "",
                            done: false,
                            tokenUsage: {
                                promptTokens: 0, // Already sent in message_start
                                completionTokens: usage.output_tokens || 0,
                                totalTokens: usage.output_tokens || 0,
                                tokenSource: "actual" as const, // Tokens from API are actual
                            },
                        };
                    }
                }

                return null;
            } catch (error) {
                Logger.debug("Failed to parse Anthropic chunk:", data);
                return null;
            }
        }

        return null;
    }

    /**
     * Parse Ollama SSE format (OpenAI-compatible)
     *
     * Format:
     * data: {"model":"qwen3:14b","message":{"content":"Hello"},"done":false}
     * data: {"model":"qwen3:14b","message":{"content":""},"done":true}
     */
    private static parseOllamaChunk(line: string): StreamChunk | null {
        // Ollama uses "data: " prefix like OpenAI
        if (!line.startsWith("data: ")) return null;

        const data = line.substring(6).trim();

        try {
            const json = JSON.parse(data);

            // Extract content from message
            const content = json.message?.content || "";
            const done = json.done === true;

            // Extract token usage from final message
            const usage =
                done && json.prompt_eval_count !== undefined
                    ? {
                          promptTokens: json.prompt_eval_count,
                          completionTokens: json.eval_count,
                          totalTokens: json.prompt_eval_count + json.eval_count,
                          tokenSource: "actual" as const, // Tokens from Ollama API are actual
                      }
                    : undefined;

            return {
                content,
                done,
                tokenUsage: usage,
            };
        } catch (error) {
            Logger.debug("Failed to parse Ollama chunk:", data);
            return null;
        }
    }
}
