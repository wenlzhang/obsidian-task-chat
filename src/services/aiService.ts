import { App, Notice, requestUrl } from "obsidian";
import { Task, ChatMessage, TokenUsage } from "../models/task";
import { PluginSettings, SortCriterion } from "../settings";
import { TaskSearchService } from "./taskSearchService";
import { QueryParserService, ParsedQuery } from "./queryParserService";
import { PricingService } from "./pricingService";
import { TaskSortService } from "./taskSortService";
import { PromptBuilderService } from "./promptBuilderService";

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

        // Use unified sort order for all modes
        // Coefficients (R×20, D×4, P×1) determine importance, not order
        // Sort order only matters for tiebreaking tasks with identical scores
        const sortOrder = settings.taskSortOrder;

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

            // Detect query type for adaptive scoring
            const queryType = this.detectQueryType(intent);

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

            // PHASE 1: Quality filtering (for ALL query types)
            // Apply scoring and filtering to remove low-quality matches
            // Adapts to query type: keywords-only, properties-only, or mixed
            let qualityFilteredTasks = filteredTasks;
            if (queryType.hasKeywords || queryType.hasTaskProperties) {
                // All modes now use comprehensive scoring (relevance + due date + priority)
                // Simple Search: keywords = coreKeywords (no semantic expansion)
                // Smart Search / Task Chat: keywords ≠ coreKeywords (with semantic expansion)
                let scoredTasks;
                if (usingAIParsing && parsedQuery?.coreKeywords) {
                    // Smart Search / Task Chat: with semantic expansion
                    console.log(
                        `[Task Chat] Using comprehensive scoring with expansion (core: ${parsedQuery.coreKeywords.length}, expanded: ${intent.keywords.length})`,
                    );
                    scoredTasks = TaskSearchService.scoreTasksComprehensive(
                        filteredTasks,
                        intent.keywords, // Expanded keywords
                        parsedQuery.coreKeywords, // Core keywords
                        queryType.hasKeywords, // NEW: Query has keywords
                        !!intent.extractedDueDateFilter,
                        !!intent.extractedPriority,
                        sortOrder,
                        settings.relevanceCoefficient,
                        settings.dueDateCoefficient,
                        settings.priorityCoefficient,
                        settings,
                    );
                } else {
                    // Simple Search: no semantic expansion (keywords = coreKeywords)
                    console.log(
                        `[Task Chat] Using comprehensive scoring without expansion (keywords: ${intent.keywords.length})`,
                    );
                    scoredTasks = TaskSearchService.scoreTasksComprehensive(
                        filteredTasks,
                        intent.keywords, // All keywords are "core" (no expansion)
                        intent.keywords, // Same as keywords (no distinction)
                        queryType.hasKeywords, // NEW: Query has keywords
                        !!intent.extractedDueDateFilter,
                        !!intent.extractedPriority,
                        sortOrder,
                        settings.relevanceCoefficient,
                        settings.dueDateCoefficient,
                        settings.priorityCoefficient,
                        settings,
                    );
                }

                // Quality filter: Convert percentage (0.0-1.0) to actual score threshold
                // Max score calculated dynamically based on query type and user settings
                // Adapts to include only relevant components
                const maxRelevanceScore = settings.relevanceCoreWeight + 1.0;
                const maxDueDateScore = Math.max(
                    settings.dueDateOverdueScore,
                    settings.dueDateWithin7DaysScore,
                    settings.dueDateWithin1MonthScore,
                    settings.dueDateLaterScore,
                    settings.dueDateNoneScore,
                );
                const maxPriorityScore = Math.max(
                    settings.priorityP1Score,
                    settings.priorityP2Score,
                    settings.priorityP3Score,
                    settings.priorityP4Score,
                    settings.priorityNoneScore,
                );

                // Dynamic max score based on what will ACTUALLY be scored
                // Must mirror the activation logic in scoreTasksComprehensive:
                // - relevance active ONLY if: queryHasKeywords (not sort order!)
                // - dueDate active if: queryHasDueDate || dueDateInSort
                // - priority active if: queryHasPriority || priorityInSort
                // Note: Sort order should NOT activate relevance because without keywords,
                // all relevance scores = 0 but maxScore inflates → threshold too high → filters all tasks
                const dueDateInSort =
                    settings.taskSortOrder.includes("dueDate");
                const priorityInSort =
                    settings.taskSortOrder.includes("priority");

                const relevanceActive = queryType.hasKeywords; // Fixed: removed || relevanceInSort
                const dueDateActive =
                    !!intent.extractedDueDateFilter || dueDateInSort;
                const priorityActive =
                    !!intent.extractedPriority || priorityInSort;

                let maxScore = 0;
                const activeComponents: string[] = [];

                if (relevanceActive) {
                    maxScore +=
                        maxRelevanceScore * settings.relevanceCoefficient;
                    activeComponents.push("relevance");
                }
                if (dueDateActive) {
                    maxScore += maxDueDateScore * settings.dueDateCoefficient;
                    activeComponents.push("dueDate");
                }
                if (priorityActive) {
                    maxScore += maxPriorityScore * settings.priorityCoefficient;
                    activeComponents.push("priority");
                }

                console.log(
                    `[Task Chat] Query type: ${queryType.queryType}, Active components: [${activeComponents.join(", ")}], maxScore = ${maxScore.toFixed(1)}`,
                );
                let baseThreshold: number;

                if (settings.qualityFilterStrength === 0) {
                    // Adaptive mode - auto-adjust based on query complexity
                    // Scale thresholds to appropriate range
                    if (intent.keywords.length >= 20) {
                        // Semantic expansion - very permissive (10%)
                        baseThreshold = maxScore * 0.1;
                    } else if (intent.keywords.length >= 4) {
                        // Several keywords - permissive (16%)
                        baseThreshold = maxScore * 0.16;
                    } else if (intent.keywords.length >= 2) {
                        // Few keywords - balanced (26%)
                        baseThreshold = maxScore * 0.26;
                    } else {
                        // Single keyword - moderate (32%)
                        baseThreshold = maxScore * 0.32;
                    }
                    const hasExpansion =
                        usingAIParsing && parsedQuery?.coreKeywords;
                    const mode = hasExpansion
                        ? "with expansion"
                        : "no expansion";
                    console.log(
                        `[Task Chat] Quality filter: 0% (adaptive) → ${baseThreshold.toFixed(2)}/${maxScore.toFixed(1)} [${mode}] (${intent.keywords.length} keywords)`,
                    );
                } else {
                    // User-defined percentage - convert to actual threshold
                    baseThreshold = settings.qualityFilterStrength * maxScore;
                    const percentage = (
                        settings.qualityFilterStrength * 100
                    ).toFixed(0);
                    const hasExpansion =
                        usingAIParsing && parsedQuery?.coreKeywords;
                    const mode = hasExpansion
                        ? "with expansion"
                        : "no expansion";
                    console.log(
                        `[Task Chat] Quality filter: ${percentage}% (user-defined) → ${baseThreshold.toFixed(2)}/${maxScore.toFixed(1)} [${mode}]`,
                    );
                }

                // Use base threshold directly (already adjusted for keyword count in adaptive mode)
                const finalThreshold = baseThreshold;

                // Apply comprehensive score quality filter
                let qualityFilteredScored = scoredTasks.filter(
                    (st) => st.score >= finalThreshold,
                );

                // Apply optional minimum relevance score filter (if enabled AND query has keywords)
                // Note: Without keywords, all relevance scores = 0, so this filter would exclude everything
                if (
                    settings.minimumRelevanceScore > 0 &&
                    queryType.hasKeywords
                ) {
                    const beforeRelevanceFilter = qualityFilteredScored.length;
                    qualityFilteredScored = qualityFilteredScored.filter(
                        (st) =>
                            st.relevanceScore >= settings.minimumRelevanceScore,
                    );
                    console.log(
                        `[Task Chat] Minimum relevance filter (${settings.minimumRelevanceScore.toFixed(2)}): ${beforeRelevanceFilter} → ${qualityFilteredScored.length} tasks`,
                    );
                }

                qualityFilteredTasks = qualityFilteredScored.map(
                    (st) => st.task,
                );

                console.log(
                    `[Task Chat] Quality filter applied: ${filteredTasks.length} → ${qualityFilteredTasks.length} tasks (threshold: ${finalThreshold.toFixed(2)})`,
                );

                // Log sample task scores for transparency
                if (qualityFilteredScored.length > 0) {
                    const sample = qualityFilteredScored[0];
                    console.log(`[Task Chat] Sample score breakdown:`);
                    console.log(
                        `  Task: "${sample.task.text.substring(0, 60)}..."`,
                    );
                    console.log(
                        `  Relevance: ${sample.relevanceScore.toFixed(2)} (× ${settings.relevanceCoefficient} = ${(sample.relevanceScore * settings.relevanceCoefficient).toFixed(2)})`,
                    );
                    console.log(
                        `  Due Date: ${sample.dueDateScore.toFixed(2)} (× ${settings.dueDateCoefficient} = ${(sample.dueDateScore * settings.dueDateCoefficient).toFixed(2)})`,
                    );
                    console.log(
                        `  Priority: ${sample.priorityScore.toFixed(2)} (× ${settings.priorityCoefficient} = ${(sample.priorityScore * settings.priorityCoefficient).toFixed(2)})`,
                    );
                    console.log(
                        `  Final: ${sample.score.toFixed(2)} (threshold: ${finalThreshold.toFixed(2)})`,
                    );
                }

                // Safety: If threshold filtered out too many, keep a minimum
                // This prevents overly strict filtering from returning no results
                // Keep at least enough tasks to give AI good context
                // ONLY apply this safety when using adaptive mode (qualityFilterStrength == 0)
                // If user explicitly set filters, RESPECT their choice!
                const userHasExplicitFilters =
                    settings.qualityFilterStrength > 0 ||
                    settings.minimumRelevanceScore > 0;

                if (!userHasExplicitFilters) {
                    const minTasksNeeded = Math.min(
                        settings.maxTasksForAI,
                        filteredTasks.length,
                    );
                    if (qualityFilteredTasks.length < minTasksNeeded) {
                        console.log(
                            `[Task Chat] Adaptive mode: quality filter too strict (${qualityFilteredTasks.length} tasks), keeping top ${minTasksNeeded} scored tasks`,
                        );
                        qualityFilteredScored = scoredTasks
                            .sort((a, b) => b.score - a.score)
                            .slice(0, minTasksNeeded);
                        qualityFilteredTasks = qualityFilteredScored.map(
                            (st) => st.task,
                        );
                    }
                } else {
                    console.log(
                        `[Task Chat] User has explicit filters - respecting strict filtering (${qualityFilteredTasks.length} tasks)`,
                    );
                }
            }

            // PHASE 2: Sorting for Display (multi-criteria sorting)
            // Build comprehensive scores map if keywords present (needed for sorting)
            // OPTIMIZATION: Reuse scores from Phase 1 instead of re-scoring
            let comprehensiveScores: Map<string, number> | undefined;
            if (intent.keywords && intent.keywords.length > 0) {
                // Reuse scores from quality filtering phase (no redundant scoring!)
                const scoredMap = new Map<string, number>();

                // Re-score only qualityFilteredTasks (not all filtered tasks)
                // This is necessary because quality filter may have removed some tasks
                let scoredTasksForSort;
                if (usingAIParsing && parsedQuery?.coreKeywords) {
                    scoredTasksForSort =
                        TaskSearchService.scoreTasksComprehensive(
                            qualityFilteredTasks,
                            intent.keywords,
                            parsedQuery.coreKeywords,
                            queryType.hasKeywords,
                            !!intent.extractedDueDateFilter,
                            !!intent.extractedPriority,
                            sortOrder,
                            settings.relevanceCoefficient,
                            settings.dueDateCoefficient,
                            settings.priorityCoefficient,
                            settings,
                        );
                } else {
                    scoredTasksForSort =
                        TaskSearchService.scoreTasksComprehensive(
                            qualityFilteredTasks,
                            intent.keywords,
                            intent.keywords,
                            queryType.hasKeywords,
                            !!intent.extractedDueDateFilter,
                            !!intent.extractedPriority,
                            sortOrder,
                            settings.relevanceCoefficient,
                            settings.dueDateCoefficient,
                            settings.priorityCoefficient,
                            settings,
                        );
                }

                comprehensiveScores = new Map(
                    scoredTasksForSort.map((st) => [st.task.id, st.score]),
                );
            }

            console.log(`[Task Chat] Sort order: [${sortOrder.join(", ")}]`);

            // Sort tasks for display using multi-criteria sorting
            const sortedTasksForDisplay =
                TaskSortService.sortTasksMultiCriteria(
                    qualityFilteredTasks,
                    sortOrder,
                    comprehensiveScores,
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

            // Use same sort order for AI context
            // Coefficients already determine importance, order is just for tiebreaking
            const sortedTasksForAI = sortedTasksForDisplay; // Same as display

            // Select top tasks for AI analysis
            const tasksToAnalyze = sortedTasksForAI.slice(
                0,
                settings.maxTasksForAI,
            );

            console.log(
                `[Task Chat] Sending top ${tasksToAnalyze.length} tasks to AI (max: ${settings.maxTasksForAI})`,
            );
            console.log(
                `[Task Chat] Total filtered tasks available: ${qualityFilteredTasks.length}`,
            );

            // DEBUG: Log first 10 tasks with their sort criteria values
            console.log(
                `[Task Chat] === TOP 10 TASKS DEBUG (sorted by ${sortOrder.join(" → ")}) ===`,
            );
            tasksToAnalyze.slice(0, 10).forEach((task, index) => {
                const score = comprehensiveScores?.get(task.id) || 0;
                const dueInfo = task.dueDate || "none";
                const priorityInfo =
                    task.priority !== undefined ? task.priority : "none";
                console.log(
                    `[Task Chat]   ${index + 1}. [score=${score}] [due=${dueInfo}] [p=${priorityInfo}] ${task.text.substring(0, 60)}...`,
                );
            });
            console.log(
                `[Task Chat] ===========================================`,
            );

            const taskContext = this.buildTaskContext(
                tasksToAnalyze,
                intent,
                settings,
            );
            const messages = this.buildMessages(
                message,
                taskContext,
                chatHistory,
                settings,
                intent,
                sortOrder, // Pass unified sort order to prompt
                tasksToAnalyze.length, // Pass task count for recommendation targets
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
                    parsedQuery?.coreKeywords || [],
                    !!intent.extractedDueDateFilter,
                    !!intent.extractedPriority,
                    sortOrder,
                    usingAIParsing,
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

            console.log(`[Task Chat] Sort order: [${sortOrder.join(", ")}]`);

            // Sort all tasks using multi-criteria sorting
            const sortedTasks = TaskSortService.sortTasksMultiCriteria(
                tasks,
                sortOrder,
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
     * Detect query type based on content (Part 1 vs Part 2 vs both)
     * Used to dynamically adapt scoring and filtering
     */
    private static detectQueryType(intent: any): {
        hasKeywords: boolean;
        hasTaskProperties: boolean;
        queryType: "keywords-only" | "properties-only" | "mixed" | "empty";
    } {
        const hasKeywords = intent.keywords && intent.keywords.length > 0;
        const hasTaskProperties = !!(
            intent.extractedPriority ||
            intent.extractedDueDateFilter ||
            intent.extractedStatus ||
            intent.extractedFolder ||
            (intent.extractedTags && intent.extractedTags.length > 0)
        );

        let queryType: "keywords-only" | "properties-only" | "mixed" | "empty";
        if (hasKeywords && hasTaskProperties) {
            queryType = "mixed";
        } else if (hasKeywords) {
            queryType = "keywords-only";
        } else if (hasTaskProperties) {
            queryType = "properties-only";
        } else {
            queryType = "empty";
        }

        console.log(
            `[Task Chat] Query type: ${queryType} (keywords: ${hasKeywords}, properties: ${hasTaskProperties})`,
        );

        return { hasKeywords, hasTaskProperties, queryType };
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
     * Respects user's configured status names and priority labels
     */
    private static buildTaskContext(
        tasks: Task[],
        intent: any,
        settings: PluginSettings,
    ): string {
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

            // Add metadata (respecting user's configured display names)
            const metadata: string[] = [];

            // Status - use user's display name
            const statusDisplayName =
                settings.taskStatusDisplayNames[task.statusCategory] ||
                task.statusCategory;
            metadata.push(`Status: ${statusDisplayName}`);

            // Priority - use user's priority values to show human-readable label
            if (task.priority) {
                // Find the user's configured value for this priority level
                const priorityKey = task.priority as 1 | 2 | 3 | 4;
                const priorityValues =
                    settings.dataviewPriorityMapping[priorityKey];
                const userLabel =
                    priorityValues && priorityValues[0]
                        ? priorityValues[0]
                        : task.priority.toString();
                metadata.push(`Priority: ${userLabel}`);
            }

            // Dates - use user's configured field names in display
            if (task.dueDate) {
                metadata.push(`Due: ${task.dueDate}`);
            }

            if (task.createdDate) {
                metadata.push(`Created: ${task.createdDate}`);
            }

            if (task.completedDate) {
                metadata.push(`Completed: ${task.completedDate}`);
            }

            // Folder and Tags
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
     * Uses shared PromptBuilderService for consistent prompt generation across all AI interactions
     */
    private static buildMessages(
        userMessage: string,
        taskContext: string,
        chatHistory: ChatMessage[],
        settings: PluginSettings,
        intent: any,
        sortOrder: SortCriterion[],
        taskCount: number, // Number of tasks available for recommendation
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

        // Build dynamic mappings from settings (using shared PromptBuilderService)
        const priorityMapping =
            PromptBuilderService.buildPriorityMapping(settings);
        const dateFormats = PromptBuilderService.buildDateFormats(settings);
        const statusMapping = PromptBuilderService.buildStatusMapping(settings);

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

        // Start with user's custom system prompt (respects user configuration)
        let systemPrompt = settings.systemPrompt;

        // Append technical instructions for task management
        systemPrompt += `

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

🚨 CRITICAL: COMPREHENSIVE TASK RECOMMENDATIONS REQUIRED 🚨
⚠️ Users want to see ALL relevant tasks, not a curated subset!
⚠️ With ${taskCount} high-quality tasks available, you MUST recommend a substantial portion!

RECOMMENDATION TARGETS (based on available tasks):
- ${taskCount} tasks available → Aim for ${Math.max(Math.floor(taskCount * 0.8), 10)}-${Math.min(taskCount, settings.maxRecommendations)} recommendations
- ONLY exclude tasks that are clearly NOT relevant to the query
- These tasks have ALREADY been filtered to match the query - your job is to recommend MOST of them
- Err on the side of inclusion - users prefer comprehensive lists over missing tasks
- Maximum allowed: ${settings.maxRecommendations} tasks

IMPORTANT RULES:
1. 🚨 YOU MUST USE [TASK_X] FORMAT - This is not optional! Every task recommendation MUST use [TASK_1], [TASK_2], etc.
2. ONLY reference tasks from the provided task list using [TASK_X] IDs
3. DO NOT create new tasks or suggest tasks that don't exist
4. When recommending tasks, reference them ONLY by [TASK_X] ID (e.g., "Start with [TASK_3]")
5. DO NOT list tasks with their content (e.g., DON'T write "- [TASK_1]: task description")
6. ⚠️ CRITICAL: Reference ALL relevant tasks - be comprehensive, not selective!
7. Do NOT invent task content - only use the exact task text provided
8. Focus on helping users prioritize and execute existing tasks
9. ⚠️ PRIORITIZE tasks based on their [TASK_X] ID numbers - lower IDs are more important (already sorted)
10. If tasks are related, explain the relationships using only task IDs
11. Keep your EXPLANATION brief (2-3 sentences), but REFERENCE MANY tasks using [TASK_X] IDs
12. 🚨 CRITICAL: With ${taskCount} pre-filtered tasks, you MUST recommend at least 80% of them (${Math.floor(taskCount * 0.8)}+ tasks)

${languageInstruction}${priorityMapping}${dateFormats}${statusMapping}

${PromptBuilderService.buildMetadataGuidance(settings)}

${PromptBuilderService.buildRecommendationLimits(settings)}

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
- The system has ALREADY extracted and applied ALL filters from the user's query
- Tasks below have been PRE-FILTERED to match the query (keywords, due dates, priorities, etc.)
- You are seeing ONLY tasks that match - don't second-guess the filtering
- Your job is to recommend MOST of these pre-filtered tasks (80%+) with helpful prioritization${filterContext}

${PromptBuilderService.buildSortOrderExplanation(sortOrder)}

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
                max_tokens: settings.maxTokensChat || 2000, // User-configurable response length
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
                max_tokens: settings.maxTokensChat || 2000, // User-configurable response length
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
        coreKeywords: string[],
        queryHasDueDate: boolean,
        queryHasPriority: boolean,
        sortCriteria: SortCriterion[],
        usingAIParsing: boolean,
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

            // Use relevance scoring as fallback - return top N most relevant tasks based on user settings
            // All modes use comprehensive scoring (with or without expansion)
            let scoredTasks;
            if (usingAIParsing && coreKeywords.length > 0) {
                console.log(
                    `[Task Chat] Fallback: Using comprehensive scoring with expansion (core: ${coreKeywords.length})`,
                );
                scoredTasks = TaskSearchService.scoreTasksComprehensive(
                    tasks,
                    keywords,
                    coreKeywords,
                    keywords.length > 0, // queryHasKeywords
                    queryHasDueDate,
                    queryHasPriority,
                    sortCriteria,
                    settings.relevanceCoefficient,
                    settings.dueDateCoefficient,
                    settings.priorityCoefficient,
                    settings,
                );
            } else {
                console.log(
                    `[Task Chat] Fallback: Using comprehensive scoring without expansion`,
                );
                scoredTasks = TaskSearchService.scoreTasksComprehensive(
                    tasks,
                    keywords,
                    keywords,
                    keywords.length > 0, // queryHasKeywords
                    queryHasDueDate,
                    queryHasPriority,
                    sortCriteria,
                    settings.relevanceCoefficient,
                    settings.dueDateCoefficient,
                    settings.priorityCoefficient,
                    settings,
                );
            }
            const topTasks = scoredTasks
                .slice(0, settings.maxRecommendations)
                .map((st: { score: number; task: Task }) => st.task);

            console.log(
                `[Task Chat] Fallback: returning top ${topTasks.length} tasks by relevance (user limit: ${settings.maxRecommendations})`,
            );
            return topTasks;
        }

        console.log(
            `[Task Chat] AI explicitly recommended ${recommended.length} tasks.`,
        );

        // Trust the AI's judgment on how many tasks to recommend
        // The prompt emphasizes comprehensive recommendations, so if AI selects fewer tasks,
        // it means the others aren't relevant enough to include

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
