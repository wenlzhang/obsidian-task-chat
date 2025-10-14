import { Notice, requestUrl } from "obsidian";
import { Task, ChatMessage, TokenUsage } from "../models/task";
import { PluginSettings } from "../settings";
import { TaskSearchService } from "./taskSearchService";

/**
 * Service for AI chat functionality
 */
export class AIService {
    /**
     * Send a chat message and get AI response
     */
    static async sendMessage(
        message: string,
        tasks: Task[],
        chatHistory: ChatMessage[],
        settings: PluginSettings,
    ): Promise<{
        response: string;
        recommendedTasks?: Task[];
        tokenUsage?: TokenUsage;
        directResults?: Task[];
    }> {
        if (!settings.apiKey || settings.apiKey.trim() === "") {
            throw new Error(
                "API key is not configured. Please set it in the plugin settings.",
            );
        }

        // Analyze query intent
        const intent = TaskSearchService.analyzeQueryIntent(message);

        // First, search for relevant tasks locally
        const relevantTasks = TaskSearchService.searchTasks(
            tasks,
            message,
            20, // Get top 20 relevant tasks for initial search
        );

        // If search found clear matches and it's a simple search query, return directly
        if (
            intent.isSearch &&
            !intent.isPriority &&
            relevantTasks.length > 0 &&
            relevantTasks.length <= 10
        ) {
            // Return tasks directly without AI processing
            return {
                response: "", // No AI response needed
                directResults: relevantTasks,
                tokenUsage: {
                    promptTokens: 0,
                    completionTokens: 0,
                    totalTokens: 0,
                    estimatedCost: 0,
                    model: settings.model,
                },
            };
        }

        // Use only top 5-10 most relevant tasks for AI analysis (reduce tokens)
        const maxTasksForAI =
            relevantTasks.length > 0
                ? Math.min(10, relevantTasks.length)
                : Math.min(10, tasks.length);
        const tasksToAnalyze =
            relevantTasks.length > 0
                ? relevantTasks.slice(0, maxTasksForAI)
                : tasks.slice(0, maxTasksForAI);

        const taskContext = this.buildTaskContext(tasksToAnalyze, intent);
        const messages = this.buildMessages(
            message,
            taskContext,
            chatHistory,
            settings,
            intent,
        );

        try {
            const { response, tokenUsage } = await this.callAI(
                messages,
                settings,
            );

            // Extract task IDs that AI referenced
            const recommendedTasks = this.extractRecommendedTasks(
                response,
                tasksToAnalyze,
            );

            return {
                response,
                recommendedTasks,
                tokenUsage,
            };
        } catch (error) {
            console.error("AI Service Error:", error);
            throw error;
        }
    }

    /**
     * Build task context for AI with task IDs
     */
    private static buildTaskContext(tasks: Task[], intent: any): string {
        if (tasks.length === 0) {
            return "No tasks found matching your query.";
        }

        let context = `Found ${tasks.length} relevant task(s):\n\n`;

        tasks.forEach((task, index) => {
            // Use 1-based indexing for better UX
            const taskId = `[TASK_${index + 1}]`;
            const parts: string[] = [];

            // Add task ID and content
            parts.push(`${taskId} ${task.text}`);

            // Add metadata
            const metadata: string[] = [];
            metadata.push(`Status: ${task.statusCategory}`);

            if (task.priority && task.priority !== "none") {
                metadata.push(`Priority: ${task.priority}`);
            }

            if (task.dueDate) {
                metadata.push(`Due: ${task.dueDate}`);
            }

            if (task.folder) {
                metadata.push(`Folder: ${task.folder}`);
            }

            if (task.tags && task.tags.length > 0) {
                metadata.push(`Tags: ${task.tags.join(", ")}`);
            }

            context += `${parts.join("")}\n  ${metadata.join(" | ")}\n\n`;
        });

        return context;
    }

    /**
     * Build messages array for AI API
     */
    private static buildMessages(
        userMessage: string,
        taskContext: string,
        chatHistory: ChatMessage[],
        settings: PluginSettings,
        intent: any,
    ): any[] {
        // Get language instruction based on settings
        let languageInstruction = "";
        switch (settings.responseLanguage) {
            case "english":
                languageInstruction = "Always respond in English.";
                break;
            case "chinese":
                languageInstruction = "Always respond in Chinese (中文).";
                break;
            case "custom":
                languageInstruction = settings.customLanguageInstruction;
                break;
            case "auto":
            default:
                languageInstruction =
                    "Respond in the same language as the user's query. If the query mixes multiple languages, use the primary language detected.";
                break;
        }

        // Build context-aware system prompt
        let systemPrompt = `You are a task management assistant for Obsidian. Your role is to help users find, prioritize, and manage their EXISTING tasks.

IMPORTANT RULES:
1. ONLY reference tasks from the provided task list
2. DO NOT create new tasks or suggest tasks that don't exist
3. DO NOT provide generic advice unless no relevant tasks are found
4. When recommending tasks, ALWAYS use their [TASK_X] IDs (e.g., [TASK_1], [TASK_2])
5. Focus on helping users prioritize and execute existing tasks
6. Be concise and actionable
7. ${languageInstruction}

${taskContext}`;

        const messages: any[] = [
            {
                role: "system",
                content: systemPrompt,
            },
        ];

        // Add recent chat history (limit to last 6 messages to save tokens)
        const recentHistory = chatHistory.slice(-6);
        recentHistory.forEach((msg) => {
            if (msg.role !== "system") {
                messages.push({
                    role: msg.role,
                    content: msg.content,
                });
            }
        });

        // Add current user message
        messages.push({
            role: "user",
            content: userMessage,
        });

        return messages;
    }

    /**
     * Calculate estimated cost based on token usage and model
     */
    private static calculateCost(
        promptTokens: number,
        completionTokens: number,
        model: string,
    ): number {
        // Pricing per 1M tokens (as of 2024)
        const pricing: Record<string, { input: number; output: number }> = {
            "gpt-4o": { input: 2.5, output: 10.0 },
            "gpt-4o-mini": { input: 0.15, output: 0.6 },
            "gpt-4-turbo": { input: 10.0, output: 30.0 },
            "gpt-4": { input: 30.0, output: 60.0 },
            "gpt-3.5-turbo": { input: 0.5, output: 1.5 },
            "claude-3-5-sonnet-20241022": { input: 3.0, output: 15.0 },
            "claude-3-opus": { input: 15.0, output: 75.0 },
            "claude-3-sonnet": { input: 3.0, output: 15.0 },
            "claude-3-haiku": { input: 0.25, output: 1.25 },
        };

        // Find matching pricing (case insensitive)
        const modelLower = model.toLowerCase();
        let rates = null;

        for (const [key, value] of Object.entries(pricing)) {
            if (modelLower.includes(key.toLowerCase())) {
                rates = value;
                break;
            }
        }

        // Default to gpt-4o-mini pricing if unknown
        if (!rates) {
            rates = pricing["gpt-4o-mini"];
        }

        // Calculate cost (pricing is per 1M tokens, so divide by 1,000,000)
        const inputCost = (promptTokens / 1000000) * rates.input;
        const outputCost = (completionTokens / 1000000) * rates.output;

        return inputCost + outputCost;
    }

    /**
     * Call AI API
     */
    private static async callAI(
        messages: any[],
        settings: PluginSettings,
    ): Promise<{ response: string; tokenUsage: TokenUsage }> {
        const endpoint = settings.apiEndpoint;

        if (settings.aiProvider === "ollama") {
            return this.callOllama(messages, settings);
        }

        // OpenAI-compatible API call
        const response = await requestUrl({
            url: endpoint,
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                Authorization: `Bearer ${settings.apiKey}`,
            },
            body: JSON.stringify({
                model: settings.model,
                messages: messages,
                temperature: 0.7,
                max_tokens: 1000,
            }),
        });

        if (response.status !== 200) {
            throw new Error(
                `AI API error: ${response.status} ${response.text}`,
            );
        }

        const data = response.json;
        const content = data.choices[0].message.content;

        // Extract token usage
        const usage = data.usage || {};
        const promptTokens = usage.prompt_tokens || 0;
        const completionTokens = usage.completion_tokens || 0;
        const totalTokens =
            usage.total_tokens || promptTokens + completionTokens;

        const tokenUsage: TokenUsage = {
            promptTokens,
            completionTokens,
            totalTokens,
            estimatedCost: this.calculateCost(
                promptTokens,
                completionTokens,
                settings.model,
            ),
            model: settings.model,
        };

        return {
            response: content,
            tokenUsage,
        };
    }

    /**
     * Call Ollama API
     */
    private static async callOllama(
        messages: any[],
        settings: PluginSettings,
    ): Promise<{ response: string; tokenUsage: TokenUsage }> {
        const endpoint =
            settings.apiEndpoint || "http://localhost:11434/api/chat";

        const response = await requestUrl({
            url: endpoint,
            method: "POST",
            headers: {
                "Content-Type": "application/json",
            },
            body: JSON.stringify({
                model: settings.model,
                messages: messages,
                stream: false,
            }),
        });

        if (response.status !== 200) {
            throw new Error(
                `Ollama API error: ${response.status} ${response.text}`,
            );
        }

        const data = response.json;
        const content = data.message.content;

        // Ollama doesn't provide token counts, estimate
        const estimatedPromptTokens = JSON.stringify(messages).length / 4;
        const estimatedCompletionTokens = content.length / 4;

        const tokenUsage: TokenUsage = {
            promptTokens: Math.round(estimatedPromptTokens),
            completionTokens: Math.round(estimatedCompletionTokens),
            totalTokens: Math.round(
                estimatedPromptTokens + estimatedCompletionTokens,
            ),
            estimatedCost: 0, // Ollama is local, no cost
            model: settings.model,
        };

        return {
            response: content,
            tokenUsage,
        };
    }

    /**
     * Extract recommended tasks from AI response using task IDs
     */
    private static extractRecommendedTasks(
        response: string,
        tasks: Task[],
    ): Task[] {
        const recommended: Task[] = [];

        // Extract [TASK_X] references from response
        const taskIdPattern = /\[TASK_(\d+)\]/g;
        const matches = response.matchAll(taskIdPattern);

        const referencedIndices = new Set<number>();
        for (const match of matches) {
            const index = parseInt(match[1]);
            // Convert from 1-based to 0-based indexing
            const taskIndex = index - 1;
            if (taskIndex >= 0 && taskIndex < tasks.length) {
                referencedIndices.add(taskIndex);
            }
        }

        // Add tasks in the order they appear in response
        const sortedIndices = Array.from(referencedIndices).sort(
            (a, b) => a - b,
        );
        sortedIndices.forEach((index) => {
            recommended.push(tasks[index]);
        });

        // If no task IDs were found, try fuzzy matching (fallback)
        if (recommended.length === 0) {
            tasks.forEach((task) => {
                // Check if significant portion of task text appears in response
                const taskWords = task.text
                    .split(/\s+/)
                    .filter((w) => w.length > 3);
                const matchCount = taskWords.filter((word) =>
                    response.toLowerCase().includes(word.toLowerCase()),
                ).length;

                if (
                    matchCount >= Math.min(3, taskWords.length) &&
                    matchCount / taskWords.length > 0.5
                ) {
                    if (!recommended.includes(task)) {
                        recommended.push(task);
                    }
                }
            });
        }

        return recommended.slice(0, 10); // Limit to top 10
    }
}
