import { Notice, requestUrl } from "obsidian";
import { Task, ChatMessage } from "../models/task";
import { PluginSettings } from "../settings";

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
    ): Promise<{ response: string; recommendedTasks?: Task[] }> {
        if (!settings.apiKey || settings.apiKey.trim() === "") {
            throw new Error(
                "API key is not configured. Please set it in the plugin settings.",
            );
        }

        const taskContext = this.buildTaskContext(tasks);
        const messages = this.buildMessages(
            message,
            taskContext,
            chatHistory,
            settings,
        );

        try {
            const response = await this.callAI(messages, settings);
            const recommendedTasks = this.extractRecommendedTasks(
                response,
                tasks,
            );

            return {
                response,
                recommendedTasks,
            };
        } catch (error) {
            console.error("AI Service Error:", error);
            throw error;
        }
    }

    /**
     * Build task context for AI
     */
    private static buildTaskContext(tasks: Task[]): string {
        if (tasks.length === 0) {
            return "No tasks match the current filter criteria.";
        }

        let context = `Current tasks (${tasks.length} total):\n\n`;

        tasks.forEach((task, index) => {
            const parts: string[] = [];
            parts.push(`${index + 1}. [${task.statusCategory}] ${task.text}`);

            if (task.priority && task.priority !== "none") {
                parts.push(`Priority: ${task.priority}`);
            }

            if (task.dueDate) {
                parts.push(`Due: ${task.dueDate}`);
            }

            if (task.folder) {
                parts.push(`Folder: ${task.folder}`);
            }

            context += parts.join(" | ") + "\n";
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
    ): any[] {
        const messages: any[] = [
            {
                role: "system",
                content: settings.systemPrompt + "\n\n" + taskContext,
            },
        ];

        // Add recent chat history (limit to last N messages)
        const recentHistory = chatHistory.slice(-10);
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
     * Call AI API
     */
    private static async callAI(
        messages: any[],
        settings: PluginSettings,
    ): Promise<string> {
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
        return data.choices[0].message.content;
    }

    /**
     * Call Ollama API
     */
    private static async callOllama(
        messages: any[],
        settings: PluginSettings,
    ): Promise<string> {
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
        return data.message.content;
    }

    /**
     * Extract recommended tasks from AI response
     * Looks for task references in the response
     */
    private static extractRecommendedTasks(
        response: string,
        tasks: Task[],
    ): Task[] {
        const recommended: Task[] = [];
        const responseLines = response.split("\n");

        responseLines.forEach((line) => {
            tasks.forEach((task) => {
                // Check if task text appears in the response
                if (
                    line.includes(task.text.substring(0, 30)) &&
                    !recommended.includes(task)
                ) {
                    recommended.push(task);
                }
            });
        });

        return recommended;
    }
}
