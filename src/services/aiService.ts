import { App, Notice, requestUrl } from "obsidian";
import { Task, ChatMessage, TokenUsage } from "../models/task";
import { PluginSettings } from "../settings";
import { TaskSearchService } from "./taskSearchService";
import { QueryParserService, ParsedQuery } from "./queryParserService";
import { TaskSortService } from "./taskSortService";

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

        // Parse query using AI if enabled, otherwise use regex
        let intent: any;
        let parsedQuery: ParsedQuery | null = null;

        if (settings.useAIQueryParsing) {
            console.log("[Task Chat] Using AI-powered query parsing...");
            // Use AI to parse query for better accuracy
            try {
                parsedQuery = await QueryParserService.parseQuery(
                    message,
                    settings,
                );
                console.log("[Task Chat] AI parsed query:", parsedQuery);
            } catch (error) {
                console.error(
                    "[Task Chat] AI parsing failed, falling back to regex:",
                    error,
                );
                parsedQuery = null;
            }

            // Convert ParsedQuery to intent format for compatibility
            if (parsedQuery) {
                intent = {
                    isSearch: !!(
                        parsedQuery.keywords && parsedQuery.keywords.length > 0
                    ),
                    isPriority: !!parsedQuery.priority,
                    isDueDate: !!parsedQuery.dueDate,
                    keywords: parsedQuery.keywords || [],
                    extractedPriority: parsedQuery.priority || null,
                    extractedDueDateFilter: parsedQuery.dueDate || null,
                    extractedStatus: parsedQuery.status || null,
                    extractedFolder: parsedQuery.folder || null,
                    extractedTags: parsedQuery.tags || [],
                    hasMultipleFilters:
                        [
                            parsedQuery.priority,
                            parsedQuery.dueDate,
                            parsedQuery.status,
                            parsedQuery.folder,
                            parsedQuery.tags?.length,
                            parsedQuery.keywords?.length,
                        ].filter(Boolean).length > 1,
                };
            } else {
                // AI parsing failed, fall back to regex
                intent = TaskSearchService.analyzeQueryIntent(message);
            }
        } else {
            // Use fast regex-based parsing (default)
            console.log("[Task Chat] Using regex-based query parsing...");
            intent = TaskSearchService.analyzeQueryIntent(message);
        }

        // Apply compound filters if any structured filters are detected
        if (
            intent.extractedPriority ||
            intent.extractedDueDateFilter ||
            intent.extractedStatus ||
            intent.extractedFolder ||
            intent.extractedTags.length > 0
        ) {
            console.log("[Task Chat] Extracted intent:", {
                priority: intent.extractedPriority,
                dueDate: intent.extractedDueDateFilter,
                status: intent.extractedStatus,
                folder: intent.extractedFolder,
                tags: intent.extractedTags,
                keywords: intent.keywords,
            });

            const filteredTasks = TaskSearchService.applyCompoundFilters(
                tasks,
                {
                    priority: intent.extractedPriority,
                    dueDate: intent.extractedDueDateFilter,
                    status: intent.extractedStatus,
                    folder: intent.extractedFolder,
                    tags: intent.extractedTags,
                    keywords:
                        intent.keywords.length > 0
                            ? intent.keywords
                            : undefined,
                },
            );

            console.log(
                `[Task Chat] After filtering: ${filteredTasks.length} tasks found`,
            );

            // No tasks found matching the filters
            if (filteredTasks.length === 0) {
                const filterDesc = this.buildFilterDescription(intent);
                return {
                    response: `No tasks found matching ${filterDesc}.`,
                    directResults: [],
                    tokenUsage: {
                        promptTokens: 0,
                        completionTokens: 0,
                        totalTokens: 0,
                        estimatedCost: 0,
                        model: settings.model,
                    },
                };
            }

            // Sort tasks according to user preferences
            const sortedTasks = TaskSortService.sortTasks(
                filteredTasks,
                settings,
            );

            // Simple query - return directly without AI if within limits
            if (
                sortedTasks.length <= settings.maxDirectResults &&
                !intent.hasMultipleFilters &&
                intent.keywords.length === 0
            ) {
                return {
                    response: "",
                    directResults: sortedTasks.slice(
                        0,
                        settings.maxDirectResults,
                    ),
                    tokenUsage: {
                        promptTokens: 0,
                        completionTokens: 0,
                        totalTokens: 0,
                        estimatedCost: 0,
                        model: settings.model,
                    },
                };
            }

            // Complex query or large result set - use AI for refinement
            // Limit to maxTasksForAI for token efficiency
            const tasksToAnalyze = sortedTasks.slice(0, settings.maxTasksForAI);

            const taskContext = this.buildTaskContext(tasksToAnalyze, intent);
            const messages = this.buildMessages(
                message,
                taskContext,
                chatHistory,
                settings,
                intent,
            );

            const { response, tokenUsage } = await this.callAI(
                messages,
                settings,
            );

            const recommendedTasks = this.extractRecommendedTasks(
                response,
                tasksToAnalyze,
                settings,
            );

            return {
                response,
                recommendedTasks,
                tokenUsage,
            };
        }

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

        // Sort and select top tasks for AI analysis
        const tasksToSort = relevantTasks.length > 0 ? relevantTasks : tasks;
        const sortedTasks = TaskSortService.sortTasks(tasksToSort, settings);

        const tasksToAnalyze = sortedTasks.slice(0, settings.maxTasksForAI);

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
                settings,
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
     * Build a human-readable description of applied filters
     */
    private static buildFilterDescription(intent: any): string {
        const parts: string[] = [];

        if (intent.extractedPriority) {
            parts.push(`priority: ${intent.extractedPriority}`);
        }

        if (intent.extractedDueDateFilter) {
            parts.push(`due date: ${intent.extractedDueDateFilter}`);
        }

        if (intent.extractedStatus) {
            parts.push(`status: ${intent.extractedStatus}`);
        }

        if (intent.extractedFolder) {
            parts.push(`folder: ${intent.extractedFolder}`);
        }

        if (intent.extractedTags && intent.extractedTags.length > 0) {
            parts.push(`tags: ${intent.extractedTags.join(", ")}`);
        }

        if (intent.keywords && intent.keywords.length > 0) {
            parts.push(`keywords: ${intent.keywords.join(", ")}`);
        }

        return parts.length > 0 ? parts.join("; ") : "your criteria";
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

            if (task.priority) {
                // Display priority with semantic label
                const priorityLabels = {
                    1: "1 (highest)",
                    2: "2 (high)",
                    3: "3 (medium)",
                    4: "4 (low)",
                };
                const label =
                    priorityLabels[
                        task.priority as keyof typeof priorityLabels
                    ] || task.priority;
                metadata.push(`Priority: ${label}`);
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
     * Build priority mapping documentation from user settings
     */
    private static buildPriorityMapping(settings: PluginSettings): string {
        const mapping = settings.dataviewPriorityMapping;
        const lines = [];

        if (mapping[1] && mapping[1].length > 0) {
            lines.push(`- HIGH priority (1): ${mapping[1].join(", ")}`);
        }
        if (mapping[2] && mapping[2].length > 0) {
            lines.push(`- MEDIUM priority (2): ${mapping[2].join(", ")}`);
        }
        if (mapping[3] && mapping[3].length > 0) {
            lines.push(`- LOW priority (3): ${mapping[3].join(", ")}`);
        }
        if (mapping[4] && mapping[4].length > 0) {
            lines.push(`- LOWEST priority (4): ${mapping[4].join(", ")}`);
        }

        if (lines.length === 0) {
            return "";
        }

        return `\nPRIORITY MAPPING (DataView format [${settings.dataviewKeys.priority}::value]):\n${lines.join("\n")}\n\nWhen users ask for tasks by priority, search using these values.`;
    }

    /**
     * Build due date documentation from user settings
     */
    private static buildDueDateMapping(settings: PluginSettings): string {
        const dueDateKey = settings.dataviewKeys.dueDate;
        return `\nDUE DATE SUPPORT:\n- DataView format: [${dueDateKey}::YYYY-MM-DD]\n- Users may ask for tasks "due today", "due this week", "overdue", etc.\n- Parse natural date queries and filter tasks accordingly.`;
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

        // Build dynamic mappings from settings
        const priorityMapping = this.buildPriorityMapping(settings);
        const dueDateMapping = this.buildDueDateMapping(settings);

        // Build filter context description
        let filterContext = "";
        if (
            intent.hasMultipleFilters ||
            intent.extractedPriority ||
            intent.extractedDueDateFilter ||
            intent.extractedStatus ||
            intent.extractedFolder ||
            intent.extractedTags?.length > 0
        ) {
            const appliedFilters: string[] = [];
            if (intent.extractedPriority)
                appliedFilters.push(`Priority: ${intent.extractedPriority}`);
            if (intent.extractedDueDateFilter)
                appliedFilters.push(
                    `Due date: ${intent.extractedDueDateFilter}`,
                );
            if (intent.extractedStatus)
                appliedFilters.push(`Status: ${intent.extractedStatus}`);
            if (intent.extractedFolder)
                appliedFilters.push(`Folder: ${intent.extractedFolder}`);
            if (intent.extractedTags?.length > 0)
                appliedFilters.push(`Tags: ${intent.extractedTags.join(", ")}`);

            if (appliedFilters.length > 0) {
                filterContext = `\n\nAPPLIED FILTERS: ${appliedFilters.join(" | ")}\nThe task list below has already been filtered based on these criteria.`;
            }
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
7. ${languageInstruction}${priorityMapping}${dueDateMapping}

QUERY UNDERSTANDING:
- The system has already extracted and applied filters from the user's query
- If multiple filters were detected, tasks have been pre-filtered to match ALL criteria
- Your job is to provide helpful context and prioritization for the filtered results${filterContext}

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
        settings: PluginSettings,
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

        // Limit final recommendations to user preference
        return recommended.slice(0, settings.maxRecommendations);
    }
}
