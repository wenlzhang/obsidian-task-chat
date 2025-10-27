import { App, requestUrl, moment } from "obsidian";
import { Task, ChatMessage, TokenUsage } from "../models/task";
import { ErrorHandler, AIError } from "../utils/errorHandler";
import {
    PluginSettings,
    SortCriterion,
    StatusMapping,
    getCurrentProviderConfig,
    getProviderForPurpose,
    getProviderConfigForPurpose,
} from "../settings";
import { TaskSearchService } from "./taskSearchService";
import { QueryParserService, ParsedQuery } from "./aiQueryParserService";
import { PricingService } from "./pricingService";
import { TaskSortService } from "./taskSortService";
import { PromptBuilderService } from "./aiPromptBuilderService";
import { DataviewService } from "./dataviewService";
import { Logger } from "../utils/logger";
import { StreamingService, StreamChunk } from "./streamingService";
import {
    generateZeroResultsDiagnostic,
    generateAIFormatWarning,
    cleanWarningsFromContent,
} from "./warningService";

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
     *
     * @param app Obsidian app instance (for Dataview API access)
     * @param message User's query message
     * @param tasks Initial task list (may be reloaded with property filters)
     * @param chatHistory Chat conversation history
     * @param settings Plugin settings
     */
    static async sendMessage(
        app: App,
        message: string,
        tasks: Task[],
        chatHistory: ChatMessage[],
        settings: PluginSettings,
        onStream?: (chunk: string) => void, // Optional streaming callback
        abortSignal?: AbortSignal, // Optional abort signal for cancellation
    ): Promise<{
        response: string;
        recommendedTasks?: Task[];
        tokenUsage?: TokenUsage;
        directResults?: Task[];
        parsedQuery?: any; // ParsedQuery with aiUnderstanding metadata
        error?: any; // Structured error for fallback results
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
            Logger.debug("Mode: Simple Search (regex parsing)");
            try {
                intent = TaskSearchService.analyzeQueryIntent(
                    message,
                    settings,
                );
            } catch (error) {
                // Handle invalid property values (e.g., s:invalid_status)
                if (error instanceof Error) {
                    return {
                        response: `❌ ${error.message}`,
                        directResults: [],
                        tokenUsage: {
                            promptTokens: 0,
                            completionTokens: 0,
                            totalTokens: 0,
                            estimatedCost: 0,
                            model: "",
                            provider: "openai",
                            isEstimated: false,
                        },
                    };
                }
                throw error;
            }
            usingAIParsing = false;
        } else {
            // Mode 2 & 3: Smart Search / Task Chat - AI parsing
            Logger.debug(
                `Mode: ${chatMode === "smart" ? "Smart Search" : "Task Chat"} (AI parsing)`,
            );

            // OPTIMIZATION: Pre-extract standard property syntax before AI parsing
            // This saves tokens and prevents AI from trying to expand property terms like "p1", "due", etc.
            // Step 1: Extract properties using regex (fast, reliable)
            const preExtractedIntent = TaskSearchService.analyzeQueryIntent(
                message,
                settings,
            );

            // Step 2: Remove property syntax from query string
            // This ONLY removes syntax, does NOT split words or filter stop words
            // AI will handle word splitting, stop word filtering, and semantic expansion
            const cleanedQuery =
                TaskSearchService.removePropertySyntax(message);

            Logger.debug(
                `Pre-extracted properties, cleaned query: "${message}" → "${cleanedQuery}"`,
            );

            try {
                parsedQuery = await QueryParserService.parseQuery(
                    cleanedQuery, // Send cleaned query to AI
                    settings,
                );

                // Merge pre-extracted properties with AI-parsed properties
                // Pre-extracted properties take precedence (more reliable)
                if (preExtractedIntent.extractedPriority) {
                    parsedQuery.priority = preExtractedIntent.extractedPriority;
                }
                if (preExtractedIntent.extractedDueDateFilter) {
                    parsedQuery.dueDate =
                        preExtractedIntent.extractedDueDateFilter;
                }
                if (preExtractedIntent.extractedStatus) {
                    parsedQuery.status = preExtractedIntent.extractedStatus;
                }
                if (preExtractedIntent.extractedFolder) {
                    parsedQuery.folder = preExtractedIntent.extractedFolder;
                }
                if (
                    preExtractedIntent.extractedTags &&
                    preExtractedIntent.extractedTags.length > 0
                ) {
                    parsedQuery.tags = preExtractedIntent.extractedTags;
                }

                Logger.debug("AI parsed query:", parsedQuery);
                usingAIParsing = true; // AI parsing succeeded
            } catch (error) {
                // AI parsing failed - capture error metadata for UI display
                Logger.warn(
                    "⚠️ AI Query Parser Failed - falling back to Simple Search module",
                );
                Logger.error("Parser error details:", error);

                // Store error info in parsedQuery for UI display
                const errorMessage =
                    error instanceof Error ? error.message : String(error);
                const parserModel = (error as any).parserModel || "unknown";

                parsedQuery = {
                    _parserError: errorMessage,
                    _parserModel: parserModel,
                } as ParsedQuery;

                usingAIParsing = false;
            }

            // Convert ParsedQuery to intent format for compatibility
            // Check if parsedQuery has actual parsed data (not just error info)
            const hasParserError = parsedQuery && parsedQuery._parserError;
            const hasParsedData = parsedQuery && !hasParserError;

            if (hasParsedData) {
                // AI parsing succeeded - use AI-parsed results
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
                let keywords =
                    parsedQuery.keywords && parsedQuery.keywords.length > 0
                        ? parsedQuery.keywords
                        : hasAnyFilter
                          ? []
                          : [message];

                // NOTE: Property trigger word filtering REMOVED
                // AI already separates properties (priority, status, dueDate) from keywords
                // No need to filter again - doing so removes legitimate semantic expansions
                // Example: "implement priority queue" - "priority" is task content, not filter

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
                // AI parsing failed - fallback to Simple Search module
                Logger.debug(
                    `Fallback: Calling Simple Search module (TaskSearchService.analyzeQueryIntent)`,
                );
                try {
                    intent = TaskSearchService.analyzeQueryIntent(
                        message,
                        settings,
                    );
                    Logger.debug(`Simple Search fallback results:`, intent);
                } catch (error) {
                    // Handle invalid property values (e.g., s:invalid_status)
                    if (error instanceof Error) {
                        return {
                            response: `❌ ${error.message}`,
                            directResults: [],
                            tokenUsage: {
                                promptTokens: 0,
                                completionTokens: 0,
                                totalTokens: 0,
                                estimatedCost: 0,
                                model: "",
                                provider: "openai",
                                isEstimated: false,
                            },
                            parsedQuery: hasParserError
                                ? parsedQuery
                                : undefined, // Include error info if present
                        };
                    }
                    throw error;
                }
            }
        }

        // Apply filters: Use Dataview API for properties, JavaScript for keywords
        if (
            intent.extractedPriority ||
            intent.extractedDueDateFilter ||
            intent.extractedStatus ||
            intent.extractedFolder ||
            intent.extractedTags.length > 0 ||
            intent.keywords.length > 0
        ) {
            Logger.debug("Extracted intent:", {
                priority: intent.extractedPriority,
                dueDate: intent.extractedDueDateFilter,
                status: intent.extractedStatus,
                folder: intent.extractedFolder,
                tags: intent.extractedTags,
                keywords: intent.keywords,
            });

            if (intent.keywords.length > 0) {
                Logger.debug(
                    `Searching with keywords: [${intent.keywords.join(", ")}]`,
                );
            }

            // Step 1: Filter by properties at Dataview API level (if any property filters)
            let tasksAfterPropertyFilter = tasks;
            const hasPropertyFilters = !!(
                intent.extractedPriority ||
                intent.extractedDueDateFilter ||
                intent.extractedDueDateRange ||
                intent.extractedStatus
            );

            if (hasPropertyFilters) {
                // Reload tasks from Dataview API with property filters
                // Multi-value support: priority and status can be arrays
                tasksAfterPropertyFilter =
                    await DataviewService.parseTasksFromDataview(
                        app,
                        settings,
                        undefined, // No legacy date filter
                        {
                            priority: intent.extractedPriority, // Can be number or number[]
                            dueDate: intent.extractedDueDateFilter, // Single date or relative
                            dueDateRange: intent.extractedDueDateRange, // Date range
                            status: intent.extractedStatus, // Can be string or string[]
                        },
                    );
            }

            // Step 2: Apply remaining filters (folder, tags, keywords) in JavaScript
            const filteredTasks = TaskSearchService.applyCompoundFilters(
                tasksAfterPropertyFilter,
                {
                    priority: undefined, // Already filtered at Dataview level
                    dueDate: undefined, // Already filtered at Dataview level
                    status: undefined, // Already filtered at Dataview level
                    folder: intent.extractedFolder,
                    tags: intent.extractedTags,
                    keywords:
                        intent.keywords.length > 0
                            ? intent.keywords
                            : undefined,
                },
            );

            Logger.debug(
                `After filtering: ${filteredTasks.length} tasks found`,
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

                // Build helpful message based on total task count
                let responseMessage = `No tasks found matching ${filterDesc}.`;

                // If we have 0 initial tasks, it might be a Dataview indexing issue
                if (tasks.length === 0) {
                    responseMessage += `\n\n💡 **Tip**: If you have tasks in your vault, this might mean:\n`;
                    responseMessage += `• Dataview is still indexing (wait 10-30 seconds)\n`;
                    responseMessage += `• Dataview index delay is too long (try reducing index delay in Dataview settings)\n`;
                    responseMessage += `• Tasks don't use the expected syntax (e.g., \`- [ ] Task\`)\n\n`;
                    responseMessage += `Try clicking the **Refresh tasks** button and waiting a moment.`;
                } else {
                    // We have tasks, but none match the search
                    responseMessage += `\n\n💡 Try:\n`;
                    responseMessage += `• Broadening your search terms\n`;
                    responseMessage += `• Removing some filters\n`;
                    responseMessage += `• Checking for typos`;
                }

                return {
                    response: responseMessage,
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
                    Logger.debug(
                        `Using comprehensive scoring with expansion (core: ${parsedQuery.coreKeywords.length}, expanded: ${intent.keywords.length})`,
                    );
                    scoredTasks = TaskSearchService.scoreTasksComprehensive(
                        filteredTasks,
                        intent.keywords, // Expanded keywords
                        parsedQuery.coreKeywords, // Core keywords
                        queryType.hasKeywords, // NEW: Query has keywords
                        !!intent.extractedDueDateFilter,
                        !!intent.extractedPriority,
                        !!intent.extractedStatus,
                        sortOrder,
                        settings.relevanceCoefficient,
                        settings.dueDateCoefficient,
                        settings.priorityCoefficient,
                        settings.statusCoefficient,
                        settings,
                    );
                } else {
                    // Simple Search: no semantic expansion (keywords = coreKeywords)
                    Logger.debug(
                        `Using comprehensive scoring without expansion (keywords: ${intent.keywords.length})`,
                    );
                    scoredTasks = TaskSearchService.scoreTasksComprehensive(
                        filteredTasks,
                        intent.keywords, // All keywords are "core" (no expansion)
                        intent.keywords, // Same as keywords (no distinction)
                        queryType.hasKeywords, // NEW: Query has keywords
                        !!intent.extractedDueDateFilter,
                        !!intent.extractedPriority,
                        !!intent.extractedStatus,
                        sortOrder,
                        settings.relevanceCoefficient,
                        settings.dueDateCoefficient,
                        settings.priorityCoefficient,
                        settings.statusCoefficient,
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
                const maxStatusScore = Math.max(
                    ...Object.values(settings.taskStatusMapping).map(
                        (config) => config.score,
                    ),
                );

                // Dynamic max score based on what will ACTUALLY be scored
                // Must mirror the activation logic in scoreTasksComprehensive:
                // - relevance active ONLY if: queryHasKeywords (not sort order!)
                // - dueDate active if: queryHasDueDate || dueDateInSort
                // - priority active if: queryHasPriority || priorityInSort
                // - status active if: queryHasStatus || statusInSort
                // Note: Sort order should NOT activate relevance because without keywords,
                // all relevance scores = 0 but maxScore inflates → threshold too high → filters all tasks
                const dueDateInSort =
                    settings.taskSortOrder.includes("dueDate");
                const priorityInSort =
                    settings.taskSortOrder.includes("priority");
                const statusInSort = settings.taskSortOrder.includes("status");

                const relevanceActive = queryType.hasKeywords; // Fixed: removed || relevanceInSort
                const dueDateActive =
                    !!intent.extractedDueDateFilter || dueDateInSort;
                const priorityActive =
                    !!intent.extractedPriority || priorityInSort;
                const statusActive = !!intent.extractedStatus || statusInSort;

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
                if (statusActive) {
                    maxScore += maxStatusScore * settings.statusCoefficient;
                    activeComponents.push("status");
                }

                Logger.debug(
                    `Query type: ${queryType.queryType}, Active components: [${activeComponents.join(", ")}], maxScore = ${maxScore.toFixed(1)}`,
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
                    Logger.debug(
                        `Quality filter: 0% (adaptive) → ${baseThreshold.toFixed(2)}/${maxScore.toFixed(1)} [${mode}] (${intent.keywords.length} keywords)`,
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
                    Logger.debug(
                        `Quality filter: ${percentage}% (user-defined) → ${baseThreshold.toFixed(2)}/${maxScore.toFixed(1)} [${mode}]`,
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
                    Logger.debug(
                        `Minimum relevance filter (${settings.minimumRelevanceScore.toFixed(2)}): ${beforeRelevanceFilter} → ${qualityFilteredScored.length} tasks`,
                    );
                }

                qualityFilteredTasks = qualityFilteredScored.map(
                    (st) => st.task,
                );

                Logger.debug(
                    `Quality filter applied: ${filteredTasks.length} → ${qualityFilteredTasks.length} tasks (threshold: ${finalThreshold.toFixed(2)})`,
                );

                // Log sample task scores for transparency
                if (qualityFilteredScored.length > 0) {
                    const sample = qualityFilteredScored[0];
                    Logger.debug(`Sample score breakdown:`);
                    Logger.debug(
                        `  Task: "${sample.task.text.substring(0, 60)}..."`,
                    );
                    Logger.debug(
                        `  Relevance: ${sample.relevanceScore.toFixed(2)} (× ${settings.relevanceCoefficient} = ${(sample.relevanceScore * settings.relevanceCoefficient).toFixed(2)})`,
                    );
                    Logger.debug(
                        `  Due Date: ${sample.dueDateScore.toFixed(2)} (× ${settings.dueDateCoefficient} = ${(sample.dueDateScore * settings.dueDateCoefficient).toFixed(2)})`,
                    );
                    Logger.debug(
                        `  Priority: ${sample.priorityScore.toFixed(2)} (× ${settings.priorityCoefficient} = ${(sample.priorityScore * settings.priorityCoefficient).toFixed(2)})`,
                    );
                    Logger.debug(
                        `  Status: ${sample.statusScore.toFixed(2)} (× ${settings.statusCoefficient} = ${(sample.statusScore * settings.statusCoefficient).toFixed(2)})`,
                    );
                    Logger.debug(
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
                        Logger.debug(
                            `Adaptive mode: quality filter too strict (${qualityFilteredTasks.length} tasks), keeping top ${minTasksNeeded} scored tasks`,
                        );
                        qualityFilteredScored = scoredTasks
                            .sort((a, b) => b.score - a.score)
                            .slice(0, minTasksNeeded);
                        qualityFilteredTasks = qualityFilteredScored.map(
                            (st) => st.task,
                        );
                    }
                } else {
                    Logger.debug(
                        `User has explicit filters - respecting strict filtering (${qualityFilteredTasks.length} tasks)`,
                    );

                    // If quality filter resulted in zero tasks, add detailed diagnostic
                    // This works for ALL modes (Simple, Smart, Task Chat)
                    if (
                        qualityFilteredTasks.length === 0 &&
                        filteredTasks.length > 0
                    ) {
                        // Get top 3 task scores for analysis
                        const topScores = scoredTasks
                            .sort((a, b) => b.score - a.score)
                            .slice(0, 3);

                        const diagnosticMessage = generateZeroResultsDiagnostic(
                            settings,
                            queryType,
                            maxScore,
                            finalThreshold,
                            filteredTasks.length,
                            topScores,
                        );

                        // Return diagnostic message for ALL modes
                        // Simple/Smart Search: Return as direct results with diagnostic
                        // Task Chat: Return as response with diagnostic
                        if (chatMode === "chat") {
                            return {
                                response:
                                    diagnosticMessage +
                                    `No tasks match your current filter settings.`,
                                recommendedTasks: [],
                                tokenUsage: undefined,
                                parsedQuery: usingAIParsing
                                    ? parsedQuery
                                    : undefined,
                            };
                        } else {
                            // For Simple/Smart Search modes
                            return {
                                response:
                                    diagnosticMessage +
                                    `No tasks match your current filter settings.`,
                                directResults: [],
                                tokenUsage: undefined,
                                parsedQuery: usingAIParsing
                                    ? parsedQuery
                                    : undefined,
                            };
                        }
                    }
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
                            !!intent.extractedStatus,
                            sortOrder,
                            settings.relevanceCoefficient,
                            settings.dueDateCoefficient,
                            settings.priorityCoefficient,
                            settings.statusCoefficient,
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
                            !!intent.extractedStatus,
                            sortOrder,
                            settings.relevanceCoefficient,
                            settings.dueDateCoefficient,
                            settings.priorityCoefficient,
                            settings.statusCoefficient,
                            settings,
                        );
                }

                comprehensiveScores = new Map(
                    scoredTasksForSort.map((st) => [st.task.id, st.score]),
                );
            }

            Logger.debug(`Sort order: [${sortOrder.join(", ")}]`);

            // Sort tasks for display using multi-criteria sorting
            const sortedTasksForDisplay =
                TaskSortService.sortTasksMultiCriteria(
                    qualityFilteredTasks,
                    sortOrder,
                    settings,
                    comprehensiveScores,
                );

            // Three-mode result delivery logic
            // Mode 1 (Simple Search) & Mode 2 (Smart Search) → Direct results
            // Mode 3 (Task Chat) → AI analysis
            if (chatMode === "simple" || chatMode === "smart") {
                // Return direct results for Simple Search and Smart Search
                Logger.debug(
                    `Result delivery: Direct (${chatMode === "simple" ? "Simple Search" : "Smart Search"} mode, ${sortedTasksForDisplay.length} results)`,
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
                    // Use actual token usage from query parser
                    if (parsedQuery && parsedQuery._parserTokenUsage) {
                        const parserUsage = parsedQuery._parserTokenUsage;
                        tokenUsage = {
                            promptTokens: parserUsage.promptTokens,
                            completionTokens: parserUsage.completionTokens,
                            totalTokens: parserUsage.totalTokens,
                            estimatedCost: parserUsage.estimatedCost,
                            model: parserUsage.model,
                            provider: settings.aiProvider,
                            isEstimated: parserUsage.isEstimated,
                            directSearchReason: `${sortedTasksForDisplay.length} result${sortedTasksForDisplay.length !== 1 ? "s" : ""}`,
                        };
                    } else {
                        // Fallback to estimates if parser token usage not available
                        tokenUsage = {
                            promptTokens: 200,
                            completionTokens: 50,
                            totalTokens: 250,
                            estimatedCost: 0.0001,
                            model: getCurrentProviderConfig(settings).model,
                            provider: settings.aiProvider,
                            isEstimated: true,
                            directSearchReason: `${sortedTasksForDisplay.length} result${sortedTasksForDisplay.length !== 1 ? "s" : ""}`,
                        };
                    }
                }

                // For Simple Search, create a minimal parsedQuery with core keywords
                // so the UI can display them (even though no AI expansion was used)
                // NOTE: intent.keywords already deduplicated + filtered by extractKeywords()
                // No need to process again - just use them directly!
                let finalParsedQuery = parsedQuery;
                if (
                    chatMode === "simple" &&
                    intent.keywords &&
                    intent.keywords.length > 0
                ) {
                    finalParsedQuery = {
                        coreKeywords: intent.keywords, // Already clean from extractKeywords()
                        keywords: intent.keywords, // Already clean from extractKeywords()
                        expansionMetadata: {
                            enabled: false,
                            expansionsPerLanguagePerKeyword: 0,
                            languagesUsed: [],
                            totalKeywords: intent.keywords.length,
                            coreKeywordsCount: intent.keywords.length,
                        },
                    };
                }

                return {
                    response: "",
                    directResults: sortedTasksForDisplay.slice(
                        0,
                        settings.maxDirectResults,
                    ),
                    tokenUsage,
                    parsedQuery: finalParsedQuery,
                };
            }

            // Mode 3: Task Chat - Continue to AI analysis
            // For AI context, sort differently using aiContextSortOrder (optimized for AI understanding)
            Logger.debug(
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

            Logger.debug(
                `Sending top ${tasksToAnalyze.length} tasks to AI (max: ${settings.maxTasksForAI})`,
            );
            Logger.debug(
                `Total filtered tasks available: ${qualityFilteredTasks.length}`,
            );

            // DEBUG: Log first 10 tasks with their sort criteria values
            Logger.debug(
                `=== TOP 10 TASKS DEBUG (sorted by ${sortOrder.join(" → ")}) ===`,
            );
            tasksToAnalyze.slice(0, 10).forEach((task, index) => {
                const score = comprehensiveScores?.get(task.id) || 0;
                const dueInfo = task.dueDate || "none";
                const priorityInfo =
                    task.priority !== undefined ? task.priority : "none";
                Logger.debug(
                    `  ${index + 1}. [score=${score}] [due=${dueInfo}] [p=${priorityInfo}] ${task.text.substring(0, 60)}...`,
                );
            });
            Logger.debug(`===========================================`);

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
                    onStream,
                    abortSignal,
                );

                Logger.debug("AI response:", response);

                // Extract task IDs that AI referenced
                const {
                    tasks: recommendedTasks,
                    indices: recommendedIndices,
                    usedFallback,
                } = this.extractRecommendedTasks(
                    response,
                    tasksToAnalyze,
                    settings,
                    intent.keywords || [],
                    parsedQuery?.coreKeywords || [],
                    !!intent.extractedDueDateFilter,
                    !!intent.extractedPriority,
                    !!intent.extractedStatus,
                    sortOrder,
                    usingAIParsing,
                );

                // Replace [TASK_X] references with task numbers matching recommended list (1, 2, 3...)
                let processedResponse = this.replaceTaskReferences(
                    response,
                    recommendedIndices,
                );

                // Add user-facing warning if fallback was used
                if (usedFallback) {
                    // Use the model info from tokenUsage (the actual model used for this request)
                    // Not getCurrentProviderConfig(settings) which might have changed if user switched models
                    const modelInfo = `${tokenUsage.model} (${tokenUsage.provider})`;
                    const timestamp = moment().format("HH:mm:ss");

                    const warningMessage = generateAIFormatWarning(
                        recommendedTasks.length,
                        modelInfo,
                        timestamp,
                    );
                    processedResponse = warningMessage + processedResponse;
                }

                // Combine parser token usage with final analysis token usage
                let combinedTokenUsage = tokenUsage;
                if (
                    usingAIParsing &&
                    parsedQuery &&
                    parsedQuery._parserTokenUsage
                ) {
                    const parserUsage = parsedQuery._parserTokenUsage;

                    // Simplify model display when parser and analysis use same model
                    const modelDisplay =
                        parserUsage.model === tokenUsage.model
                            ? parserUsage.model // Same model - show once
                            : `${parserUsage.model} (parser) + ${tokenUsage.model} (analysis)`; // Different - show both

                    combinedTokenUsage = {
                        promptTokens:
                            parserUsage.promptTokens + tokenUsage.promptTokens,
                        completionTokens:
                            parserUsage.completionTokens +
                            tokenUsage.completionTokens,
                        totalTokens:
                            parserUsage.totalTokens + tokenUsage.totalTokens,
                        estimatedCost:
                            parserUsage.estimatedCost +
                            tokenUsage.estimatedCost,
                        model: modelDisplay,
                        provider: settings.aiProvider,
                        isEstimated:
                            parserUsage.isEstimated || tokenUsage.isEstimated,
                    };
                    Logger.debug(
                        `[Task Chat] Combined token usage: Parser (${parserUsage.totalTokens}) + Analysis (${tokenUsage.totalTokens}) = ${combinedTokenUsage.totalTokens} total tokens`,
                    );
                }

                return {
                    response: processedResponse,
                    recommendedTasks,
                    tokenUsage: combinedTokenUsage,
                    parsedQuery: usingAIParsing ? parsedQuery : undefined,
                };
            } catch (error) {
                Logger.error("AI Analysis Error:", error);
                Logger.warn(
                    "⚠️ AI Analysis Failed - returning filtered tasks as fallback",
                );

                // Create structured error with helpful information and solutions
                const providerConfig = getCurrentProviderConfig(settings);
                const modelInfo = `${settings.aiProvider}/${providerConfig.model}`;
                const structured = ErrorHandler.createAnalysisError(
                    error,
                    modelInfo,
                );

                // FALLBACK: Stage 1 always provides results (semantic OR simple search)
                // If parser succeeded → semantic search results
                // If parser failed → simple search results (from Stage 1 fallback)
                // Either way, we should have tasks to display!
                if (sortedTasksForDisplay.length > 0) {
                    const searchType = usingAIParsing
                        ? "semantic search"
                        : "simple search";
                    Logger.debug(
                        `Returning ${sortedTasksForDisplay.length} tasks from ${searchType} as fallback`,
                    );

                    // Add fallback info to error
                    structured.fallbackUsed = usingAIParsing
                        ? `Semantic search succeeded (${sortedTasksForDisplay.length} tasks filtered and sorted). Showing Smart Search results without AI summary.`
                        : `AI parser failed, used Simple Search fallback (${sortedTasksForDisplay.length} tasks found). Analysis also failed, showing results without AI summary.`;

                    // Return filtered tasks with error info (will be displayed in UI)
                    return {
                        response: `Found ${sortedTasksForDisplay.length} matching task(s)`,
                        recommendedTasks: sortedTasksForDisplay.slice(
                            0,
                            settings.maxRecommendations,
                        ),
                        tokenUsage: undefined, // No tokens used since AI failed
                        parsedQuery: usingAIParsing ? parsedQuery : undefined,
                        error: structured, // Attach error for UI display
                    };
                } else {
                    // Only throw if we have absolutely no tasks (rare edge case)
                    Logger.error(
                        "No tasks found - cannot provide fallback results",
                    );
                    throw new AIError(structured);
                }
            }
        } else {
            // No filters detected - return all tasks with default sorting
            Logger.debug(
                "No filters detected, returning all tasks with default sort order",
            );

            Logger.debug(`Sort order: [${sortOrder.join(", ")}]`);

            // Sort all tasks using multi-criteria sorting
            const sortedTasks = TaskSortService.sortTasksMultiCriteria(
                tasks,
                sortOrder,
                settings,
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

        Logger.debug(
            `Query type: ${queryType} (keywords: ${hasKeywords}, properties: ${hasTaskProperties})`,
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

        Logger.debug(`Building task context with ${tasks.length} tasks:`);
        tasks.forEach((task, index) => {
            Logger.debug(`  [TASK_${index + 1}]: ${task.text}`);
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
                settings.taskStatusMapping[task.statusCategory]?.displayName ||
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
        // Build prominent language instruction based on user settings
        let languageInstructionBlock = "";
        switch (settings.responseLanguage) {
            case "english":
                languageInstructionBlock = `
🌍 RESPONSE LANGUAGE REQUIREMENT (User-Configured)
⚠️ CRITICAL: You MUST respond in English.
- This is a user setting that overrides all other language considerations
- ALL your response text must be in English
- Task descriptions will remain in their original language, but YOUR explanation must be English
`;
                break;
            case "custom":
                languageInstructionBlock = `
🌍 RESPONSE LANGUAGE REQUIREMENT (User-Configured)
⚠️ CRITICAL: ${settings.customLanguageInstruction}
- This is a user setting that overrides all other language considerations
- Follow this instruction precisely for ALL your response text
`;
                break;
            case "auto":
            default:
                // Use queryLanguages if configured, otherwise default behavior
                if (
                    settings.queryLanguages &&
                    settings.queryLanguages.length > 0
                ) {
                    const langs = settings.queryLanguages.join(", ");
                    languageInstructionBlock = `
🌍 RESPONSE LANGUAGE (Auto-Detection Mode)
⚠️ IMPORTANT: Respond in the SAME language as the user's query.
- Supported languages: ${langs}
- Detect the primary language from the user's query
- If the query mixes multiple languages, use the primary language detected from the supported list
- Match the user's language naturally throughout your entire response
`;
                } else {
                    languageInstructionBlock = `
🌍 RESPONSE LANGUAGE (Auto-Detection Mode)
⚠️ IMPORTANT: Respond in the SAME language as the user's query.
- Detect the language from the user's message
- If the query mixes multiple languages, use the primary language detected
- Match the user's language naturally throughout your entire response
`;
                }
                break;
        }

        // Build dynamic mappings from settings (using shared PromptBuilderService)
        const priorityMapping =
            PromptBuilderService.buildPriorityMapping(settings);
        const dateFormats = PromptBuilderService.buildDateFormats(settings);
        const statusMapping = PromptBuilderService.buildStatusMapping(settings);

        // Add current date context for accurate due date descriptions
        const today = moment().format("YYYY-MM-DD");
        const currentDateContext = `
📅 CURRENT DATE: ${today}

When describing task due dates, be ACCURATE relative to today:
- Tasks due BEFORE ${today} are OVERDUE (过期) - do NOT say "due soon"!
- Tasks due ON ${today} are due TODAY (今天到期)
- Tasks due within next 7 days are due SOON (即将到期)
- Tasks due after 7+ days are FUTURE tasks (未来任务)

Always check the actual due date against ${today} before describing urgency!`;

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
        // LANGUAGE INSTRUCTION COMES FIRST - most important!
        systemPrompt += languageInstructionBlock;

        // CRITICAL FORMAT REQUIREMENT (simple, prominent, early)
        systemPrompt += `

🚨 CRITICAL FORMAT REQUIREMENT 🚨
YOU MUST REFERENCE TASKS USING [TASK_X] FORMAT
Example: "Start with [TASK_15], then [TASK_42], then [TASK_3]"
This is MANDATORY - the system will fail if you don't use this exact format!
`;

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
⚠️ Users want to see MOST relevant tasks, not a small curated subset!
⚠️ With ${taskCount} high-quality tasks available, you MUST recommend a most of them!

RECOMMENDATION TARGETS (based on available tasks):
- ${taskCount} tasks available, maximum limit: ${settings.maxRecommendations} tasks
- Target: Recommend at least ${Math.min(Math.max(Math.floor(taskCount * 0.8), 10), settings.maxRecommendations)} tasks (80% of available, up to limit)
- ONLY exclude tasks that are clearly NOT relevant to the query
- These tasks have ALREADY been filtered to match the query - your job is to recommend MOST of them
- Err on the side of inclusion - users prefer comprehensive lists over missing tasks

IMPORTANT RULES:
1. 🚨 YOU MUST USE [TASK_X] FORMAT - This is not optional! Every task recommendation MUST use the EXACT [TASK_X] IDs (e.g., [TASK_1], [TASK_2], etc.) from the task list below
2. ⚠️ CRITICAL: Use the EXACT [TASK_X] IDs you see in the context (e.g., if you see [TASK_15], [TASK_42], [TASK_3] in the list, use those exact numbers)
3. DO NOT invent sequential IDs like [TASK_1], [TASK_2], [TASK_3] - use the actual IDs from the provided list
4. ONLY reference tasks from the provided task list using their original [TASK_X] IDs
5. DO NOT create new tasks or suggest tasks that don't exist
6. When recommending tasks, reference them ONLY by their original [TASK_X] ID from the list below
7. DO NOT list tasks with their content (e.g., DON'T write "- [TASK_15]: task description")
8. ⚠️ CRITICAL: Reference ALL relevant tasks - be comprehensive, not selective!
9. Do NOT invent task content - only use the exact task text provided
10. Focus on helping users prioritize and execute existing tasks
11. ⚠️ PRIORITIZE tasks based on their [TASK_X] ID numbers - lower IDs are more important (already sorted)
12. If tasks are related, explain the relationships using only their original task IDs
13. Keep your EXPLANATION brief (2-3 sentences), but REFERENCE MANY tasks using their original [TASK_X] IDs
14. 🚨 CRITICAL: With ${taskCount} pre-filtered tasks, you MUST recommend at least ${Math.min(Math.max(Math.floor(taskCount * 0.8), 10), settings.maxRecommendations)} tasks (80% of available, up to limit)

${currentDateContext}${priorityMapping}${dateFormats}${statusMapping}

${PromptBuilderService.buildMetadataGuidance(settings)}

${PromptBuilderService.buildRecommendationLimits(settings)}

🚨 CRITICAL: HOW TO REFERENCE TASKS IN YOUR RESPONSE:

⚠️ YOU MUST USE THE EXACT [TASK_X] IDs FROM THE TASK LIST BELOW!

- The task list below shows tasks labeled [TASK_1], [TASK_2], [TASK_15], [TASK_42], etc.
- Use THOSE EXACT IDs when referencing tasks - DO NOT make up sequential IDs!
- The system will AUTOMATICALLY convert [TASK_X] to "Task N" where N matches the visual list (1, 2, 3...)

EXAMPLES (assuming task list has [TASK_1], [TASK_15], [TASK_42], [TASK_3], etc.):

✅ CORRECT: "Start with [TASK_15] (the most relevant/due soonest/highest priority), then [TASK_42], then [TASK_3]"
  → User sees: "Start with Task 1 (the most relevant/due soonest/highest priority), then Task 2, then Task 3"
  → Tasks appear in recommended list as: 1, 2, 3

✅ CORRECT: "Focus on [TASK_42] and [TASK_15]. The most relevant/due soonest/highest priority is [TASK_42]."
  → User sees: "Focus on Task 1 and Task 2. The most relevant/due soonest/highest priority is Task 1."

❌ WRONG: "Start with [TASK_1], then [TASK_2], then [TASK_3]" (unless those exact IDs exist in the list)
❌ WRONG: Making up IDs not in the task list

KEY POINTS:
- IDs you use: The actual [TASK_X] numbers from the context (may be high numbers like TASK_42)
- IDs user sees: Sequential "Task 1", "Task 2", "Task 3" based on recommended list order
- Your mention order determines the visual numbering: first mentioned = Task 1
- ALWAYS copy the exact [TASK_X] IDs you see in the task list below

🎯 RESPONSE STRUCTURE (Multi-Paragraph Format):

Your response should have a clear, organized structure with multiple focused paragraphs.

⚠️ REMEMBER: Use the response language specified at the top of these instructions!

1️⃣ OPENING PARAGRAPH (2-3 sentences):
   - State the goal/purpose based on the user's query
   - Provide context about what you'll help them accomplish
   - Example: "To effectively develop Task Chat, focus on the following relevant tasks."
   - Write this paragraph in the configured response language

2️⃣ BODY PARAGRAPHS (Main content - group by categories):
   - **OVERDUE & URGENT**: Group tasks that are overdue or have high priority
     * Use ACCURATE due date descriptions (check against current date!)
     * Mention priority levels correctly (use user's configured priority mapping)
     * Example: "Start with [TASK_X] and [TASK_Y], which are OVERDUE (due ${"<date>"}) with highest priority (P1)."
   
   - **HIGH PRIORITY**: Group high-priority tasks by status if relevant
     * Reference multiple tasks together: "Next, [TASK_A], [TASK_B], and [TASK_C] are all high priority..."
     * Mention their status accurately (open, in-progress, etc.)
   
   - **ADDITIONAL TASKS**: Other relevant tasks
     * Group related tasks: "Additionally, [TASK_D] and [TASK_E] will enhance functionality."

3️⃣ CLOSING SUMMARY (2-3 sentences):
   - Explain the strategic benefit of this prioritization
   - Provide actionable next steps or perspective
   - Example: "By prioritizing these tasks, you ensure a structured approach to development."
   - Write this paragraph in the configured response language
   - Do NOT repeat "Recommended tasks:" at the end (the system shows this automatically)

⚠️ CRITICAL REQUIREMENTS:
- 🌍 Write ALL paragraphs in the configured response language (see top of instructions)
- Reference ALL relevant tasks using [TASK_X] IDs throughout your paragraphs
- Group tasks logically (by urgency, priority, status, relationship, etc.)
- Make descriptions SPECIFIC and ACCURATE (not generic)
- Use multiple paragraphs for better readability
- End with strategic insight, NOT a task list

QUERY UNDERSTANDING:
- The system has ALREADY extracted and applied ALL filters from the user's query
- Tasks below have been PRE-FILTERED to match the query (keywords, due dates, priorities, status, etc.)
- You are seeing ONLY tasks that match - don't second-guess the filtering
- Your job is to recommend MOST of these pre-filtered tasks (80%+) with helpful prioritization${filterContext}

${PromptBuilderService.buildSortOrderExplanation(sortOrder)}

🚨 REMINDER: You MUST use [TASK_X] format for ALL task references!
The task list below shows tasks with their IDs. Reference them using those exact IDs.

${taskContext}`;

        const messages: any[] = [
            {
                role: "system",
                content: systemPrompt,
            },
        ];

        // Add recent chat history (user-configurable length to balance context and token cost)
        const historyLength = Math.min(
            Math.max(1, settings.chatHistoryContextLength),
            100,
        ); // Clamp between 1-100
        const recentHistory = chatHistory.slice(-historyLength);

        Logger.debug(
            `[Chat History] Sending ${recentHistory.length} messages to AI (user setting: ${settings.chatHistoryContextLength})`,
        );
        let warningsRemoved = 0;
        let taskReferencesReplaced = 0;

        recentHistory.forEach((msg, index) => {
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

            // Skip ALL error messages - these are for user display only, not AI context
            // Filter by error field OR error-related content (regardless of role)
            if (
                msg.error || // Has structured error
                msg.content.startsWith("Error:") || // Generic error message
                msg.content.startsWith("⚠️") || // Warning/error indicator
                msg.content.includes("AI Analysis Error") || // Analysis failure
                msg.content.includes("AI Query Parser Failed") || // Parser failure
                (apiRole === "system" && msg.content.includes("Failed")) // System failures
            ) {
                Logger.debug(
                    `[Chat History] Message ${index + 1}: Skipping error message (not sent to AI)`,
                );
                return; // Skip this message entirely
            }

            if (apiRole !== "system") {
                // Clean message content before sending to AI
                let cleanedContent = msg.content;
                const originalLength = cleanedContent.length;

                // Remove warning messages (they confuse AI about format requirements)
                // Type 1: Task reference fallback warning
                if (
                    cleanedContent.includes(
                        "AI Model May Have Failed to Reference Tasks Correctly",
                    )
                ) {
                    // Extract only the AI's actual response, removing the warning
                    const warningSeparator = "---\n\n";
                    const parts = cleanedContent.split(warningSeparator);
                    if (parts.length > 1) {
                        cleanedContent = parts[parts.length - 1].trim();
                        warningsRemoved++;
                        Logger.debug(
                            `[Chat History] Message ${index + 1}: Removed fallback warning (${originalLength} → ${cleanedContent.length} chars)`,
                        );
                    }
                }

                // Remove display task references (Task 1, **Task 2**, etc.)
                // These are display numbers, not internal [TASK_X] IDs, and could confuse AI
                // Handle both bold (**Task N**) and non-bold (Task N) since AI might make mistakes
                const taskRefMatches = cleanedContent.match(
                    /\*{0,2}Task \d+\*{0,2}/g,
                );
                if (taskRefMatches) {
                    taskReferencesReplaced += taskRefMatches.length;
                    cleanedContent = cleanedContent.replace(
                        /\*{0,2}Task \d+\*{0,2}/g,
                        "a task",
                    );
                }

                messages.push({
                    role: apiRole,
                    content: cleanedContent,
                });
            }
        });

        // Log summary of cleaning operations
        if (warningsRemoved > 0 || taskReferencesReplaced > 0) {
            Logger.debug(
                `[Chat History] Cleaned messages: ${warningsRemoved} warnings removed, ${taskReferencesReplaced} task references replaced`,
            );
        } else {
            Logger.debug(
                `[Chat History] All messages clean, no warnings or task references found`,
            );
        }

        // Add current user message
        messages.push({
            role: "user",
            content: userMessage,
        });

        return messages;
    }

    /**
     * Estimate token count from text
     * Rough approximation: 1 token ≈ 4 characters for English, ~1 token per character for Chinese
     */
    private static estimateTokenCount(text: string): number {
        if (!text) return 0;
        // Simple estimation: ~4 chars per token on average
        // This is a rough approximation but better than showing 0
        return Math.ceil(text.length / 4);
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
            Logger.warn(
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
        onStream?: (chunk: string) => void,
        abortSignal?: AbortSignal,
    ): Promise<{ response: string; tokenUsage: TokenUsage }> {
        // Use analysis model configuration for Task Chat responses
        const { provider, model, temperature } = getProviderForPurpose(
            settings,
            "analysis",
        );
        const providerConfig = getProviderConfigForPurpose(
            settings,
            "analysis",
        );
        const endpoint = providerConfig.apiEndpoint;

        // Check if streaming is enabled and callback is provided
        const useStreaming =
            settings.aiEnhancement.enableStreaming && onStream !== undefined;

        if (provider === "ollama") {
            return this.callOllama(
                messages,
                settings,
                onStream,
                abortSignal,
                useStreaming,
            );
        }

        if (provider === "anthropic") {
            return this.callAnthropic(
                messages,
                settings,
                onStream,
                abortSignal,
                useStreaming,
            );
        }

        // OpenAI-compatible API call (OpenAI and OpenRouter)
        if (useStreaming) {
            return this.callOpenAIWithStreaming(
                messages,
                settings,
                onStream,
                abortSignal,
            );
        }

        // Non-streaming fallback
        const apiKey = settings.providerConfigs[provider].apiKey;
        const response = await requestUrl({
            url: endpoint,
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                Authorization: `Bearer ${apiKey}`,
            },
            body: JSON.stringify({
                model: model,
                messages: messages,
                temperature: temperature,
                max_tokens: providerConfig.maxTokens,
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
                model,
                provider,
                settings.pricingCache.data,
            ),
            model: model,
            provider: provider,
            isEstimated: false,
            // Track analysis model separately
            analysisModel: model,
            analysisProvider: provider,
            analysisTokens: totalTokens,
            analysisCost: this.calculateCost(
                promptTokens,
                completionTokens,
                model,
                provider,
                settings.pricingCache.data,
            ),
        };

        return {
            response: content,
            tokenUsage,
        };
    }

    /**
     * Call OpenAI-compatible API with streaming support
     * Uses native Fetch API instead of requestUrl to support streaming
     */
    private static async callOpenAIWithStreaming(
        messages: any[],
        settings: PluginSettings,
        onStream: (chunk: string) => void,
        abortSignal?: AbortSignal,
    ): Promise<{ response: string; tokenUsage: TokenUsage }> {
        // Use analysis model configuration
        const { provider, model, temperature } = getProviderForPurpose(
            settings,
            "analysis",
        );
        const providerConfig = getProviderConfigForPurpose(
            settings,
            "analysis",
        );
        const endpoint = providerConfig.apiEndpoint;
        const apiKey = settings.providerConfigs[provider].apiKey;

        Logger.debug("Starting OpenAI streaming call...");

        try {
            // Use native Fetch API (supports streaming)
            const response = await fetch(endpoint, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    Authorization: `Bearer ${apiKey}`,
                },
                body: JSON.stringify({
                    model: model,
                    messages: messages,
                    stream: true,
                    stream_options: {
                        include_usage: true,
                    },
                    temperature: temperature,
                    max_tokens: providerConfig.maxTokens,
                }),
                signal: abortSignal,
            });

            if (!response.ok) {
                throw new Error(
                    `AI API error: ${response.status} ${response.statusText}`,
                );
            }

            if (!response.body) {
                throw new Error("Response body is null");
            }

            // Parse SSE stream
            const reader = response.body.getReader();
            let fullResponse = "";
            let tokenUsageInfo: StreamChunk["tokenUsage"] | undefined;

            for await (const chunk of StreamingService.parseSSE(
                reader,
                provider,
            )) {
                if (chunk.content) {
                    fullResponse += chunk.content;
                    onStream(chunk.content); // Stream to UI
                }

                // Capture token usage from stream (comes in final chunk)
                if (chunk.tokenUsage) {
                    tokenUsageInfo = chunk.tokenUsage;
                }

                if (chunk.done) break;
            }

            // Clean up reasoning tags
            const cleanedResponse = this.stripReasoningTags(fullResponse);

            // Use actual token counts if available, otherwise estimate
            let promptTokens: number;
            let completionTokens: number;
            let isEstimated: boolean;

            if (tokenUsageInfo) {
                // API provided token counts - use them
                promptTokens = tokenUsageInfo.promptTokens || 0;
                completionTokens = tokenUsageInfo.completionTokens || 0;
                isEstimated = false;
            } else {
                // API didn't provide token counts - estimate them
                // Estimate input tokens from messages
                let inputText = "";
                for (const msg of messages) {
                    if (typeof msg.content === "string") {
                        inputText += msg.content;
                    } else if (Array.isArray(msg.content)) {
                        for (const part of msg.content) {
                            if (part.type === "text") {
                                inputText += part.text;
                            }
                        }
                    }
                }
                promptTokens = this.estimateTokenCount(inputText);
                completionTokens = this.estimateTokenCount(cleanedResponse);
                isEstimated = true;
            }

            // Create token usage object
            const tokenUsage: TokenUsage = {
                promptTokens,
                completionTokens,
                totalTokens: promptTokens + completionTokens,
                estimatedCost: this.calculateCost(
                    promptTokens,
                    completionTokens,
                    model,
                    provider,
                    settings.pricingCache.data,
                ),
                model: model,
                provider: provider,
                isEstimated,
                // Track analysis model separately
                analysisModel: model,
                analysisProvider: provider,
                analysisTokens: promptTokens + completionTokens,
                analysisCost: this.calculateCost(
                    promptTokens,
                    completionTokens,
                    model,
                    provider,
                    settings.pricingCache.data,
                ),
            };

            Logger.debug("Streaming completed successfully");

            return {
                response: cleanedResponse,
                tokenUsage,
            };
        } catch (error: any) {
            // Handle abort errors gracefully
            if (error.name === "AbortError") {
                Logger.debug("Stream aborted by user");
                throw new Error("Request aborted");
            }

            Logger.error("Streaming error:", error);
            throw error;
        }
    }

    /**
     * Call Anthropic API (different format than OpenAI)
     */
    private static async callAnthropic(
        messages: any[],
        settings: PluginSettings,
        onStream?: (chunk: string) => void,
        abortSignal?: AbortSignal,
        useStreaming: boolean = false,
    ): Promise<{ response: string; tokenUsage: TokenUsage }> {
        // Use analysis model configuration
        const { provider, model, temperature } = getProviderForPurpose(
            settings,
            "analysis",
        );
        const providerConfig = getProviderConfigForPurpose(
            settings,
            "analysis",
        );
        const endpoint =
            providerConfig.apiEndpoint ||
            "https://api.anthropic.com/v1/messages";

        // Separate system message from conversation messages
        const systemMessage = messages.find((m: any) => m.role === "system");
        const conversationMessages = messages.filter(
            (m: any) => m.role !== "system",
        );

        const apiKey = this.getApiKeyForProvider(settings);

        // Use streaming if enabled
        if (useStreaming && onStream) {
            Logger.debug("Starting Anthropic streaming call...");

            try {
                const response = await fetch(endpoint, {
                    method: "POST",
                    headers: {
                        "Content-Type": "application/json",
                        "x-api-key": apiKey,
                        "anthropic-version": "2023-06-01",
                    },
                    body: JSON.stringify({
                        model: model,
                        messages: conversationMessages,
                        system: systemMessage?.content || "",
                        stream: true, // Enable streaming!
                        temperature: temperature,
                        max_tokens: providerConfig.maxTokens,
                    }),
                    signal: abortSignal,
                });

                if (!response.ok) {
                    throw new Error(
                        `Anthropic API error: ${response.status} ${response.statusText}`,
                    );
                }

                if (!response.body) {
                    throw new Error("Response body is null");
                }

                // Parse SSE stream
                const reader = response.body.getReader();
                let fullResponse = "";
                let tokenUsageInfo: StreamChunk["tokenUsage"] | undefined;

                for await (const chunk of StreamingService.parseSSE(
                    reader,
                    "anthropic",
                )) {
                    if (chunk.content) {
                        fullResponse += chunk.content;
                        onStream(chunk.content);
                    }

                    // Capture token usage from stream (comes in final chunk)
                    if (chunk.tokenUsage) {
                        tokenUsageInfo = chunk.tokenUsage;
                    }

                    if (chunk.done) break;
                }

                const cleanedResponse = this.stripReasoningTags(fullResponse);

                // Use actual token counts if available, otherwise estimate
                let promptTokens: number;
                let completionTokens: number;
                let isEstimated: boolean;

                if (tokenUsageInfo) {
                    // API provided token counts - use them
                    promptTokens = tokenUsageInfo.promptTokens || 0;
                    completionTokens = tokenUsageInfo.completionTokens || 0;
                    isEstimated = false;
                } else {
                    // API didn't provide token counts - estimate them
                    // For Anthropic, estimate from system message + conversation messages
                    let inputText = systemMessage?.content || "";
                    for (const msg of conversationMessages) {
                        if (typeof msg.content === "string") {
                            inputText += msg.content;
                        } else if (Array.isArray(msg.content)) {
                            for (const part of msg.content) {
                                if (part.type === "text") {
                                    inputText += part.text;
                                }
                            }
                        }
                    }
                    promptTokens = this.estimateTokenCount(inputText);
                    completionTokens = this.estimateTokenCount(cleanedResponse);
                    isEstimated = true;
                }

                const tokenUsage: TokenUsage = {
                    promptTokens,
                    completionTokens,
                    totalTokens: promptTokens + completionTokens,
                    estimatedCost: this.calculateCost(
                        promptTokens,
                        completionTokens,
                        providerConfig.model,
                        settings.aiProvider,
                        settings.pricingCache.data,
                    ),
                    model: providerConfig.model,
                    provider: "anthropic",
                    isEstimated,
                };

                Logger.debug("Anthropic streaming completed successfully");

                return {
                    response: cleanedResponse,
                    tokenUsage,
                };
            } catch (error: any) {
                if (error.name === "AbortError") {
                    Logger.debug("Anthropic stream aborted by user");
                    throw new Error("Request aborted");
                }

                Logger.error("Anthropic streaming error:", error);
                throw error;
            }
        }

        // Non-streaming fallback
        const response = await requestUrl({
            url: endpoint,
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                "x-api-key": apiKey,
                "anthropic-version": "2023-06-01",
            },
            body: JSON.stringify({
                model: model,
                messages: conversationMessages,
                system: systemMessage?.content || "",
                temperature: temperature, // User-configurable per purpose
                max_tokens: providerConfig.maxTokens, // User-configurable response length
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
                providerConfig.model,
                settings.aiProvider,
                settings.pricingCache.data,
            ),
            model: providerConfig.model,
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
     *
     * Ollama API format differs from OpenAI/OpenRouter:
     * - Parameters go inside 'options' object
     * - Uses 'num_predict' instead of 'max_tokens'
     * - Response has 'message' field directly (not 'choices')
     * - No built-in token counting (must estimate)
     */
    private static async callOllama(
        messages: any[],
        settings: PluginSettings,
        onStream?: (chunk: string) => void,
        abortSignal?: AbortSignal,
        useStreaming: boolean = false,
    ): Promise<{ response: string; tokenUsage: TokenUsage }> {
        // Use analysis model configuration
        const { provider, model, temperature } = getProviderForPurpose(
            settings,
            "analysis",
        );
        const providerConfig = getProviderConfigForPurpose(
            settings,
            "analysis",
        );
        const endpoint =
            providerConfig.apiEndpoint || "http://localhost:11434/api/chat";

        // Use streaming if enabled
        if (useStreaming && onStream) {
            Logger.debug("Starting Ollama streaming call...");

            try {
                const response = await fetch(endpoint, {
                    method: "POST",
                    headers: {
                        "Content-Type": "application/json",
                    },
                    body: JSON.stringify({
                        model: model,
                        messages: messages,
                        stream: true, // Enable streaming!
                        options: {
                            temperature: temperature,
                            num_predict: providerConfig.maxTokens,
                            num_ctx: providerConfig.contextWindow,
                        },
                    }),
                    signal: abortSignal,
                });

                if (!response.ok) {
                    const errorText = await response.text();
                    throw new Error(
                        `Ollama API error (${response.status}): ${errorText}. ` +
                            `Ensure Ollama is running and model '${model}' is available.`,
                    );
                }

                if (!response.body) {
                    throw new Error("Response body is null");
                }

                // Parse SSE stream
                const reader = response.body.getReader();
                let fullResponse = "";
                let tokenUsageInfo: StreamChunk["tokenUsage"] | undefined;

                for await (const chunk of StreamingService.parseSSE(
                    reader,
                    "ollama",
                )) {
                    if (chunk.content) {
                        fullResponse += chunk.content;
                        onStream(chunk.content);
                    }

                    if (chunk.tokenUsage) {
                        tokenUsageInfo = chunk.tokenUsage;
                    }

                    if (chunk.done) break;
                }

                const cleanedResponse = this.stripReasoningTags(fullResponse);

                // Use actual token counts if available, otherwise estimate
                const promptTokens =
                    tokenUsageInfo?.promptTokens ||
                    Math.round(JSON.stringify(messages).length / 4);
                const completionTokens =
                    tokenUsageInfo?.completionTokens ||
                    Math.round(cleanedResponse.length / 4);

                const tokenUsage: TokenUsage = {
                    promptTokens,
                    completionTokens,
                    totalTokens: promptTokens + completionTokens,
                    estimatedCost: 0, // Ollama is local, no cost
                    model: providerConfig.model,
                    provider: "ollama",
                    isEstimated: !tokenUsageInfo,
                };

                Logger.debug("Ollama streaming completed successfully");

                return {
                    response: cleanedResponse,
                    tokenUsage,
                };
            } catch (error: any) {
                if (error.name === "AbortError") {
                    Logger.debug("Ollama stream aborted by user");
                    throw new Error("Request aborted");
                }

                // Enhanced error handling
                const errorMsg = error.message || String(error);

                if (
                    errorMsg.includes("ECONNREFUSED") ||
                    errorMsg.includes("fetch failed")
                ) {
                    throw new Error(
                        `Cannot connect to Ollama at ${endpoint}. ` +
                            `Please ensure Ollama is running. Start it with: ollama serve`,
                    );
                }

                Logger.error("Ollama streaming error:", error);
                throw error;
            }
        }

        // Non-streaming fallback
        try {
            const response = await requestUrl({
                url: endpoint,
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                },
                body: JSON.stringify({
                    model: model,
                    messages: messages,
                    stream: false,
                    options: {
                        temperature: temperature, // User-configurable per purpose
                        num_predict: providerConfig.maxTokens, // User-configurable response length (Ollama parameter name)
                        num_ctx: providerConfig.contextWindow, // User-configurable context window (Ollama-specific)
                    },
                }),
            });

            if (response.status !== 200) {
                const errorMsg =
                    response.json?.error || response.text || "Unknown error";
                throw new Error(
                    `Ollama API error (${response.status}): ${errorMsg}. ` +
                        `Ensure Ollama is running and model '${providerConfig.model}' is available. ` +
                        `Try: ollama run ${providerConfig.model}`,
                );
            }

            const data = response.json;

            // Validate response structure
            if (!data || !data.message || !data.message.content) {
                throw new Error(
                    `Invalid Ollama response structure. Expected {message: {content: "..."}}, got: ${JSON.stringify(data)}`,
                );
            }

            const rawContent = data.message.content;

            // Clean up reasoning tags (important for DeepSeek-R1 via Ollama)
            const content = this.stripReasoningTags(rawContent);

            // Ollama doesn't provide token counts in response, estimate based on content
            // Use data from response if available (some models may provide it)
            const promptTokens =
                data.prompt_eval_count ||
                Math.round(JSON.stringify(messages).length / 4);
            const completionTokens =
                data.eval_count || Math.round(content.length / 4);

            const tokenUsage: TokenUsage = {
                promptTokens,
                completionTokens,
                totalTokens: promptTokens + completionTokens,
                estimatedCost: 0, // Ollama is local, no cost
                model: providerConfig.model,
                provider: "ollama",
                isEstimated: !data.eval_count, // Estimated unless model provides counts
            };

            Logger.debug(
                `[Ollama] Response received: ${content.length} chars, ` +
                    `${completionTokens} tokens (${tokenUsage.isEstimated ? "estimated" : "actual"})`,
            );

            return {
                response: content,
                tokenUsage,
            };
        } catch (error) {
            // Enhanced error handling for common Ollama issues
            const errorMsg = error.message || String(error);

            if (
                errorMsg.includes("ECONNREFUSED") ||
                errorMsg.includes("fetch")
            ) {
                throw new Error(
                    `Cannot connect to Ollama at ${endpoint}. ` +
                        `Please ensure Ollama is running. Start it with: ollama serve`,
                );
            }

            if (errorMsg.includes("model") || errorMsg.includes("not found")) {
                throw new Error(
                    `Model '${providerConfig.model}' not found in Ollama. ` +
                        `Install it with: ollama pull ${providerConfig.model}`,
                );
            }

            // Re-throw with context
            throw new Error(`Ollama API call failed: ${errorMsg}`);
        }
    }

    /**
     * Extract recommended tasks from AI response using task IDs
     * @returns Object containing recommended tasks, their original indices, and fallback flag
     */
    private static extractRecommendedTasks(
        response: string,
        tasks: Task[],
        settings: PluginSettings,
        keywords: string[],
        coreKeywords: string[],
        queryHasDueDate: boolean,
        queryHasPriority: boolean,
        queryHasStatus: boolean,
        sortCriteria: SortCriterion[],
        usingAIParsing: boolean,
    ): { tasks: Task[]; indices: number[]; usedFallback: boolean } {
        const recommended: Task[] = [];
        const recommendedIndices: number[] = [];

        Logger.debug(
            `Extracting recommended tasks from ${tasks.length} available tasks`,
        );
        Logger.debug(
            "Available tasks:",
            tasks.map((t, i) => `[${i}]: ${t.text}`),
        );

        // Extract [TASK_X] references from response, preserving order
        const taskIdPattern = /\[TASK_(\d+)\]/g;
        const matches = Array.from(response.matchAll(taskIdPattern)); // Convert to array to count total attempts
        const totalAttempts = matches.length; // Count ALL task reference attempts (including invalid)

        const referencedIndices: number[] = []; // Array to preserve order
        const seenIndices = new Set<number>(); // Set to track uniqueness

        for (const match of matches) {
            const index = parseInt(match[1]);
            // Convert from 1-based to 0-based indexing
            const taskIndex = index - 1;

            if (taskIndex >= 0 && taskIndex < tasks.length) {
                // Only add if not already seen (avoid duplicates)
                if (!seenIndices.has(taskIndex)) {
                    Logger.debug(
                        `Found reference: [TASK_${index}] -> array index ${taskIndex}: "${tasks[taskIndex].text}"`,
                    );
                    referencedIndices.push(taskIndex);
                    seenIndices.add(taskIndex);
                }
            } else {
                Logger.warn(
                    `Invalid task reference [TASK_${index}] - out of bounds (have ${tasks.length} tasks)`,
                );
            }
        }

        Logger.debug(
            `Found ${referencedIndices.length} unique task references in order`,
        );

        // Add tasks in the exact order they were mentioned in the AI response
        referencedIndices.forEach((index) => {
            recommended.push(tasks[index]);
            recommendedIndices.push(index); // Track original indices
        });

        // If no valid task IDs were found, use fallback: return top relevant tasks
        if (recommended.length === 0) {
            // Only show warning if AI ATTEMPTED to reference tasks but used invalid IDs
            // Don't show warning if AI simply didn't reference any tasks (e.g., said "no matching tasks")
            const shouldShowWarning = totalAttempts > 0;

            if (shouldShowWarning) {
                Logger.warn(
                    "⚠️⚠️⚠️ FALLBACK TRIGGERED: AI used INVALID [TASK_X] references! ⚠️⚠️⚠️",
                );
                Logger.warn(
                    `REASON: AI attempted ${totalAttempts} task references but ALL were invalid (out of bounds)`,
                );
                Logger.warn(
                    "IMPACT: AI summary references tasks that don't exist. Task list shows fallback (relevance-scored) tasks.",
                );
            } else {
                Logger.debug(
                    "ℹ️ AI did not reference any tasks (said 'no matching tasks' or similar)",
                );
                Logger.debug(
                    "This is AI's content decision, not a format error. Using fallback to show top relevant tasks anyway.",
                );
            }

            Logger.warn("=== FALLBACK DEBUGGING INFO ===");
            Logger.warn(`Total [TASK_X] attempts: ${totalAttempts} | Valid: 0`);
            Logger.warn(`AI response length: ${response.length} characters`);
            Logger.warn(
                `AI response preview (first 500 chars):\n${response.substring(0, 500)}`,
            );
            Logger.warn(
                `AI response preview (last 500 chars):\n${response.substring(Math.max(0, response.length - 500))}`,
            );
            Logger.warn(
                `Available tasks to reference: ${tasks.length} (TASK_1 to TASK_${tasks.length})`,
            );
            Logger.warn("Expected format: [TASK_1], [TASK_2], [TASK_3], etc.");
            Logger.warn("===============================");

            // Use relevance scoring as fallback - return top N most relevant tasks based on user settings
            // All modes use comprehensive scoring (with or without expansion)
            let scoredTasks;
            const queryHasKeywords = keywords.length > 0;
            if (usingAIParsing && coreKeywords.length > 0) {
                Logger.debug(
                    `Fallback: Using comprehensive scoring with expansion (core: ${coreKeywords.length})`,
                );
                scoredTasks = TaskSearchService.scoreTasksComprehensive(
                    tasks,
                    keywords,
                    coreKeywords,
                    queryHasKeywords,
                    queryHasDueDate,
                    queryHasPriority,
                    queryHasStatus,
                    sortCriteria,
                    settings.relevanceCoefficient,
                    settings.dueDateCoefficient,
                    settings.priorityCoefficient,
                    settings.statusCoefficient,
                    settings,
                );
            } else {
                Logger.debug(
                    `Fallback: Using comprehensive scoring without expansion`,
                );
                scoredTasks = TaskSearchService.scoreTasksComprehensive(
                    tasks,
                    keywords,
                    keywords,
                    queryHasKeywords,
                    queryHasDueDate,
                    queryHasPriority,
                    queryHasStatus,
                    sortCriteria,
                    settings.relevanceCoefficient,
                    settings.dueDateCoefficient,
                    settings.priorityCoefficient,
                    settings.statusCoefficient,
                    settings,
                );
            }

            const topTasks = scoredTasks
                .slice(0, settings.maxRecommendations)
                .map((st) => st.task);
            const topIndices = Array.from(
                { length: topTasks.length },
                (_, i) => i,
            );

            Logger.debug(
                `Fallback: returning top ${topTasks.length} tasks by relevance (user limit: ${settings.maxRecommendations})`,
            );
            return {
                tasks: topTasks,
                indices: topIndices,
                usedFallback: shouldShowWarning,
            };
        }

        Logger.debug(`✅✅✅ SUCCESS: AI used correct [TASK_X] format! ✅✅✅`);
        Logger.debug(
            `Found ${recommended.length} task references in AI response`,
        );
        Logger.debug(
            `Task IDs referenced by AI: [TASK_${referencedIndices.map((i) => i + 1).join("], [TASK_")}]`,
        );
        Logger.debug(
            `These will display as: Task 1, Task 2, Task 3... (in order mentioned)`,
        );

        // Trust the AI's judgment on how many tasks to recommend
        // The prompt emphasizes comprehensive recommendations, so if AI selects fewer tasks,
        // it means the others aren't relevant enough to include

        // Limit final recommendations to user preference
        const finalRecommended = recommended.slice(
            0,
            settings.maxRecommendations,
        );
        const finalIndices = recommendedIndices.slice(
            0,
            settings.maxRecommendations,
        );
        Logger.debug(
            `Returning ${finalRecommended.length} recommended tasks (user limit: ${settings.maxRecommendations}):`,
        );
        finalRecommended.forEach((task, i) => {
            Logger.debug(`  Recommended [${i + 1}]: ${task.text}`);
        });
        return {
            tasks: finalRecommended,
            indices: finalIndices,
            usedFallback: false,
        };
    }

    /**
     * Replace [TASK_X] references in the response with actual task numbers
     * from the recommended list
     *
     * This ensures AI summary references ("**Task 1**", "**Task 2**") match the visual
     * numbering users see in the recommended tasks list (1, 2, 3...)
     *
     * @param response The AI response containing [TASK_X] references
     * @param recommendedIndices The original indices of recommended tasks in allTasks array
     */
    private static replaceTaskReferences(
        response: string,
        recommendedIndices: number[],
    ): string {
        // Build a map of task ID (1-based) to display position (1-based)
        // Using original indices avoids issues with duplicate tasks
        const taskIdToPosition = new Map<number, number>();

        recommendedIndices.forEach((originalIndex, displayPosition) => {
            // Map from 1-based task ID to 1-based display position
            const taskId = originalIndex + 1;
            const position = displayPosition + 1;
            taskIdToPosition.set(taskId, position);
        });

        Logger.debug(
            `Task ID to position mapping:`,
            Array.from(taskIdToPosition.entries()).map(
                ([id, pos]) => `[TASK_${id}] -> **Task ${pos}**`,
            ),
        );

        // Replace all [TASK_X] references with "**Task N**" where N is the position
        let processedResponse = response;
        const taskIdPattern = /\[TASK_(\d+)\]/g;

        processedResponse = processedResponse.replace(
            taskIdPattern,
            (match, idStr) => {
                const taskId = parseInt(idStr);
                const position = taskIdToPosition.get(taskId);

                if (position !== undefined) {
                    Logger.debug(
                        `Replacing ${match} with "**Task ${position}**"`,
                    );
                    return `**Task ${position}**`;
                } else {
                    // Task was referenced but not in recommended list (shouldn't happen)
                    Logger.warn(
                        `Task ID ${taskId} not found in recommended list`,
                    );
                    return match; // Keep original reference
                }
            },
        );

        Logger.debug(`Processed response:`, processedResponse);
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
        return getCurrentProviderConfig(settings).apiKey || "";
    }
}
