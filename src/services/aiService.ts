import { Notice, requestUrl } from "obsidian";
import { Task, ChatMessage } from "../models/task";
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
    ): Promise<{ response: string; recommendedTasks?: Task[] }> {
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
            50, // Get top 50 relevant tasks
        );

        // Use relevant tasks if found, otherwise use all tasks
        const tasksToAnalyze =
            relevantTasks.length > 0 ? relevantTasks : tasks.slice(0, 50);

        const taskContext = this.buildTaskContext(tasksToAnalyze, intent);
        const messages = this.buildMessages(
            message,
            taskContext,
            chatHistory,
            settings,
            intent,
        );

        try {
            const response = await this.callAI(messages, settings);

            // Extract task IDs that AI referenced
            const recommendedTasks = this.extractRecommendedTasks(
                response,
                tasksToAnalyze,
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
     * Build task context for AI with task IDs
     */
    private static buildTaskContext(tasks: Task[], intent: any): string {
        if (tasks.length === 0) {
            return "No tasks found matching your query.";
        }

        let context = `Found ${tasks.length} relevant task(s):\n\n`;

        tasks.forEach((task, index) => {
            const taskId = `[TASK_${index}]`;
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
        // Build context-aware system prompt
        let systemPrompt = `You are a task management assistant for Obsidian. Your role is to help users find, prioritize, and manage their EXISTING tasks.

IMPORTANT RULES:
1. ONLY reference tasks from the provided task list
2. DO NOT create new tasks or suggest tasks that don't exist
3. DO NOT provide generic advice unless no relevant tasks are found
4. When recommending tasks, use their [TASK_X] IDs
5. Focus on helping users prioritize and execute existing tasks
6. Be concise and actionable

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
            if (index >= 0 && index < tasks.length) {
                referencedIndices.add(index);
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
