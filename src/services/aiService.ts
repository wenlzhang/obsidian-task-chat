import { App, Notice, requestUrl } from "obsidian";
import { Task, ChatMessage, TokenUsage } from "../models/task";
import { PluginSettings, SortCriterion } from "../settings";
import { TaskSearchService } from "./taskSearchService";
import { QueryParserService, ParsedQuery } from "./queryParserService";
import { PricingService } from "./pricingService";
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
     * Send a message to AI and get a response with recommended tasks
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

        // Parse query based on chat mode (three-mode system)
        const chatMode = settings.defaultChatMode;

        // Get mode-specific sort settings (NEW: multi-criteria)
        let displaySortOrder: SortCriterion[];
        let aiContextSortOrder: SortCriterion[];

        switch (chatMode) {
            case "simple":
                displaySortOrder = settings.taskSortOrderSimple;
                aiContextSortOrder = settings.taskSortOrderSimple; // Simple mode doesn't use AI, so same order
                break;
            case "smart":
                displaySortOrder = settings.taskSortOrderSmart;
                aiContextSortOrder = settings.taskSortOrderSmart; // Smart mode only uses AI for parsing, not analysis
                break;
            case "chat":
                displaySortOrder = settings.taskSortOrderChat;
                aiContextSortOrder = settings.taskSortOrderChatAI; // Chat mode: separate order for AI context
                break;
        }

        // LEGACY: Get old single-criterion sort setting (for backward compatibility)
        let modeSortBy: string;
        switch (chatMode) {
            case "simple":
                modeSortBy = settings.taskSortBySimple;
                break;
            case "smart":
                modeSortBy = settings.taskSortBySmart;
                break;
            case "chat":
                modeSortBy = settings.taskSortByChat;
                break;
        }

        let intent: any;
        let parsedQuery: ParsedQuery | null = null;
        let usingAIParsing = false; // Track if AI parsing was actually used

        if (chatMode === "simple") {
            // Mode 1: Simple Search - Regex parsing only
            console.log("[Task Chat] Mode: Simple Search (regex parsing)");
            intent = TaskSearchService.analyzeQueryIntent(message);
            usingAIParsing = false;
        } else {
            // Mode 2 & 3: Smart Search / Task Chat - AI parsing
            console.log(
                `[Task Chat] Mode: ${chatMode === "smart" ? "Smart Search" : "Task Chat"} (AI parsing)`,
            );
            try {
                parsedQuery = await QueryParserService.parseQuery(
                    message,
                    settings,
                );
                console.log("[Task Chat] AI parsed query:", parsedQuery);
                usingAIParsing = true; // AI parsing succeeded
            } catch (error) {
                console.error(
                    "[Task Chat] AI parsing failed, falling back to regex:",
                    error,
                );
                parsedQuery = null;
                usingAIParsing = false;
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
                const reason = this.buildDirectSearchReason(
                    0,
                    settings.maxDirectResults,
                    false,
                    usingAIParsing,
                );
                return {
                    response: `No tasks found matching ${filterDesc}.`,
                    directResults: [],
                    tokenUsage: {
                        promptTokens: 0,
                        completionTokens: 0,
                        totalTokens: 0,
                        estimatedCost: 0,
                        model: "none",
                        provider: settings.aiProvider,
                        isEstimated: true,
                        directSearchReason: reason,
                    },
                };
            }

            // PHASE 1: Quality filtering (always for keyword searches)
            // Apply relevance filtering to remove low-quality matches
            // This ensures consistent quality regardless of sort/display preference
            let qualityFilteredTasks = filteredTasks;
            if (intent.keywords && intent.keywords.length > 0) {
                const scoredTasks = TaskSearchService.scoreTasksByRelevance(
                    filteredTasks,
                    intent.keywords,
                );

                // Determine adaptive relevance threshold
                // User's setting is the BASE, then we apply intelligent adjustments
                let baseThreshold: number;
                if (settings.relevanceThreshold === 0) {
                    // Use system defaults as base
                    if (intent.keywords.length >= 4) {
                        baseThreshold = 20;
                    } else if (intent.keywords.length >= 2) {
                        baseThreshold = 30;
                    } else {
                        baseThreshold = 40;
                    }
                    console.log(
                        `[Task Chat] Using default adaptive base: ${baseThreshold} (${intent.keywords.length} keywords)`,
                    );
                } else {
                    // User has set a custom base - respect it
                    baseThreshold = settings.relevanceThreshold;
                    console.log(
                        `[Task Chat] Using user-defined base threshold: ${baseThreshold}`,
                    );
                }

                // Apply adaptive adjustments relative to base
                // IMPORTANT: More keywords from semantic expansion = HIGHER threshold needed
                // to filter out the noise from broad matching
                let finalThreshold: number;
                if (intent.keywords.length >= 6) {
                    // Many keywords (semantic expansion) - INCREASE threshold significantly
                    // This filters out noise from overly broad matching
                    finalThreshold = Math.min(100, baseThreshold + 20);
                    console.log(
                        `[Task Chat] Semantic expansion detected (${intent.keywords.length} keywords), increasing threshold to combat noise`,
                    );
                } else if (intent.keywords.length >= 4) {
                    // Several keywords - increase threshold moderately
                    finalThreshold = Math.min(100, baseThreshold + 10);
                } else if (intent.keywords.length >= 2) {
                    // Moderate keywords - use base as-is
                    finalThreshold = baseThreshold;
                } else {
                    // Single keyword - slight increase for precision
                    finalThreshold = Math.min(100, baseThreshold + 5);
                }

                console.log(
                    `[Task Chat] Quality filter threshold: ${finalThreshold} (base: ${baseThreshold}, keywords: ${intent.keywords.length})`,
                );

                // Apply quality filter
                qualityFilteredTasks = scoredTasks
                    .filter((st) => st.score >= finalThreshold)
                    .map((st) => st.task);

                console.log(
                    `[Task Chat] Quality filter applied: ${filteredTasks.length} → ${qualityFilteredTasks.length} tasks (threshold: ${finalThreshold})`,
                );

                // Safety: If threshold filtered out too many, keep a minimum
                // This prevents overly strict filtering from returning no results
                if (
                    qualityFilteredTasks.length <
                    Math.min(5, filteredTasks.length)
                ) {
                    console.log(
                        `[Task Chat] Quality filter too strict (${qualityFilteredTasks.length} tasks), keeping top scored tasks`,
                    );
                    qualityFilteredTasks = scoredTasks
                        .sort((a, b) => b.score - a.score)
                        .slice(0, Math.min(20, filteredTasks.length))
                        .map((st) => st.task);
                }
            }

            // PHASE 2: Sorting for Display (multi-criteria sorting)
            // Build relevance scores map if keywords present (needed for relevance sorting)
            let relevanceScores: Map<string, number> | undefined;
            if (intent.keywords && intent.keywords.length > 0) {
                const scoredTasks = TaskSearchService.scoreTasksByRelevance(
                    qualityFilteredTasks,
                    intent.keywords,
                );
                relevanceScores = new Map(
                    scoredTasks.map((st) => [st.task.id, st.score]),
                );
            }

            // Resolve "auto" in displaySortOrder
            const resolvedDisplaySortOrder = displaySortOrder.map(
                (criterion) => {
                    if (criterion === "auto") {
                        // Auto mode: Use relevance for keyword searches, dueDate otherwise
                        return intent.keywords && intent.keywords.length > 0
                            ? "relevance"
                            : "dueDate";
                    }
                    return criterion;
                },
            ) as SortCriterion[];

            console.log(
                `[Task Chat] Display sort order: [${resolvedDisplaySortOrder.join(", ")}]`,
            );

            // Sort tasks for display using multi-criteria sorting
            const sortedTasksForDisplay =
                TaskSortService.sortTasksMultiCriteria(
                    qualityFilteredTasks,
                    resolvedDisplaySortOrder,
                    relevanceScores,
                );

            // Three-mode result delivery logic
            // Mode 1 (Simple Search) & Mode 2 (Smart Search) → Direct results
            // Mode 3 (Task Chat) → AI analysis
            if (chatMode === "simple" || chatMode === "smart") {
                // Return direct results for Simple Search and Smart Search
                console.log(
                    `[Task Chat] Result delivery: Direct (${chatMode === "simple" ? "Simple Search" : "Smart Search"} mode, ${sortedTasksForDisplay.length} results)`,
                );

                // Calculate token usage based on mode
                let tokenUsage;
                if (chatMode === "simple") {
                    // Simple Search: No AI usage at all
                    tokenUsage = {
                        promptTokens: 0,
                        completionTokens: 0,
                        totalTokens: 0,
                        estimatedCost: 0,
                        model: "none",
                        provider: settings.aiProvider,
                        isEstimated: false,
                        directSearchReason: `${sortedTasksForDisplay.length} result${sortedTasksForDisplay.length !== 1 ? "s" : ""}`,
                    };
                } else {
                    // Smart Search: AI used for keyword expansion only
                    // Note: Actual token usage from QueryParserService would need to be tracked
                    // For now, using estimated values
                    tokenUsage = {
                        promptTokens: 200,
                        completionTokens: 50,
                        totalTokens: 250,
                        estimatedCost: 0.0001,
                        model: settings.model,
                        provider: settings.aiProvider,
                        isEstimated: true,
                        directSearchReason: `${sortedTasksForDisplay.length} result${sortedTasksForDisplay.length !== 1 ? "s" : ""}`,
                    };
                }

                return {
                    response: "",
                    directResults: sortedTasksForDisplay.slice(
                        0,
                        settings.maxDirectResults,
                    ),
                    tokenUsage,
                };
            }

            // Mode 3: Task Chat - Continue to AI analysis
            // For AI context, sort differently using aiContextSortOrder (optimized for AI understanding)
            console.log(
                `[Task Chat] Result delivery: AI analysis (Task Chat mode, ${sortedTasksForDisplay.length} tasks)`,
            );

            // Resolve "auto" in aiContextSortOrder
            const resolvedAIContextSortOrder = aiContextSortOrder.map(
                (criterion) => {
                    if (criterion === "auto") {
                        return intent.keywords && intent.keywords.length > 0
                            ? "relevance"
                            : "dueDate";
                    }
                    return criterion;
                },
            ) as SortCriterion[];

            console.log(
                `[Task Chat] AI context sort order: [${resolvedAIContextSortOrder.join(", ")}]`,
            );

            // Sort tasks for AI context (what order to send to AI for analysis)
            const sortedTasksForAI = TaskSortService.sortTasksMultiCriteria(
                qualityFilteredTasks,
                resolvedAIContextSortOrder,
                relevanceScores,
            );

            // Select top tasks for AI analysis
            const tasksToAnalyze = sortedTasksForAI.slice(
                0,
                settings.maxTasksForAI,
            );

            console.log(
                `[Task Chat] Sending top ${tasksToAnalyze.length} tasks to AI (max: ${settings.maxTasksForAI})`,
            );

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
            } catch (error) {
                console.error("AI Service Error:", error);
                throw error;
            }
        } else {
            // No filters detected - return all tasks with default sorting
            console.log(
                "[Task Chat] No filters detected, returning all tasks with default sort order",
            );

            // Resolve "auto" in displaySortOrder (no keywords, so use dueDate)
            const resolvedDisplaySortOrder = displaySortOrder.map(
                (criterion) => {
                    if (criterion === "auto") {
                        return "dueDate"; // No keywords, default to dueDate
                    }
                    return criterion;
                },
            ) as SortCriterion[];

            console.log(
                `[Task Chat] Default sort order: [${resolvedDisplaySortOrder.join(", ")}]`,
            );

            // Sort all tasks using multi-criteria sorting
            const sortedTasks = TaskSortService.sortTasksMultiCriteria(
                tasks,
                resolvedDisplaySortOrder,
                undefined, // No relevance scores (no keyword search)
            );

            return {
                response: "",
                directResults: sortedTasks.slice(0, settings.maxDirectResults),
                tokenUsage: {
                    promptTokens: 0,
                    completionTokens: 0,
                    totalTokens: 0,
                    estimatedCost: 0,
                    model: "none",
                    provider: settings.aiProvider,
                    isEstimated: true,
                    directSearchReason: `${sortedTasks.length} task${sortedTasks.length !== 1 ? "s" : ""}`,
                },
            };
        }
    }

    /**
     * Explain why direct search was used instead of AI task analysis
     */
    private static buildDirectSearchReason(
        resultCount: number,
        maxDirectResults: number,
        isSimpleQuery: boolean,
        usingAIParsing: boolean,
    ): string {
        if (resultCount === 0) {
            return usingAIParsing
                ? "No tasks found matching your criteria"
                : "No tasks found (direct search, AI query parsing disabled)";
        }

        if (!usingAIParsing) {
            // AI parsing is disabled or failed - using direct search with regex parsing
            return `Direct search with ${resultCount} result(s) (AI query parsing disabled)`;
        }

        // AI parsing was used for query understanding, but direct search for results
        if (isSimpleQuery && resultCount <= maxDirectResults) {
            return `Simple query, ${resultCount} result(s) found (no AI task analysis needed)`;
        } else if (resultCount <= maxDirectResults) {
            return `${resultCount} result(s) found, within direct limit (${maxDirectResults})`;
        }

        return "Direct search used";
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

TASK ORDERING:
- Tasks are automatically sorted using multi-criteria sorting (relevance → due date → priority)
- Earlier tasks in the list are MORE relevant/urgent than later ones
- [TASK_1] through [TASK_5] are typically the most important
- When recommending tasks, prioritize earlier task IDs unless there's a specific reason not to
- The sorting respects: keyword relevance (best matches first), urgency (overdue → today → future), and priority (1=highest → 4=lowest)

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
            // Map our custom roles to valid AI API roles
            let apiRole: "user" | "assistant" | "system";
            if (msg.role === "user") {
                apiRole = "user";
            } else if (
                msg.role === "simple" ||
                msg.role === "smart" ||
                msg.role === "chat" ||
                msg.role === "assistant"
            ) {
                // All our response types (simple/smart/chat/legacy assistant) map to "assistant"
                apiRole = "assistant";
            } else {
                // system role stays as system
                apiRole = "system";
            }

            if (apiRole !== "system") {
                messages.push({
                    role: apiRole,
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
     * Calculate cost based on token usage and model (using dynamic pricing from API)
     * Pricing data fetched from OpenRouter API and updated automatically
     */
    private static calculateCost(
        promptTokens: number,
        completionTokens: number,
        model: string,
        provider: "openai" | "anthropic" | "openrouter" | "ollama",
        cachedPricing: Record<string, { input: number; output: number }>,
    ): number {
        // Ollama is free (local)
        if (provider === "ollama") {
            return 0;
        }

        // Get pricing from cache or embedded rates using provider-prefixed lookup
        const rates = PricingService.getPricing(model, provider, cachedPricing);

        // Default to gpt-4o-mini pricing if unknown
        if (!rates) {
            console.warn(
                `Unknown model pricing for: ${model}, using gpt-4o-mini fallback`,
            );
            const fallback = PricingService.getPricing(
                "gpt-4o-mini",
                "openai",
                {},
            );
            if (!fallback) {
                return 0; // Should never happen
            }
            // Calculate cost (pricing is per 1M tokens, so divide by 1,000,000)
            const inputCost = (promptTokens / 1000000) * fallback.input;
            const outputCost = (completionTokens / 1000000) * fallback.output;
            return inputCost + outputCost;
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
        const rawContent = data.choices[0].message.content;

        // Clean up reasoning tags from models like DeepSeek
        const content = this.stripReasoningTags(rawContent);

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
                settings.aiProvider,
                settings.pricingCache.data,
            ),
            model: settings.model,
            provider: settings.aiProvider,
            isEstimated: false, // Real token counts from API
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
        const rawContent = data.content[0].text;

        // Clean up reasoning tags
        const content = this.stripReasoningTags(rawContent);

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
                settings.aiProvider,
                settings.pricingCache.data,
            ),
            model: settings.model,
            provider: settings.aiProvider,
            isEstimated: false, // Real token counts from API
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
        const rawContent = data.message.content;

        // Clean up reasoning tags (important for DeepSeek via Ollama)
        const content = this.stripReasoningTags(rawContent);

        // Ollama doesn't provide token counts, estimate based on cleaned content
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
            provider: "ollama",
            isEstimated: true, // Ollama doesn't return real token counts
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
            const scoredTasks = TaskSearchService.scoreTasksByRelevance(
                tasks,
                keywords,
            );
            const topTasks = scoredTasks
                .slice(0, Math.min(5, settings.maxRecommendations))
                .map((st: { score: number; task: Task }) => st.task);

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
            const scoredTasks = TaskSearchService.scoreTasksByRelevance(
                tasks,
                keywords,
            );

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
     * Strip reasoning tags from AI response (DeepSeek's <think>, etc.)
     * These tags contain the model's internal reasoning process and should not be shown to users
     */
    private static stripReasoningTags(content: string): string {
        return content
            .replace(/<think>[\s\S]*?<\/think>/gi, "")
            .replace(/<reasoning>[\s\S]*?<\/reasoning>/gi, "")
            .replace(/<thought>[\s\S]*?<\/thought>/gi, "")
            .trim();
    }

    /**
     * Get API key for the current provider
     */
    private static getApiKeyForProvider(settings: PluginSettings): string {
        switch (settings.aiProvider) {
            case "openai":
                return settings.openaiApiKey || "";
            case "anthropic":
                return settings.anthropicApiKey || "";
            case "openrouter":
                return settings.openrouterApiKey || "";
            case "ollama":
                return ""; // No API key needed
            default:
                return "";
        }
    }
}
