import { App, Notice, requestUrl } from "obsidian";
import { Task, ChatMessage, TokenUsage } from "../models/task";
import { PluginSettings } from "../settings";
import { TaskSearchService } from "./taskSearchService";
import { QueryParserService, ParsedQuery } from "./queryParserService";
import { TaskSortService } from "./taskSortService";

/**
 * Service for AI chat functionality
 *
 * RELEVANCE-BASED FILTERING SYSTEM:
 * This service prioritizes quality over quantity by filtering tasks at multiple stages:
 *
 * 1. COMPOUND FILTERING: Tasks are filtered by ALL extracted properties:
 *    - Keywords (semantic matching across languages)
 *    - Priority (1-4, where 1 = highest)
 *    - Due Date (overdue, today, tomorrow, this week, etc.)
 *    - Status (open, completed, in progress, cancelled)
 *    - Folder (exact or substring match)
 *    - Tags (array matching)
 *
 * 2. RELEVANCE SCORING (for keyword searches):
 *    - Score >= 40 = High relevance (shown to users)
 *    - Score < 40 = Low relevance (filtered out)
 *    - Scoring factors: keyword matches, positioning, task length
 *
 * 3. RESPECTS USER SETTINGS:
 *    - maxDirectResults: Max tasks shown without AI (no cost)
 *    - maxTasksForAI: Max tasks sent to AI (controls token usage)
 *    - maxRecommendations: Max tasks in final recommendations
 *
 * 4. QUALITY GATES:
 *    - Only relevant tasks (score >= 40) are sent to AI
 *    - Only relevant tasks are added to recommendations
 *    - Empty results preferred over irrelevant results
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
        // API key not required for local Ollama
        if (settings.aiProvider !== "ollama") {
            const apiKey = this.getApiKeyForProvider(settings);
            if (!apiKey || apiKey.trim() === "") {
                throw new Error(
                    `API key for ${settings.aiProvider} is not configured. Please set it in the plugin settings.`,
                );
            }
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
                // If AI returned no filters and no keywords, use query as keyword
                const hasAnyFilter = !!(
                    parsedQuery.priority ||
                    parsedQuery.dueDate ||
                    parsedQuery.status ||
                    parsedQuery.folder ||
                    (parsedQuery.tags && parsedQuery.tags.length > 0) ||
                    (parsedQuery.keywords && parsedQuery.keywords.length > 0)
                );

                // If nothing was extracted, treat entire query as keyword search
                const keywords =
                    parsedQuery.keywords && parsedQuery.keywords.length > 0
                        ? parsedQuery.keywords
                        : hasAnyFilter
                          ? []
                          : [message];

                intent = {
                    isSearch: keywords.length > 0,
                    isPriority: !!parsedQuery.priority,
                    isDueDate: !!parsedQuery.dueDate,
                    keywords: keywords,
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
                            keywords.length,
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

        // Apply compound filters if any structured filters or keywords are detected
        if (
            intent.extractedPriority ||
            intent.extractedDueDateFilter ||
            intent.extractedStatus ||
            intent.extractedFolder ||
            intent.extractedTags.length > 0 ||
            intent.keywords.length > 0
        ) {
            console.log("[Task Chat] Extracted intent:", {
                priority: intent.extractedPriority,
                dueDate: intent.extractedDueDateFilter,
                status: intent.extractedStatus,
                folder: intent.extractedFolder,
                tags: intent.extractedTags,
                keywords: intent.keywords,
            });

            if (intent.keywords.length > 0) {
                console.log(
                    `[Task Chat] Searching with keywords: [${intent.keywords.join(", ")}]`,
                );
            }

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

            // For keyword searches, use relevance-based sorting to ensure relevant tasks reach AI
            // Otherwise use user's configured sort order
            let sortedTasks: Task[];
            if (intent.keywords && intent.keywords.length > 0) {
                console.log(
                    "[Task Chat] Using relevance-based sorting for keyword search",
                );
                // Sort by keyword match relevance
                sortedTasks = this.sortByKeywordRelevance(
                    filteredTasks,
                    intent.keywords,
                );
            } else {
                console.log(
                    "[Task Chat] Using configured sort order:",
                    settings.taskSortBy,
                );
                sortedTasks = TaskSortService.sortTasks(
                    filteredTasks,
                    settings,
                );
            }

            // Simple query - return directly without AI if within limits
            // Allow direct results for simple queries (single filter or simple keyword search)
            const isSimpleQuery =
                !intent.hasMultipleFilters ||
                (intent.keywords.length > 0 &&
                    !intent.extractedPriority &&
                    !intent.extractedDueDateFilter &&
                    !intent.extractedStatus &&
                    !intent.extractedFolder &&
                    intent.extractedTags.length === 0);

            if (
                sortedTasks.length <= settings.maxDirectResults &&
                isSimpleQuery
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

            console.log("[Task Chat] AI response:", response);

            const recommendedTasks = this.extractRecommendedTasks(
                response,
                tasksToAnalyze,
                settings,
                intent.keywords || [],
            );

            // Replace [TASK_X] references with actual task numbers from recommended list
            const processedResponse = this.replaceTaskReferences(
                response,
                recommendedTasks,
                tasksToAnalyze,
            );

            return {
                response: processedResponse,
                recommendedTasks,
                tokenUsage,
            };
        }

        // Apply compound filters (priority, due date, status, folder, tags, keywords)
        const filteredTasks = TaskSearchService.applyCompoundFilters(tasks, {
            priority: intent.extractedPriority,
            dueDate: intent.extractedDueDateFilter,
            status: intent.extractedStatus,
            folder: intent.extractedFolder,
            tags: intent.extractedTags,
            keywords:
                intent.keywords && intent.keywords.length > 0
                    ? intent.keywords
                    : undefined,
        });

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

        // Sort by relevance if keywords exist, otherwise use configured sort
        let sortedTasks: Task[];
        if (intent.keywords && intent.keywords.length > 0) {
            console.log(
                "[Task Chat] Using relevance-based sorting for keyword search",
            );
            sortedTasks = this.sortByKeywordRelevance(
                filteredTasks,
                intent.keywords,
            );
        } else {
            console.log(
                "[Task Chat] Using configured sort order:",
                settings.taskSortBy,
            );
            sortedTasks = TaskSortService.sortTasks(filteredTasks, settings);
        }

        // If simple query with few results, return directly without AI
        const isSimpleQuery =
            !intent.hasMultipleFilters ||
            (intent.keywords.length > 0 &&
                !intent.extractedPriority &&
                !intent.extractedDueDateFilter &&
                !intent.extractedStatus &&
                !intent.extractedFolder &&
                intent.extractedTags.length === 0);

        if (sortedTasks.length <= settings.maxDirectResults && isSimpleQuery) {
            return {
                response: "",
                directResults: sortedTasks.slice(0, settings.maxDirectResults),
                tokenUsage: {
                    promptTokens: 0,
                    completionTokens: 0,
                    totalTokens: 0,
                    estimatedCost: 0,
                    model: settings.model,
                },
            };
        }

        // Apply relevance filtering for keyword searches
        // Only send high-quality matches to AI to save tokens and improve results
        let tasksToAnalyze: Task[];
        if (intent.keywords && intent.keywords.length > 0) {
            const RELEVANCE_THRESHOLD = 40;
            const scoredTasks = this.scoreTasksByRelevance(
                sortedTasks,
                intent.keywords,
            );

            // Filter by relevance threshold
            const relevantTasks = scoredTasks
                .filter((st) => st.score >= RELEVANCE_THRESHOLD)
                .map((st) => st.task);

            console.log(
                `[Task Chat] Filtered to ${relevantTasks.length} relevant tasks (score >= ${RELEVANCE_THRESHOLD}) before sending to AI`,
            );

            tasksToAnalyze = relevantTasks.slice(0, settings.maxTasksForAI);
        } else {
            tasksToAnalyze = sortedTasks.slice(0, settings.maxTasksForAI);
        }

        // If no relevant tasks to analyze, return early
        if (tasksToAnalyze.length === 0) {
            return {
                response:
                    "Found tasks matching your query, but they don't appear to be highly relevant. Please try refining your search.",
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

            console.log("[Task Chat] AI response:", response);

            // Extract task IDs that AI referenced
            const recommendedTasks = this.extractRecommendedTasks(
                response,
                tasksToAnalyze,
                settings,
                intent.keywords || [],
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

        console.log(
            `[Task Chat] Building task context with ${tasks.length} tasks:`,
        );
        tasks.forEach((task, index) => {
            console.log(`[Task Chat]   [TASK_${index + 1}]: ${task.text}`);
        });

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
                // Use queryLanguages if configured, otherwise default behavior
                if (
                    settings.queryLanguages &&
                    settings.queryLanguages.length > 0
                ) {
                    const langs = settings.queryLanguages.join(", ");
                    languageInstruction = `Respond in the same language as the user's query. Supported languages: ${langs}. If the query mixes multiple languages, use the primary language detected from the supported list.`;
                } else {
                    languageInstruction =
                        "Respond in the same language as the user's query. If the query mixes multiple languages, use the primary language detected.";
                }
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

⚠️ CRITICAL: ONLY DISCUSS ACTUAL TASKS FROM THE LIST ⚠️
- DO NOT provide generic advice or general knowledge (e.g., "research the market")
- DO NOT suggest actions that aren't in the task list
- Your response must be ENTIRELY based on the specific tasks provided
- If there are no relevant tasks, say so directly

CRITICAL: DO NOT LIST TASKS IN YOUR RESPONSE TEXT
- Tasks you reference will automatically appear in a "Recommended tasks" section below your response
- Your response text should ONLY contain advice, insights, and recommendations
- Use [TASK_X] IDs to reference tasks, but DO NOT list them with "- [TASK_1]: task text" format
- DO NOT repeat any task content in your response

IMPORTANT RULES:
1. ONLY reference tasks from the provided task list using [TASK_X] IDs
2. DO NOT create new tasks or suggest tasks that don't exist
3. When recommending tasks, reference them ONLY by [TASK_X] ID (e.g., "Start with [TASK_3]")
4. DO NOT list tasks with their content (e.g., DON'T write "- [TASK_1]: task description")
5. If there are MULTIPLE relevant tasks, reference ALL of them using their [TASK_X] IDs
6. Do NOT invent task content - only use the exact task text provided
7. Focus on helping users prioritize and execute existing tasks
8. Help prioritize based on user's query, relevance, due dates, priority levels, and time context
9. If tasks are related, explain the relationships using only task IDs
10. Be concise and actionable
11. ${languageInstruction}${priorityMapping}${dueDateMapping}

CRITICAL: HOW TO REFERENCE TASKS IN YOUR RESPONSE:
- Use [TASK_X] IDs to reference specific tasks you're recommending
- The system will AUTOMATICALLY replace [TASK_X] with "Task N" based on the order you mention them
- Example: You write "[TASK_5] is highest priority, then [TASK_1], then [TASK_4]"
  → User sees: "Task 1 is the most relevant/due soonest/highest priority, then Task 2, then Task 3"
- The tasks appear in the recommended list in the same order you mentioned them

METHODS TO REFERENCE TASKS:

Use [TASK_X] IDs (will be auto-converted to task numbers):
✅ "Focus on [TASK_5], [TASK_1], and [TASK_4]. Start with [TASK_5]."
  → Becomes: "Focus on Task 1, Task 2, and Task 3. Start with Task 1."

WHAT USER SEES:
Your response text appears (with [TASK_X] auto-converted to task numbers).

RESPONSE FORMAT:

MUST: (1) Reference tasks using [TASK_X] IDs, (2) Explain strategy

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

        if (settings.aiProvider === "anthropic") {
            return this.callAnthropic(messages, settings);
        }

        // OpenAI-compatible API call (OpenAI and OpenRouter)
        const apiKey = this.getApiKeyForProvider(settings);
        const response = await requestUrl({
            url: endpoint,
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                Authorization: `Bearer ${apiKey}`,
            },
            body: JSON.stringify({
                model: settings.model,
                messages: messages,
                temperature: settings.temperature,
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
     * Call Anthropic API (different format than OpenAI)
     */
    private static async callAnthropic(
        messages: any[],
        settings: PluginSettings,
    ): Promise<{ response: string; tokenUsage: TokenUsage }> {
        const endpoint =
            settings.apiEndpoint || "https://api.anthropic.com/v1/messages";

        // Separate system message from conversation messages
        const systemMessage = messages.find((m: any) => m.role === "system");
        const conversationMessages = messages.filter(
            (m: any) => m.role !== "system",
        );

        const apiKey = this.getApiKeyForProvider(settings);
        const response = await requestUrl({
            url: endpoint,
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                "x-api-key": apiKey,
                "anthropic-version": "2023-06-01",
            },
            body: JSON.stringify({
                model: settings.model,
                messages: conversationMessages,
                system: systemMessage?.content || "",
                temperature: settings.temperature,
                max_tokens: 1000,
            }),
        });

        if (response.status !== 200) {
            throw new Error(
                `Anthropic API error: ${response.status} ${response.text}`,
            );
        }

        const data = response.json;
        const content = data.content[0].text;

        // Extract token usage
        const usage = data.usage || {};
        const promptTokens = usage.input_tokens || 0;
        const completionTokens = usage.output_tokens || 0;
        const totalTokens = promptTokens + completionTokens;

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
                options: {
                    temperature: settings.temperature,
                },
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
        keywords: string[],
    ): Task[] {
        const recommended: Task[] = [];

        console.log(
            `[Task Chat] Extracting recommended tasks from ${tasks.length} available tasks`,
        );
        console.log(
            "[Task Chat] Available tasks:",
            tasks.map((t, i) => `[${i}]: ${t.text}`),
        );

        // Extract [TASK_X] references from response, preserving order
        const taskIdPattern = /\[TASK_(\d+)\]/g;
        const matches = response.matchAll(taskIdPattern);

        const referencedIndices: number[] = []; // Array to preserve order
        const seenIndices = new Set<number>(); // Set to track uniqueness

        for (const match of matches) {
            const index = parseInt(match[1]);
            // Convert from 1-based to 0-based indexing
            const taskIndex = index - 1;

            if (taskIndex >= 0 && taskIndex < tasks.length) {
                // Only add if not already seen (avoid duplicates)
                if (!seenIndices.has(taskIndex)) {
                    console.log(
                        `[Task Chat] Found reference: [TASK_${index}] -> array index ${taskIndex}: "${tasks[taskIndex].text}"`,
                    );
                    referencedIndices.push(taskIndex);
                    seenIndices.add(taskIndex);
                }
            } else {
                console.warn(
                    `[Task Chat] Invalid task reference [TASK_${index}] - out of bounds (have ${tasks.length} tasks)`,
                );
            }
        }

        console.log(
            `[Task Chat] Found ${referencedIndices.length} unique task references in order`,
        );

        // Add tasks in the exact order they were mentioned in the AI response
        referencedIndices.forEach((index) => {
            recommended.push(tasks[index]);
        });

        // If no task IDs were found, use fallback: return top relevant tasks
        if (recommended.length === 0) {
            console.warn(
                "⚠️ [Task Chat] WARNING: No [TASK_X] references found in AI response!",
            );
            console.warn(
                "[Task Chat] AI response did not follow [TASK_X] format. Using top tasks as fallback.",
            );

            // Use relevance scoring as fallback - return top 3-5 most relevant tasks
            const scoredTasks = this.scoreTasksByRelevance(tasks, keywords);
            const topTasks = scoredTasks
                .slice(0, Math.min(5, settings.maxRecommendations))
                .map((st) => st.task);

            console.log(
                `[Task Chat] Fallback: returning top ${topTasks.length} tasks by relevance`,
            );
            return topTasks;
        }

        // Trust AI's recommendations - only show tasks that AI explicitly mentioned
        // Do NOT automatically add extra tasks
        console.log(
            `[Task Chat] AI explicitly recommended ${recommended.length} tasks. Using only those.`,
        );

        // Skip automatic task addition
        if (false) {
            // This code path is disabled - we trust AI's judgment
            const scoredTasks = this.scoreTasksByRelevance(tasks, keywords);

            // Define quality threshold: only add tasks with decent relevance
            // Score >= 40 means at least 4 keyword matches or good positioning
            const RELEVANCE_THRESHOLD = 40;

            // Add top tasks that meet quality threshold
            const maxToAdd =
                Math.min(settings.maxRecommendations, tasks.length) -
                recommended.length;
            let added = 0;
            let skipped = 0;

            for (const scoredTask of scoredTasks) {
                if (added >= maxToAdd) break;

                // Only add if task meets relevance threshold and not already recommended
                if (
                    scoredTask.score >= RELEVANCE_THRESHOLD &&
                    !recommended.includes(scoredTask.task)
                ) {
                    recommended.push(scoredTask.task);
                    added++;
                    console.log(
                        `[Task Chat] Added relevant task (score ${scoredTask.score}): "${scoredTask.task.text}"`,
                    );
                } else if (scoredTask.score < RELEVANCE_THRESHOLD) {
                    skipped++;
                }
            }

            console.log(
                `[Task Chat] Added ${added} relevant tasks, skipped ${skipped} low-relevance tasks (threshold: ${RELEVANCE_THRESHOLD})`,
            );
        }

        // Limit final recommendations to user preference
        const finalRecommended = recommended.slice(
            0,
            settings.maxRecommendations,
        );
        console.log(
            `[Task Chat] Returning ${finalRecommended.length} recommended tasks:`,
        );
        finalRecommended.forEach((task, i) => {
            console.log(`[Task Chat]   Recommended [${i + 1}]: ${task.text}`);
        });
        return finalRecommended;
    }

    /**
     * Replace [TASK_X] references in the response with actual task numbers
     * from the recommended list
     */
    private static replaceTaskReferences(
        response: string,
        recommendedTasks: Task[],
        allTasks: Task[],
    ): string {
        // Build a map of task ID to position in recommended list
        const taskIdToPosition = new Map<number, number>();

        recommendedTasks.forEach((recommendedTask, index) => {
            // Find this task in the allTasks array to get its original ID
            const taskIndex = allTasks.findIndex(
                (t) =>
                    t.text === recommendedTask.text &&
                    t.sourcePath === recommendedTask.sourcePath &&
                    t.lineNumber === recommendedTask.lineNumber,
            );
            if (taskIndex >= 0) {
                // Map from 1-based task ID to 1-based position in recommended list
                taskIdToPosition.set(taskIndex + 1, index + 1);
            }
        });

        console.log(
            `[Task Chat] Task ID to position mapping:`,
            Array.from(taskIdToPosition.entries()).map(
                ([id, pos]) => `[TASK_${id}] -> task ${pos}`,
            ),
        );

        // Replace all [TASK_X] references with "task N" where N is the position
        let processedResponse = response;
        const taskIdPattern = /\[TASK_(\d+)\]/g;

        processedResponse = processedResponse.replace(
            taskIdPattern,
            (match, idStr) => {
                const taskId = parseInt(idStr);
                const position = taskIdToPosition.get(taskId);

                if (position !== undefined) {
                    console.log(
                        `[Task Chat] Replacing ${match} with "task ${position}"`,
                    );
                    return `task ${position}`;
                } else {
                    // Task was referenced but not in recommended list (shouldn't happen)
                    console.warn(
                        `[Task Chat] Task ID ${taskId} not found in recommended list`,
                    );
                    return match; // Keep original reference
                }
            },
        );

        console.log(`[Task Chat] Processed response:`, processedResponse);
        return processedResponse;
    }

    /**
     * Score tasks by relevance to keywords
     * Returns array of {task, score} sorted by score (highest first)
     */
    private static scoreTasksByRelevance(
        tasks: Task[],
        keywords: string[],
    ): Array<{ task: Task; score: number }> {
        const scored = tasks.map((task) => {
            const taskText = task.text.toLowerCase();
            let score = 0;

            // Penalize very short generic tasks (likely test/placeholder tasks)
            if (task.text.trim().length < 10) {
                score -= 50;
            }

            keywords.forEach((keyword) => {
                const keywordLower = keyword.toLowerCase();

                // Exact match gets highest score
                if (taskText === keywordLower) {
                    score += 100;
                }
                // Task contains the exact keyword
                else if (taskText.includes(keywordLower)) {
                    // Bonus for keyword at start of task
                    if (taskText.startsWith(keywordLower)) {
                        score += 15;
                    } else {
                        score += 10;
                    }
                }
            });

            // Bonus for matching more keywords
            const matchingKeywords = keywords.filter((kw) =>
                taskText.includes(kw.toLowerCase()),
            ).length;
            score += matchingKeywords * 5;

            // Slight bonus for medium-length tasks (more descriptive, not too verbose)
            if (task.text.length >= 20 && task.text.length < 100) {
                score += 5;
            }

            return { task, score };
        });

        // Sort by score (highest first)
        return scored.sort((a, b) => b.score - a.score);
    }

    /**
     * Sort tasks by keyword relevance
     * Tasks that match more keywords and have better matches rank higher
     */
    private static sortByKeywordRelevance(
        tasks: Task[],
        keywords: string[],
    ): Task[] {
        const sorted = this.scoreTasksByRelevance(tasks, keywords);

        console.log("[Task Chat] Top 10 tasks by relevance:");
        sorted.slice(0, 10).forEach((item, i) => {
            console.log(
                `[Task Chat]   [${i + 1}] Score ${item.score}: ${item.task.text}`,
            );
        });

        return sorted.map((item) => item.task);
    }

    /**
     * Get API key for the current provider
     */
    private static getApiKeyForProvider(settings: PluginSettings): string {
        switch (settings.aiProvider) {
            case "openai":
                return settings.openaiApiKey || settings.apiKey || "";
            case "anthropic":
                return settings.anthropicApiKey || settings.apiKey || "";
            case "openrouter":
                return settings.openrouterApiKey || settings.apiKey || "";
            case "ollama":
                return ""; // No API key needed
            default:
                return settings.apiKey || "";
        }
    }
}
