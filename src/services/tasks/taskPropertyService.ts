import { moment } from "obsidian";
import { Task, TaskStatusCategory, DateRange } from "../../models/task";
import { PluginSettings } from "../../settings";
import * as chrono from "chrono-node";
import { Logger } from "../../utils/logger";

/**
 * Task source type for unified field extraction
 * Distinguishes between Dataview and Datacore APIs
 */
export type TaskSource = "dataview" | "datacore";

/**
 * Centralized Task Property Service
 *
 * This service consolidates ALL task property operations (status, priority, due date)
 * that were previously duplicated across multiple services:
 * - DataviewService
 * - TaskSearchService
 * - TaskSortService
 * - PromptBuilderService
 * - PropertyRecognitionService
 * - TaskFilterService
 *
 * Key Principles:
 * 1. Single source of truth for each operation
 * 2. Always respect user settings (taskStatusMapping, dataviewPriorityMapping, etc.)
 * 3. Provide both simple and advanced APIs
 * 4. Maintain backward compatibility
 *
 * Architecture:
 * - Status: Mapping, comparison, extraction, inference
 * - Priority: Mapping, comparison, extraction
 * - Date: Parsing, formatting, comparison, filtering
 * - Combined: Multi-property operations
 *
 * ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 * CRITICAL: Property Recognition vs Keyword Expansion
 * ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 *
 * This service provides term lists (BASE_PRIORITY_TERMS, BASE_STATUS_TERMS, etc.)
 * that are used in AI prompts. It's CRITICAL to understand how these should be used:
 *
 * ⚠️ PROPERTIES: Direct Concept Recognition (NO Expansion)
 * ════════════════════════════════════════════════════════════
 * - Use AI's native multilingual understanding to recognize CONCEPTS
 * - Convert directly to category keys (e.g., "inProgress", 1, "overdue")
 * - Term lists are REFERENCE EXAMPLES, not exhaustive requirements
 * - AI should recognize property concepts in ANY language, not just listed terms
 *
 * How it works:
 * 1. AI reads query in ANY language (English, 中文, Svenska, Français, etc.)
 * 2. AI recognizes CONCEPT semantically:
 *    - PRIORITY concept = urgency, importance, criticality
 *    - STATUS concept = task state, progress, completion level
 *    - DUE_DATE concept = deadline, timing, target date
 * 3. AI converts concept DIRECTLY to Dataview format:
 *    - PRIORITY → 1, 2, 3, or 4 (numbers)
 *    - STATUS → "open", "inProgress", "completed", etc. (category keys)
 *    - DUE_DATE → "today", "overdue", "next-week", etc. (time keywords)
 * 4. NO semantic expansion - just direct conversion
 *
 * Examples of direct concept recognition:
 * - "作業進行中" (Japanese - work in progress) → Recognize STATUS → status: "inProgress"
 * - "vence hoy" (Spanish - due today) → Recognize DUE_DATE → dueDate: "today"
 *
 * ⚠️ KEYWORDS: Semantic Expansion (YES Expansion)
 * ════════════════════════════════════════════════════════════
 * - Generate semantic equivalents across ALL configured languages
 * - Expand EACH keyword independently for better matching
 * - Use translation + synonyms + context-appropriate variants
 *
 * How it works:
 * 1. Extract content keywords from query (after removing property terms)
 * 2. For EACH keyword, generate semantic equivalents in ALL languages
 * 3. Include synonyms, related terms, alternative phrases
 * 4. Result: Expanded keyword array for better task matching
 *
 * Examples of semantic expansion:
 * - "bug" → ["bug", "error", "issue", "defect", "错误", "问题", "bugg", "fel", ...]
 * - "fix" → ["fix", "repair", "solve", "correct", "修复", "解决", "fixa", "lösa", ...]
 *
 * ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 * Why This Distinction Matters
 * ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 *
 * Properties need PRECISION:
 * - "urgent" must map to priority: 1 (not expanded to synonyms)
 * - "in progress" must map to status: "inProgress" (not expanded)
 * - Expansion would pollute structured filters with irrelevant variations
 *
 * Keywords need RECALL:
 * - "bug" should match "error", "issue", "defect", etc. in tasks
 * - Expansion increases chance of finding relevant tasks
 * - Works across languages automatically
 *
 * Term Lists in This Service:
 * - BASE_PRIORITY_TERMS, BASE_DUE_DATE_TERMS, BASE_STATUS_TERMS
 * - These provide REFERENCE EXAMPLES for AI prompts
 * - NOT exhaustive lists - AI should recognize beyond these
 * - Combined with user-configured terms via getCombined*Terms() methods
 *
 * Usage in AI Prompts:
 * - Show term lists as EXAMPLES of what concepts look like
 * - Emphasize that AI should recognize concepts in ANY language
 * - Make clear that term lists are HINTS, not REQUIREMENTS
 * - Trust AI's native multilingual understanding
 *
 * ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 */
export class TaskPropertyService {
    // ==========================================
    // STATUS OPERATIONS
    // ==========================================

    /**
     * Default configurations for built-in status categories
     * Used when user hasn't explicitly configured order/description/terms
     * Based on category KEY (stable), not display name (user-defined)
     */
    private static readonly DEFAULT_STATUS_CONFIG: Record<
        string,
        { order: number; description: string; terms: string }
    > = {
        open: {
            order: 1,
            description: "Tasks not yet started or awaiting action",
            terms: "open, todo, new, unstarted, incomplete, not started, to do, 待办, 未完成, öppen",
        },
        inProgress: {
            order: 2,
            description: "Tasks currently being worked on",
            terms: "inprogress, in-progress, wip, working, ongoing, current, 进行中, 正在做, pågående",
        },
        completed: {
            order: 6,
            description: "Tasks that have been finished",
            terms: "completed, done, finished, closed, resolved, complete, 完成, 已完成, klar, färdig",
        },
        cancelled: {
            order: 7,
            description: "Tasks that were abandoned or cancelled",
            terms: "cancelled, canceled, abandoned, dropped, discarded, rejected, 取消, 已取消, avbruten",
        },
    };

    // ==========================================
    // CENTRALIZED CONSTANTS
    // ==========================================

    /**
     * Standard date field names (Dataview compatible)
     * Used across dataviewService, taskFilterService, propertyDetectionService, aiPropertyPromptService
     */
    static readonly DATE_FIELDS = {
        due: ["due", "dueDate", "deadline"],
        completion: ["completion", "completed", "completedDate"],
        created: ["created", "createdDate"],
        start: ["start", "startDate"],
        scheduled: ["scheduled", "scheduledDate"],
    } as const;

    /**
     * Date field emoji patterns for extraction
     * Used in dataviewService for extracting dates from task text
     */
    static readonly DATE_EMOJI_PATTERNS = {
        due: /🗓️\s*(\d{4}-\d{2}-\d{2})/,
        completion: /✅\s*(\d{4}-\d{2}-\d{2})/,
        created: /➕\s*(\d{4}-\d{2}-\d{2})/,
        start: /🛫\s*(\d{4}-\d{2}-\d{2})/,
        scheduled: /⏳\s*(\d{4}-\d{2}-\d{2})/,
    } as const;

    /**
     * Priority field names
     * Used across multiple services for priority extraction
     */
    static readonly PRIORITY_FIELDS = {
        primary: "priority",
        aliases: ["p", "pri", "prio"],
    } as const;

    /**
     * Base priority terms (English, Chinese, Swedish)
     * These are COMBINED with user's configured terms via getCombinedPriorityTerms()
     */
    private static readonly BASE_PRIORITY_TERMS = {
        general: [
            "priority",
            "urgent",
            "优先级",
            "优先",
            "紧急",
            "prioritet",
            "viktig",
            "brådskande",
        ],
        high: [
            "high",
            "highest",
            "top",
            "高",
            "最高",
            "hög",
            "högst",
            "kritisk",
        ],
        medium: ["medium", "normal", "中", "中等", "普通", "medel", "normal"],
        low: ["low", "minor", "低", "次要", "låg", "mindre"],
    } as const;

    /**
     * Base due date terms (English, Chinese, Swedish)
     * These are COMBINED with user's configured terms via getCombinedDueDateTerms()
     */
    private static readonly BASE_DUE_DATE_TERMS = {
        general: [
            "due",
            "deadline",
            "截止日期",
            "到期",
            "期限",
            "förfallodatum",
        ],
        today: ["today", "今天", "今日", "idag"],
        tomorrow: ["tomorrow", "明天", "imorgon"],
        overdue: [
            "overdue",
            "late",
            "past due",
            "过期",
            "逾期",
            "延迟",
            "försenad",
            "sen",
        ],
        thisWeek: ["this week", "本周", "这周", "denna vecka"],
        nextWeek: ["next week", "下周", "nästa vecka"],
        thisMonth: ["this month", "本月", "这月", "denna månad"],
        nextMonth: ["next month", "下月", "nästa månad"],
        future: [
            "future",
            "upcoming",
            "later",
            "未来",
            "将来",
            "以后",
            "framtida",
            "kommande",
        ],
    } as const;

    /**
     * Base status terms (English, Chinese, Swedish)
     * Note: For status, we also have user's custom categories with their own terms!
     */
    private static readonly BASE_STATUS_TERMS = {
        general: ["status", "progress", "状态", "进度", "情况", "tillstånd"],
        open: [
            "open",
            "todo",
            "incomplete",
            "new",
            "unstarted",
            "未完成",
            "待办",
            "待处理",
            "新建",
            "öppen",
            "väntande",
            "att göra",
        ],
        inProgress: [
            "in progress",
            "working",
            "ongoing",
            "active",
            "doing",
            "进行中",
            "正在做",
            "处理中",
            "进行",
            "pågående",
            "arbetar på",
            "aktiv",
        ],
        completed: [
            "done",
            "completed",
            "finished",
            "closed",
            "resolved",
            "完成",
            "已完成",
            "结束",
            "已结束",
            "klar",
            "färdig",
            "slutförd",
            "stängd",
        ],
        cancelled: [
            "cancelled",
            "canceled",
            "abandoned",
            "dropped",
            "discarded",
            "取消",
            "已取消",
            "放弃",
            "废弃",
            "avbruten",
            "inställd",
            "övergjven",
        ],
    } as const;

    /**
     * Regex patterns for query syntax recognition
     * Used in queryParserService and taskSearchService
     */
    static readonly QUERY_PATTERNS = {
        // Priority patterns (unified syntax)
        priority: /\bp([1-4])\b/gi, // Legacy: p1, p2, p3, p4 (with capture group for the number)
        priorityUnified: /\b(?:p|priority):([^\s&|]+)/gi, // New: p:1,2,3 or priority:1,2,3 or p:all or priority:none

        // Status patterns (already unified, supports multi-value)
        status: /\b(?:s|status):([^\s&|]+)/gi, // Supports both s: and status: syntax with comma-separated values

        // Due date patterns (unified syntax, supports multi-value)
        dueUnified: /\b(?:d|due):([^\s&|]+)/gi, // New: d:today, due:all, d:none, d:2025-01-22, etc. (allows commas)
        dueBeforeRange: /due\s+before:\s*[^&|]+/gi,
        dueAfterRange: /due\s+after:\s*[^&|]+/gi,
        dateBeforeRange: /(?<!due\s)date\s+before:\s*[^&|]+/gi,
        dateAfterRange: /(?<!due\s)date\s+after:\s*[^&|]+/gi,

        // Other patterns
        project: /##+[A-Za-z0-9_-]+/g,
        search: /search:\s*["']?[^"'&|]+["']?/gi,
        hashtag: /#([\w-]+)/g,
        folder: /(?:(?:in|from|under)\s+)?(?:folder|directory)[:\s]+["']?[^"'\s,&|]+["']?/gi,
        operators: /[&|!]/g,

        // Note: dueDateKeywords is dynamically generated from BASE_DUE_DATE_TERMS
        // See getDueDateKeywordsPattern() method below
        specialKeywordOverdue: /\b(overdue|over\s+due|od)\b/gi,
        specialKeywordRecurring: /\brecurring\b/gi,
        specialKeywordSubtask: /\bsubtask\b/gi,
        specialKeywordNoDate: /\bno\s+date\b/gi,
        specialKeywordNoPriority: /\bno\s+priority\b/gi,
    } as const;

    /**
     * Dynamically generate due date keywords regex pattern from BASE_DUE_DATE_TERMS
     * This ensures consistency between regex-based and array-based property recognition
     * Supports multilingual terms (English, Chinese, Swedish)
     */
    static getDueDateKeywordsPattern(): RegExp {
        // Collect all due date terms from BASE_DUE_DATE_TERMS
        const allTerms: string[] = [];

        for (const category of Object.values(this.BASE_DUE_DATE_TERMS)) {
            allTerms.push(...category);
        }

        // Remove duplicates and escape special regex characters
        const uniqueTerms = [...new Set(allTerms)].map((term) =>
            term.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"),
        );

        // Sort by length (longest first) to match "this week" before "this"
        uniqueTerms.sort((a, b) => b.length - a.length);

        // Build regex pattern
        const pattern = uniqueTerms.join("|");
        return new RegExp(`\\b(${pattern})\\b`, "gi");
    }

    /**
     * Special keywords recognized in queries
     */
    static readonly SPECIAL_KEYWORDS = [
        "overdue",
        "over due",
        "od",
        "recurring",
        "subtask",
        "no date",
        "no priority",
    ] as const;

    /**
     * Valid special keywords for validation (normalized format)
     * Used to validate special keywords from query parsing
     */
    static readonly VALID_SPECIAL_KEYWORDS = [
        "overdue",
        "recurring",
        "subtask",
        "no_date",
        "has_date",
        "no_priority",
    ] as const;

    /**
     * Date extraction patterns for identifying specific dates in queries
     * Used in date range extraction and date filter detection
     */
    static readonly DATE_PATTERNS = {
        // ISO format: YYYY-MM-DD
        iso: /\b(\d{4}-\d{2}-\d{2})\b/,
        // US format: MM/DD/YYYY
        us: /\b(\d{2}\/\d{2}\/\d{4})\b/,
        // International format: YYYY/MM/DD
        international: /\b(\d{4}\/\d{2}\/\d{2})\b/,
        // Date range: "before YYYY-MM-DD"
        before: /(?:date\s+)?before[:\s]+(\d{4}-\d{2}-\d{2})/,
        // Date range: "after YYYY-MM-DD"
        after: /(?:date\s+)?after[:\s]+(\d{4}-\d{2}-\d{2})/,
        // Date range: "from YYYY-MM-DD to YYYY-MM-DD"
        between: /from\s+(\d{4}-\d{2}-\d{2})\s+to\s+(\d{4}-\d{2}-\d{2})/,
        // Relative date: "in 5 days", "in 2 weeks"
        relative: /\bin\s+(\d+)\s+(day|days|week|weeks|month|months)\b/i,
    } as const;

    /**
     * Search action keywords (multilingual)
     * Used to identify if query is asking for search/find action
     */
    static readonly SEARCH_KEYWORDS = [
        // English
        "find",
        "search",
        "look",
        "show",
        "list",
        "get",
        "where",
        // Chinese
        "找",
        "查找",
        "搜索",
        "显示",
        "列出",
        "哪里",
        "在哪",
    ] as const;

    /**
     * Priority emoji mappings (Tasks plugin format)
     * Maps emoji symbols to priority levels
     */
    static readonly PRIORITY_EMOJI_MAP = {
        "⏫": 1, // high priority
        "🔼": 2, // medium priority
        "🔽": 3, // low priority
        "⏬": 3, // low priority (alternative)
    } as const;

    /**
     * Due date filter keywords (special filters)
     * Used for filtering by presence/absence of due dates
     */
    static readonly DUE_DATE_FILTER_KEYWORDS = {
        all: "all", // Has any due date (alias for "any")
        any: "any", // Has any due date
        none: "none", // No due date
    } as const;

    /**
     * Due date time keywords (time-based filters)
     * Used for filtering by specific time periods
     */
    static readonly DUE_DATE_TIME_KEYWORDS = {
        today: "today", // Due today
        tomorrow: "tomorrow", // Due tomorrow
        yesterday: "yesterday", // Due yesterday
        overdue: "overdue", // Past due
        future: "future", // Future dates
        week: "week", // This week
        lastWeek: "last-week", // Last week
        nextWeek: "next-week", // Next week
        month: "month", // This month
        lastMonth: "last-month", // Last month
        nextMonth: "next-month", // Next month
        year: "year", // This year
        lastYear: "last-year", // Last year
        nextYear: "next-year", // Next year
    } as const;

    /**
     * Combined due date keywords (all filters + time keywords)
     * Used for comprehensive due date filtering
     * Provides backward compatibility and convenient access to all keywords
     */
    static readonly DUE_DATE_KEYWORDS = {
        ...this.DUE_DATE_FILTER_KEYWORDS,
        ...this.DUE_DATE_TIME_KEYWORDS,
    } as const;

    /**
     * Date range keywords for relative dates
     * Used in date range parsing (week-start, month-end, etc.)
     */
    static readonly DATE_RANGE_KEYWORDS = {
        weekStart: "week-start",
        weekEnd: "week-end",
        lastWeekStart: "last-week-start",
        lastWeekEnd: "last-week-end",
        nextWeekStart: "next-week-start",
        nextWeekEnd: "next-week-end",
        monthStart: "month-start",
        monthEnd: "month-end",
        lastMonthStart: "last-month-start",
        lastMonthEnd: "last-month-end",
        nextMonthStart: "next-month-start",
        nextMonthEnd: "next-month-end",
        yearStart: "year-start",
        yearEnd: "year-end",
        lastYearStart: "last-year-start",
        lastYearEnd: "last-year-end",
        nextYearStart: "next-year-start",
        nextYearEnd: "next-year-end",
    } as const;

    /**
     * Completion status filter values
     * Used in task filtering by completion status
     */
    static readonly COMPLETION_STATUS = {
        all: "all",
        completed: "completed",
        incomplete: "incomplete",
    } as const;

    /**
     * Status category values
     * Standard task status categories
     */
    static readonly STATUS_CATEGORY = {
        completed: "completed",
        open: "open",
        inProgress: "inProgress",
        cancelled: "cancelled",
    } as const;

    /**
     * Priority value constants
     * Used for priority representation
     */
    static readonly PRIORITY_VALUES = {
        none: "none", // String representation for undefined/no priority
        p1: "1", // High priority
        p2: "2", // Medium-high priority
        p3: "3", // Medium-low priority
        p4: "4", // Low priority
    } as const;

    /**
     * Priority filter keywords
     * Used for special priority filtering (all, none)
     */
    /**
     * Priority filter keywords (special filters)
     * Used for filtering by presence/absence of priority
     *
     * Semantic clarification:
     * - "all" and "any" are synonyms (tasks that HAVE a priority assigned)
     * - A task can only have ONE priority at a time, so "all" means "has any priority value"
     * - "none" means tasks WITHOUT a priority
     */
    static readonly PRIORITY_FILTER_KEYWORDS = {
        all: "all", // Has any priority (P1-P4) - synonym for "any"
        any: "any", // Has any priority (P1-P4) - synonym for "all"
        none: "none", // No priority
    } as const;

    // ==========================================
    // COMBINED TERM METHODS (Base + User Settings)
    // ==========================================

    /**
     * Get combined priority terms (base + user-configured)
     * Used in property recognition and AI prompts
     *
     * @param settings - Plugin settings with user-configured terms
     * @returns Combined priority terms across all categories
     */
    static getCombinedPriorityTerms(settings: PluginSettings): {
        general: string[];
        high: string[];
        medium: string[];
        low: string[];
    } {
        return {
            general: [
                ...this.BASE_PRIORITY_TERMS.general,
                ...settings.userPropertyTerms.priority,
            ],
            high: [...this.BASE_PRIORITY_TERMS.high],
            medium: [...this.BASE_PRIORITY_TERMS.medium],
            low: [...this.BASE_PRIORITY_TERMS.low],
        };
    }

    /**
     * Get combined due date terms (base + user-configured)
     * Used in property recognition and AI prompts
     *
     * @param settings - Plugin settings with user-configured terms
     * @returns Combined due date terms across all time periods
     */
    static getCombinedDueDateTerms(settings: PluginSettings): {
        general: string[];
        today: string[];
        tomorrow: string[];
        overdue: string[];
        thisWeek: string[];
        nextWeek: string[];
        future: string[];
    } {
        return {
            general: [
                ...this.BASE_DUE_DATE_TERMS.general,
                ...settings.userPropertyTerms.dueDate,
            ],
            today: [...this.BASE_DUE_DATE_TERMS.today],
            tomorrow: [...this.BASE_DUE_DATE_TERMS.tomorrow],
            overdue: [...this.BASE_DUE_DATE_TERMS.overdue],
            thisWeek: [...this.BASE_DUE_DATE_TERMS.thisWeek],
            nextWeek: [...this.BASE_DUE_DATE_TERMS.nextWeek],
            future: [...this.BASE_DUE_DATE_TERMS.future],
        };
    }

    /**
     * Get combined status terms (base + user-configured + category terms)
     * Used in property recognition and AI prompts
     *
     * @param settings - Plugin settings with user-configured terms and status categories
     * @returns Combined status terms including all custom categories
     */
    static getCombinedStatusTerms(settings: PluginSettings): {
        general: string[];
        [categoryKey: string]: string[];
    } {
        const result: { general: string[]; [key: string]: string[] } = {
            general: [
                ...this.BASE_STATUS_TERMS.general,
                ...settings.userPropertyTerms.status,
            ],
        };

        // Add base terms for default categories (if they exist in BASE_STATUS_TERMS)
        const baseCategories = Object.keys(this.BASE_STATUS_TERMS).filter(
            (key) => key !== "general",
        ) as Array<keyof typeof this.BASE_STATUS_TERMS>;

        for (const categoryKey of baseCategories) {
            if (this.BASE_STATUS_TERMS[categoryKey]) {
                result[categoryKey] = [...this.BASE_STATUS_TERMS[categoryKey]];
            }
        }

        // Add terms from user-defined status categories in taskStatusMapping
        for (const [categoryKey, config] of Object.entries(
            settings.taskStatusMapping,
        )) {
            if (config) {
                // Get inferred terms for this category
                const inferredTerms = this.inferStatusTerms(
                    categoryKey,
                    settings,
                ).split(", ");

                // Combine with existing base terms (if any) and remove duplicates
                if (result[categoryKey]) {
                    result[categoryKey] = [
                        ...result[categoryKey],
                        ...inferredTerms.filter(
                            (term) => !result[categoryKey].includes(term),
                        ),
                    ];
                } else {
                    result[categoryKey] = inferredTerms;
                }

                // Add display name as a recognizable term if not already present
                if (config.displayName) {
                    const displayNameLower = config.displayName.toLowerCase();
                    if (!result[categoryKey].includes(displayNameLower)) {
                        result[categoryKey].push(displayNameLower);
                    }
                }

                // Add category key as term if not already present
                const categoryKeyLower = categoryKey.toLowerCase();
                if (!result[categoryKey].includes(categoryKeyLower)) {
                    result[categoryKey].push(categoryKeyLower);
                }
            }
        }

        return result;
    }

    /**
     * Get all priority field names to check
     * Combines primary field + aliases + user's configured Dataview key
     *
     * @param settings - Plugin settings
     * @returns Array of field names to check for priority
     */
    static getAllPriorityFieldNames(settings: PluginSettings): string[] {
        return [
            settings.dataviewKeys.priority,
            this.PRIORITY_FIELDS.primary,
            ...this.PRIORITY_FIELDS.aliases,
        ];
    }

    /**
     * Get all due date field names to check
     * Returns user's configured Dataview key + standard aliases
     *
     * @param settings - Plugin settings
     * @returns Array of field names to check for due dates
     */
    static getAllDueDateFieldNames(settings: PluginSettings): string[] {
        return [settings.dataviewKeys.dueDate, ...this.DATE_FIELDS.due];
    }

    /**
     * Map a Dataview task status symbol to status category
     * Uses user's configured taskStatusMapping
     *
     * @param symbol - Task status symbol (e.g., "x", "/", "?", " ")
     * @param settings - Plugin settings with taskStatusMapping
     * @returns Status category key (e.g., "completed", "inProgress", "open")
     */
    static mapStatusToCategory(
        symbol: string | undefined,
        settings: PluginSettings,
    ): TaskStatusCategory {
        if (!symbol) return "open";

        const cleanSymbol = symbol.replace(/[\[\]]/g, "").trim();

        // Check user's configured status mapping
        for (const [category, config] of Object.entries(
            settings.taskStatusMapping,
        )) {
            if (config && Array.isArray(config.symbols)) {
                if (config.symbols.some((s) => s === cleanSymbol)) {
                    return category as TaskStatusCategory;
                }
            }
        }

        // Default fallback
        if (cleanSymbol === "" || cleanSymbol === " ") {
            return "open";
        }

        return "other"; // Catch-all for unrecognized symbols
    }

    /**
     * Get auto-assigned order based on category position in mapping
     * Used when order is not explicitly set
     * Assigns orders: 10, 20, 30... (leaves gaps for future insertions)
     *
     * @param categoryKey - Status category key
     * @param statusMapping - Task status mapping from settings
     * @returns Auto-assigned order number
     */
    static getAutoAssignedOrder(
        categoryKey: string,
        statusMapping: Record<
            string,
            {
                symbols: string[];
                score: number;
                displayName: string;
                aliases: string;
                order?: number;
                description?: string;
                terms?: string;
            }
        >,
    ): number {
        // Get all categories sorted by their effective order
        const categories = Object.entries(statusMapping);

        // Sort by effective order (respecting defaults and explicit orders)
        categories.sort(([keyA, configA], [keyB, configB]) => {
            // Get effective order for each category
            const getEffective = (key: string, config: any): number => {
                if (config.order !== undefined) return config.order;
                const defaultConfig = this.DEFAULT_STATUS_CONFIG[key];
                if (defaultConfig) return defaultConfig.order;
                return 999; // Custom categories default
            };

            const orderA = getEffective(keyA, configA);
            const orderB = getEffective(keyB, configB);
            return orderA - orderB;
        });

        // Find position of this category
        const position = categories.findIndex(([key]) => key === categoryKey);
        if (position === -1) return 999; // Not found

        // Assign order with gaps: 10, 20, 30...
        return (position + 1) * 10;
    }

    /**
     * Get status order for sorting
     * Returns the sort order number for a status category
     * Priority: User config > Built-in defaults > Auto-assigned > Generic fallback
     *
     * @param categoryKey - Status category key (e.g., "open", "inProgress", "myCustom")
     * @param settings - Plugin settings with taskStatusMapping
     * @returns Order number (lower = higher priority in sorting)
     */
    static getStatusOrder(
        categoryKey: string | undefined,
        settings: PluginSettings,
    ): number {
        if (!categoryKey) return 999; // Unknown goes last

        const config = settings.taskStatusMapping[categoryKey];
        if (!config) return 999; // Category not found

        // 1. Use explicit order if configured by user
        if (config.order !== undefined) {
            return config.order;
        }

        // 2. Use built-in default if available
        const defaultConfig = this.DEFAULT_STATUS_CONFIG[categoryKey];
        if (defaultConfig) {
            return defaultConfig.order;
        }

        // 3. Use auto-assigned order based on position
        return this.getAutoAssignedOrder(
            categoryKey,
            settings.taskStatusMapping,
        );
    }

    /**
     * Get description for a status category
     * Uses category key (stable) instead of display name (user-defined)
     * Priority: User config > Built-in defaults > Generic fallback
     * Used in AI prompts to help AI understand category meaning
     *
     * @param categoryKey - Status category key (e.g., "open", "inProgress", "myCustom")
     * @param settings - Plugin settings with taskStatusMapping
     * @returns Human-readable description for AI prompts
     */
    static inferStatusDescription(
        categoryKey: string,
        settings: PluginSettings,
    ): string {
        const config = settings.taskStatusMapping[categoryKey];
        if (!config) {
            return `Tasks with ${categoryKey} status`; // Fallback for unknown category
        }

        // 1. Use explicit description if configured by user
        if (config.description) {
            return config.description;
        }

        // 2. Use built-in default if available
        const defaultConfig = this.DEFAULT_STATUS_CONFIG[categoryKey];
        if (defaultConfig) {
            return defaultConfig.description;
        }

        // 3. Generic fallback for custom categories
        return `Tasks with ${config.displayName} status`;
    }

    /**
     * Get semantic terms for a status category
     * Uses category key (stable) instead of display name (user-defined)
     * Priority: User config > Built-in defaults > Generic fallback
     * Used in AI prompts and property recognition for multilingual matching
     *
     * @param categoryKey - Status category key (e.g., "open", "inProgress", "myCustom")
     * @param settings - Plugin settings with taskStatusMapping
     * @returns Comma-separated multilingual semantic terms
     */
    static inferStatusTerms(
        categoryKey: string,
        settings: PluginSettings,
    ): string {
        const config = settings.taskStatusMapping[categoryKey];
        if (!config) {
            return categoryKey; // Fallback for unknown category
        }

        // 1. Use explicit terms if configured by user
        if (config.terms) {
            return config.terms;
        }

        // 2. Use built-in default if available
        const defaultConfig = this.DEFAULT_STATUS_CONFIG[categoryKey];
        if (defaultConfig) {
            return defaultConfig.terms;
        }

        // 3. Generic fallback for custom categories
        // Combine category key, display name, and aliases for maximum coverage
        const parts = [
            categoryKey.toLowerCase(),
            config.displayName.toLowerCase(),
        ];
        if (config.aliases) {
            parts.push(config.aliases.toLowerCase());
        }
        return parts.join(", ");
    }

    // ==========================================
    // PRIORITY OPERATIONS
    // ==========================================

    /**
     * Map a Dataview priority value to internal numeric priority
     * Uses user's configured dataviewPriorityMapping
     *
     * @param value - Priority value (can be string or number)
     * @param settings - Plugin settings with dataviewPriorityMapping
     * @returns Priority number: 1 (highest), 2 (high), 3 (medium), 4 (low), undefined (none)
     */
    static mapPriority(
        value: any,
        settings: PluginSettings,
    ): number | undefined {
        if (value === undefined || value === null) {
            return undefined;
        }

        const strValue = String(value).toLowerCase().trim();

        // Check user's configured priority mapping
        for (const [priority, values] of Object.entries(
            settings.dataviewPriorityMapping,
        )) {
            if (values.some((v) => v.toLowerCase() === strValue)) {
                return parseInt(priority);
            }
        }

        return undefined;
    }

    /**
     * Compare priorities for sorting
     * Lower number = higher priority (1 is highest)
     *
     * @param a - First priority
     * @param b - Second priority
     * @returns Comparison result for sorting
     */
    static comparePriority(
        a: number | undefined,
        b: number | undefined,
    ): number {
        const aPriority = a ?? 5; // Undefined = lowest priority (5)
        const bPriority = b ?? 5;
        return aPriority - bPriority;
    }

    // ==========================================
    // DATE OPERATIONS
    // ==========================================

    /**
     * Format date to consistent string format
     * Handles multiple date object types (Date, moment, Dataview, string)
     *
     * @param date - Date to format (various types supported)
     * @param format - Optional format string (default: YYYY-MM-DD)
     * @returns Formatted date string or undefined
     */
    static formatDate(date: any, format?: string): string | undefined {
        if (!date) return undefined;

        try {
            // Handle native Date objects
            if (date instanceof Date) {
                return format
                    ? moment(date).format(format)
                    : moment(date).format("YYYY-MM-DD");
            }

            // Handle objects with .format() method (moment/luxon)
            if (
                date &&
                typeof date === "object" &&
                typeof date.format === "function"
            ) {
                return format ? date.format(format) : date.format("YYYY-MM-DD");
            }

            // Handle Dataview date objects (toString() but not .format())
            if (
                date &&
                typeof date === "object" &&
                typeof date.toString === "function"
            ) {
                const dateStr = date.toString();
                const momentDate = moment(dateStr);
                if (momentDate.isValid()) {
                    return format
                        ? momentDate.format(format)
                        : momentDate.format("YYYY-MM-DD");
                }
            }

            // Handle string dates
            if (typeof date === "string") {
                const dateStr = date.trim();
                const parsedDate = moment(dateStr);
                if (parsedDate.isValid()) {
                    return format ? parsedDate.format(format) : dateStr;
                }
            }

            // Fallback: try moment() directly
            const momentDate = moment(date);
            if (momentDate.isValid()) {
                return format
                    ? momentDate.format(format)
                    : momentDate.format("YYYY-MM-DD");
            }
        } catch (e) {
            Logger.error("Error formatting date:", e);
        }

        return undefined;
    }

    /**
     * Parse date string using multiple strategies
     * Unified parser combining chrono-node and moment
     *
     * @param dateStr - Date string to parse
     * @returns Formatted date (YYYY-MM-DD) or null
     */
    static parseDate(dateStr: string): string | null {
        if (!dateStr) return null;

        // Strategy 1: Try chrono-node (natural language dates)
        try {
            const chronoParsed = chrono.parseDate(dateStr);
            if (chronoParsed) {
                const parsed = moment(chronoParsed);
                if (parsed.isValid()) {
                    return parsed.format("YYYY-MM-DD");
                }
            }
        } catch (e) {
            // Continue to fallback
        }

        // Strategy 2: Try moment parsing
        const parsed = moment(dateStr);
        if (parsed.isValid()) {
            return parsed.format("YYYY-MM-DD");
        }

        return null;
    }

    /**
     * Compare dates for sorting
     * Undefined dates go to the end
     *
     * @param a - First date
     * @param b - Second date
     * @returns Comparison result for sorting
     */
    static compareDates(a: string | undefined, b: string | undefined): number {
        if (!a && !b) return 0;
        if (!a) return 1; // a goes to end
        if (!b) return -1; // b goes to end
        return a.localeCompare(b);
    }

    /**
     * Check if task matches date range filter
     *
     * @param task - Task to check
     * @param dateRange - Date range filter (null = no filter)
     * @returns True if task matches
     */
    static matchesDateRange(
        task: Task,
        dateRange: { start?: string; end?: string } | null,
    ): boolean {
        if (!dateRange) return true; // No filter

        // Empty object = "any" filter (task must have a due date)
        if (Object.keys(dateRange).length === 0) {
            return !!task.dueDate;
        }

        if (!task.dueDate) return false;

        const taskDate = moment(task.dueDate).startOf("day");
        if (!taskDate.isValid()) return false;

        // Check start range
        if (dateRange.start) {
            const startDate = moment(dateRange.start).startOf("day");
            if (taskDate.isBefore(startDate)) return false;
        }

        // Check end range
        if (dateRange.end) {
            const endDate = moment(dateRange.end).startOf("day");
            if (taskDate.isAfter(endDate)) return false;
        }

        return true;
    }

    /**
     * Convert date filter to Dataview date range query
     * Handles: today, tomorrow, overdue, week, next-week, future, any, +Nd/+Nw/+Nm, specific dates
     *
     * @param dateFilter - Date filter string
     * @returns Date range or null
     */
    static convertDateFilterToRange(dateFilter: string): DateRange | null {
        const today = moment().startOf("day");

        switch (dateFilter) {
            case "any":
                return {}; // Will check for existence

            case "today":
                return {
                    start: today.format("YYYY-MM-DD"),
                    end: today.format("YYYY-MM-DD"),
                };

            case "tomorrow": {
                const tomorrow = moment().add(1, "day").startOf("day");
                return {
                    start: tomorrow.format("YYYY-MM-DD"),
                    end: tomorrow.format("YYYY-MM-DD"),
                };
            }

            case "overdue":
                return {
                    end: today.clone().subtract(1, "day").format("YYYY-MM-DD"),
                };

            case "future":
                return {
                    start: today.clone().add(1, "day").format("YYYY-MM-DD"),
                };

            case "week": {
                const weekEnd = today.clone().add(7, "days").endOf("day");
                return {
                    start: today.format("YYYY-MM-DD"),
                    end: weekEnd.format("YYYY-MM-DD"),
                };
            }

            case "next-week": {
                const nextWeekStart = today
                    .clone()
                    .add(7, "days")
                    .startOf("day");
                const nextWeekEnd = today.clone().add(14, "days").endOf("day");
                return {
                    start: nextWeekStart.format("YYYY-MM-DD"),
                    end: nextWeekEnd.format("YYYY-MM-DD"),
                };
            }

            default:
                // Try relative date patterns
                const relativeRange = this.parseRelativeDateRange(
                    dateFilter,
                    today,
                );
                if (relativeRange) return relativeRange;

                // Try natural language parsing
                const chronoParsed = chrono.parseDate(dateFilter);
                if (chronoParsed) {
                    const chronoDate = moment(chronoParsed).startOf("day");
                    if (chronoDate.isValid()) {
                        return {
                            start: chronoDate.format("YYYY-MM-DD"),
                            end: chronoDate.format("YYYY-MM-DD"),
                        };
                    }
                }

                // Try specific date (YYYY-MM-DD)
                const parsedDate = moment(dateFilter, "YYYY-MM-DD", true);
                if (parsedDate.isValid()) {
                    return {
                        start: parsedDate.format("YYYY-MM-DD"),
                        end: parsedDate.format("YYYY-MM-DD"),
                    };
                }

                return null;
        }
    }

    /**
     * Parse relative date ranges
     * Supports: "5 days ago", "within 5 days", "next 2 weeks", "+3d", "-3d", etc.
     *
     * @param dateFilter - Date filter string
     * @param today - Reference date (usually current date)
     * @returns Date range or null
     */
    static parseRelativeDateRange(
        dateFilter: string,
        today: moment.Moment,
    ): DateRange | null {
        const lowerFilter = dateFilter.toLowerCase().trim();

        // Pattern 1: Dataview duration (7d, 2w, 3mo, 1yr)
        const durationPattern =
            /^(\d+)\s*(d|day|days|w|wk|wks|week|weeks|mo|month|months|yr|yrs|year|years)$/;
        const durationMatch = lowerFilter.match(durationPattern);
        if (durationMatch) {
            const amount = parseInt(durationMatch[1]);
            const unit = durationMatch[2];
            const momentUnit = unit.startsWith("d")
                ? "days"
                : unit.startsWith("w")
                  ? "weeks"
                  : unit.startsWith("mo")
                    ? "months"
                    : unit.startsWith("yr")
                      ? "years"
                      : "days";

            const futureDate = today
                .clone()
                .add(
                    amount,
                    momentUnit as moment.unitOfTime.DurationConstructor,
                );
            return {
                start: today.format("YYYY-MM-DD"),
                end: futureDate.format("YYYY-MM-DD"),
            };
        }

        // Pattern 2: Todoist-style "+3 days" or "-3 days"
        const todoistMatch = lowerFilter.match(
            /^([+-])?(\d+)\s+(day|days|week|weeks)$/,
        );
        if (todoistMatch) {
            const sign = todoistMatch[1] || "+";
            const amount = parseInt(todoistMatch[2]);
            const unit = todoistMatch[3].startsWith("week") ? "weeks" : "days";

            if (sign === "+") {
                const futureDate = today.clone().add(amount, unit);
                return {
                    start: today.format("YYYY-MM-DD"),
                    end: futureDate.format("YYYY-MM-DD"),
                };
            } else {
                const pastDate = today.clone().subtract(amount, unit);
                return {
                    start: pastDate.format("YYYY-MM-DD"),
                    end: today.format("YYYY-MM-DD"),
                };
            }
        }

        // Pattern 3: "X days/weeks/months ago"
        const agoMatch = lowerFilter.match(
            /(\d+)\s+(day|days|week|weeks|month|months|year|years)\s+ago/,
        );
        if (agoMatch) {
            const amount = parseInt(agoMatch[1]);
            const unit = agoMatch[2].startsWith("week")
                ? "weeks"
                : agoMatch[2].startsWith("month")
                  ? "months"
                  : agoMatch[2].startsWith("year")
                    ? "years"
                    : "days";
            const pastDate = today.clone().subtract(amount, unit);
            return {
                start: pastDate.format("YYYY-MM-DD"),
                end: pastDate.format("YYYY-MM-DD"),
            };
        }

        // Pattern 4: "within X days/weeks"
        const withinMatch = lowerFilter.match(
            /within\s+(\d+)\s+(day|days|week|weeks|month|months)/,
        );
        if (withinMatch) {
            const amount = parseInt(withinMatch[1]);
            const unit = withinMatch[2].startsWith("week")
                ? "weeks"
                : withinMatch[2].startsWith("month")
                  ? "months"
                  : "days";
            const futureDate = today.clone().add(amount, unit);
            return {
                start: today.format("YYYY-MM-DD"),
                end: futureDate.format("YYYY-MM-DD"),
            };
        }

        // Pattern 5: "next X days/weeks/months"
        const nextMatch = lowerFilter.match(
            /next\s+(\d+)\s+(day|days|week|weeks|month|months|year|years)/,
        );
        if (nextMatch) {
            const amount = parseInt(nextMatch[1]);
            const unit = nextMatch[2].startsWith("week")
                ? "weeks"
                : nextMatch[2].startsWith("month")
                  ? "months"
                  : nextMatch[2].startsWith("year")
                    ? "years"
                    : "days";
            const futureDate = today.clone().add(amount, unit);
            return {
                start: today.format("YYYY-MM-DD"),
                end: futureDate.format("YYYY-MM-DD"),
            };
        }

        // Pattern 6: "last X days/weeks"
        const lastMatch = lowerFilter.match(
            /last\s+(\d+)\s+(day|days|week|weeks|month|months)/,
        );
        if (lastMatch) {
            const amount = parseInt(lastMatch[1]);
            const unit = lastMatch[2].startsWith("week")
                ? "weeks"
                : lastMatch[2].startsWith("month")
                  ? "months"
                  : "days";
            const pastDate = today.clone().subtract(amount, unit);
            return {
                start: pastDate.format("YYYY-MM-DD"),
                end: today.format("YYYY-MM-DD"),
            };
        }

        return null;
    }

    /**
     * Filter tasks by due date
     * Handles: any, today, tomorrow, overdue, future, week, next-week, +Nd/+Nw/+Nm, specific dates
     *
     * @param tasks - Tasks to filter
     * @param filter - Date filter string
     * @returns Filtered tasks
     */
    static filterByDueDate(tasks: Task[], filter: string): Task[] {
        const today = new Date();
        today.setHours(0, 0, 0, 0);

        // Special case: "any" means tasks WITH a due date
        if (filter === "any") {
            return tasks.filter(
                (task) =>
                    task.dueDate !== undefined &&
                    task.dueDate !== null &&
                    task.dueDate !== "",
            );
        }

        return tasks.filter((task) => {
            if (!task.dueDate) return false;

            // Parse date in local timezone
            let dueDate: Date;
            if (task.dueDate.includes("T") || task.dueDate.includes(" ")) {
                dueDate = new Date(task.dueDate);
            } else {
                const parts = task.dueDate.split("-");
                dueDate = new Date(
                    parseInt(parts[0]),
                    parseInt(parts[1]) - 1,
                    parseInt(parts[2]),
                );
            }
            dueDate.setHours(0, 0, 0, 0);

            switch (filter) {
                case "overdue":
                    return dueDate < today;
                case "future":
                    return dueDate > today;
                case "today":
                    return dueDate.getTime() === today.getTime();
                case "tomorrow": {
                    const tomorrow = new Date(today);
                    tomorrow.setDate(tomorrow.getDate() + 1);
                    return dueDate.getTime() === tomorrow.getTime();
                }
                case "week": {
                    const weekEnd = new Date(today);
                    weekEnd.setDate(weekEnd.getDate() + 7);
                    return dueDate >= today && dueDate <= weekEnd;
                }
                case "next-week": {
                    const nextWeekStart = new Date(today);
                    nextWeekStart.setDate(nextWeekStart.getDate() + 7);
                    const nextWeekEnd = new Date(today);
                    nextWeekEnd.setDate(nextWeekEnd.getDate() + 14);
                    return dueDate >= nextWeekStart && dueDate <= nextWeekEnd;
                }
                default:
                    // Handle relative dates (+Nd, +Nw, +Nm)
                    if (filter.startsWith("+")) {
                        const relativeMatch = filter.match(/^\+(\d+)([dwm])$/);
                        if (relativeMatch) {
                            const amount = parseInt(relativeMatch[1]);
                            const unit = relativeMatch[2];
                            const targetDate = new Date(today);
                            if (unit === "d") {
                                targetDate.setDate(
                                    targetDate.getDate() + amount,
                                );
                            } else if (unit === "w") {
                                targetDate.setDate(
                                    targetDate.getDate() + amount * 7,
                                );
                            } else if (unit === "m") {
                                targetDate.setMonth(
                                    targetDate.getMonth() + amount,
                                );
                            }
                            targetDate.setHours(0, 0, 0, 0);
                            return dueDate.getTime() === targetDate.getTime();
                        }
                    }

                    // Try specific date match
                    try {
                        const targetDate = new Date(filter);
                        targetDate.setHours(0, 0, 0, 0);
                        if (!isNaN(targetDate.getTime())) {
                            return dueDate.getTime() === targetDate.getTime();
                        }
                    } catch (e) {
                        // Invalid date format
                    }
                    return false;
            }
        });
    }

    /**
     * Get all property trigger words that should be removed from keywords
     * These words activate filters and should NOT be used for relevance scoring
     *
     * Includes:
     * - Due date terms (general, today, tomorrow, overdue, week, future)
     * - Priority terms (general, high, medium, low)
     * - Status terms (general + all categories)
     * - User-configured custom terms
     *
     * @param settings - Plugin settings with user-configured terms
     * @returns Set of all property trigger words (lowercase)
     */
    static getAllPropertyTriggerWords(settings: PluginSettings): Set<string> {
        const triggerWords = new Set<string>();

        // Get combined terms (base + user-configured)
        const dueDateTerms = this.getCombinedDueDateTerms(settings);
        const priorityTerms = this.getCombinedPriorityTerms(settings);
        const statusTerms = this.getCombinedStatusTerms(settings);

        // Add all due date terms
        Object.values(dueDateTerms).forEach((terms) => {
            terms.forEach((term) => triggerWords.add(term.toLowerCase()));
        });

        // Add all priority terms
        Object.values(priorityTerms).forEach((terms) => {
            terms.forEach((term) => triggerWords.add(term.toLowerCase()));
        });

        // Add all status terms (including custom categories)
        Object.values(statusTerms).forEach((terms) => {
            terms.forEach((term) => triggerWords.add(term.toLowerCase()));
        });

        return triggerWords;
    }

    /**
     * Resolve status value to category key
     * Handles: category names, aliases, and symbols
     *
     * Used across all modes (Simple Search, Smart Search, Task Chat) for consistent status resolution
     *
     * Examples:
     * - "open" → "open" (category key)
     * - "o" → "open" (alias)
     * - "x" → "completed" (symbol)
     * - "all" → "open" (alias)
     *
     * @param value - Status value to resolve (from s:value syntax or natural language)
     * @param settings - Plugin settings with status mapping
     * @returns Category key if found, null otherwise
     */
    static resolveStatusValue(
        value: string,
        settings: PluginSettings,
    ): string | null {
        // Handle null/undefined values
        if (!value) {
            Logger.debug("[resolveStatusValue] Input value is null/undefined");
            return null;
        }

        const lowerValue = value.toLowerCase();
        Logger.debug(
            `[resolveStatusValue] Attempting to resolve: "${value}" (lowercase: "${lowerValue}")`,
        );

        // Check each category in the status mapping
        Logger.debug(
            `[resolveStatusValue] Checking user taskStatusMapping (${Object.keys(settings.taskStatusMapping).length} categories)`,
        );
        for (const [categoryKey, config] of Object.entries(
            settings.taskStatusMapping,
        )) {
            // Check if value matches category key
            if (categoryKey.toLowerCase() === lowerValue) {
                Logger.debug(
                    `[resolveStatusValue] ✓ Matched category key: "${categoryKey}"`,
                );
                return categoryKey;
            }

            // Check if value matches any alias
            if (config.aliases) {
                const aliases = config.aliases
                    .split(",")
                    .map((a) => a.trim().toLowerCase());
                if (aliases.includes(lowerValue)) {
                    Logger.debug(
                        `[resolveStatusValue] ✓ Matched alias in category: "${categoryKey}"`,
                    );
                    return categoryKey;
                }
            }

            // Check if value matches any symbol
            if (config.symbols && Array.isArray(config.symbols)) {
                const symbols = config.symbols.map((s) => s.toLowerCase());
                if (symbols.includes(lowerValue)) {
                    Logger.debug(
                        `[resolveStatusValue] ✓ Matched symbol in category: "${categoryKey}"`,
                    );
                    return categoryKey;
                }
            }
        }

        // FALLBACK: Check default status config if not found in user settings
        // This ensures standard keywords like "open", "completed" work even with custom mappings
        Logger.debug(
            `[resolveStatusValue] Not found in user settings, checking DEFAULT_STATUS_CONFIG (${Object.keys(this.DEFAULT_STATUS_CONFIG).length} categories)`,
        );
        for (const [categoryKey, defaultConfig] of Object.entries(
            this.DEFAULT_STATUS_CONFIG,
        )) {
            // Check if value matches default category key
            if (categoryKey.toLowerCase() === lowerValue) {
                Logger.debug(
                    `[resolveStatusValue] ✓ Matched DEFAULT category key: "${categoryKey}"`,
                );
                return categoryKey;
            }

            // Check if value matches default terms
            const terms = defaultConfig.terms
                .split(",")
                .map((t) => t.trim().toLowerCase());
            if (terms.includes(lowerValue)) {
                Logger.debug(
                    `[resolveStatusValue] ✓ Matched DEFAULT term in category: "${categoryKey}"`,
                );
                return categoryKey;
            }
        }

        Logger.warn(
            `[resolveStatusValue] ✗ No match found for "${value}" in user settings or defaults`,
        );
        return null;
    }

    /**
     * Resolve multiple status values to category keys
     * Used for multi-value status queries (e.g., s:open,wip)
     *
     * @param values - Array of status values to resolve
     * @param settings - Plugin settings with status mapping
     * @returns Array of resolved category keys (duplicates removed)
     */
    static resolveStatusValues(
        values: string[],
        settings: PluginSettings,
    ): string[] {
        const resolved = values
            .map((v) => this.resolveStatusValue(v, settings))
            .filter((v) => v !== null) as string[];

        // Remove duplicates
        return [...new Set(resolved)];
    }

    /**
     * Check if a date value matches a due date keyword
     * Centralized date matching logic for all due date keywords
     *
     * @param dateValue - The date value from task field (Dataview format)
     * @param keyword - The keyword to match against (today, tomorrow, overdue, etc.)
     * @param formatDate - Function to format date value to YYYY-MM-DD
     * @returns True if the date matches the keyword
     */
    static matchesDueDateKeyword(
        dateValue: any,
        keyword: string,
        formatDate: (date: any) => string | undefined,
    ): boolean {
        if (!dateValue) return false;

        const moment = (window as any).moment;
        const formatted = formatDate(dateValue);
        if (!formatted) return false;

        const taskDate = moment(formatted);
        if (!taskDate.isValid()) return false;

        // Match against all defined keywords
        switch (keyword) {
            case this.DUE_DATE_KEYWORDS.today:
                return formatted === moment().format("YYYY-MM-DD");

            case this.DUE_DATE_KEYWORDS.tomorrow:
                return (
                    formatted === moment().add(1, "day").format("YYYY-MM-DD")
                );

            case this.DUE_DATE_KEYWORDS.yesterday:
                return (
                    formatted ===
                    moment().subtract(1, "day").format("YYYY-MM-DD")
                );

            case this.DUE_DATE_KEYWORDS.overdue:
                return taskDate.isBefore(moment(), "day");

            case this.DUE_DATE_KEYWORDS.future:
                return taskDate.isAfter(moment(), "day");

            case this.DUE_DATE_KEYWORDS.week: {
                const startOfWeek = moment().startOf("week");
                const endOfWeek = moment().endOf("week");
                return (
                    taskDate.isSameOrAfter(startOfWeek, "day") &&
                    taskDate.isSameOrBefore(endOfWeek, "day")
                );
            }

            case this.DUE_DATE_KEYWORDS.lastWeek: {
                const startOfLastWeek = moment()
                    .subtract(1, "week")
                    .startOf("week");
                const endOfLastWeek = moment()
                    .subtract(1, "week")
                    .endOf("week");
                return (
                    taskDate.isSameOrAfter(startOfLastWeek, "day") &&
                    taskDate.isSameOrBefore(endOfLastWeek, "day")
                );
            }

            case this.DUE_DATE_KEYWORDS.nextWeek: {
                const startOfNextWeek = moment().add(1, "week").startOf("week");
                const endOfNextWeek = moment().add(1, "week").endOf("week");
                return (
                    taskDate.isSameOrAfter(startOfNextWeek, "day") &&
                    taskDate.isSameOrBefore(endOfNextWeek, "day")
                );
            }

            case this.DUE_DATE_KEYWORDS.month: {
                const startOfMonth = moment().startOf("month");
                const endOfMonth = moment().endOf("month");
                return (
                    taskDate.isSameOrAfter(startOfMonth, "day") &&
                    taskDate.isSameOrBefore(endOfMonth, "day")
                );
            }

            case this.DUE_DATE_KEYWORDS.lastMonth: {
                const startOfLastMonth = moment()
                    .subtract(1, "month")
                    .startOf("month");
                const endOfLastMonth = moment()
                    .subtract(1, "month")
                    .endOf("month");
                return (
                    taskDate.isSameOrAfter(startOfLastMonth, "day") &&
                    taskDate.isSameOrBefore(endOfLastMonth, "day")
                );
            }

            case this.DUE_DATE_KEYWORDS.nextMonth: {
                const startOfNextMonth = moment()
                    .add(1, "month")
                    .startOf("month");
                const endOfNextMonth = moment().add(1, "month").endOf("month");
                return (
                    taskDate.isSameOrAfter(startOfNextMonth, "day") &&
                    taskDate.isSameOrBefore(endOfNextMonth, "day")
                );
            }

            case this.DUE_DATE_KEYWORDS.year: {
                const startOfYear = moment().startOf("year");
                const endOfYear = moment().endOf("year");
                return (
                    taskDate.isSameOrAfter(startOfYear, "day") &&
                    taskDate.isSameOrBefore(endOfYear, "day")
                );
            }

            case this.DUE_DATE_KEYWORDS.lastYear: {
                const startOfLastYear = moment()
                    .subtract(1, "year")
                    .startOf("year");
                const endOfLastYear = moment()
                    .subtract(1, "year")
                    .endOf("year");
                return (
                    taskDate.isSameOrAfter(startOfLastYear, "day") &&
                    taskDate.isSameOrBefore(endOfLastYear, "day")
                );
            }

            case this.DUE_DATE_KEYWORDS.nextYear: {
                const startOfNextYear = moment().add(1, "year").startOf("year");
                const endOfNextYear = moment().add(1, "year").endOf("year");
                return (
                    taskDate.isSameOrAfter(startOfNextYear, "day") &&
                    taskDate.isSameOrBefore(endOfNextYear, "day")
                );
            }

            default:
                return false;
        }
    }

    /**
     * Parse date range keyword to moment date
     * Centralized date range parsing for week-start, month-end, etc.
     *
     * @param keyword - The date range keyword
     * @returns Moment date object
     */
    static parseDateRangeKeyword(keyword: string): any {
        const moment = (window as any).moment;

        switch (keyword) {
            case this.DATE_RANGE_KEYWORDS.weekStart:
                return moment().startOf("week");
            case this.DATE_RANGE_KEYWORDS.weekEnd:
                return moment().endOf("week");
            case this.DATE_RANGE_KEYWORDS.lastWeekStart:
                return moment().subtract(1, "week").startOf("week");
            case this.DATE_RANGE_KEYWORDS.lastWeekEnd:
                return moment().subtract(1, "week").endOf("week");
            case this.DATE_RANGE_KEYWORDS.nextWeekStart:
                return moment().add(1, "week").startOf("week");
            case this.DATE_RANGE_KEYWORDS.nextWeekEnd:
                return moment().add(1, "week").endOf("week");
            case this.DATE_RANGE_KEYWORDS.monthStart:
                return moment().startOf("month");
            case this.DATE_RANGE_KEYWORDS.monthEnd:
                return moment().endOf("month");
            case this.DATE_RANGE_KEYWORDS.lastMonthStart:
                return moment().subtract(1, "month").startOf("month");
            case this.DATE_RANGE_KEYWORDS.lastMonthEnd:
                return moment().subtract(1, "month").endOf("month");
            case this.DATE_RANGE_KEYWORDS.nextMonthStart:
                return moment().add(1, "month").startOf("month");
            case this.DATE_RANGE_KEYWORDS.nextMonthEnd:
                return moment().add(1, "month").endOf("month");
            case this.DATE_RANGE_KEYWORDS.yearStart:
                return moment().startOf("year");
            case this.DATE_RANGE_KEYWORDS.yearEnd:
                return moment().endOf("year");
            case this.DATE_RANGE_KEYWORDS.lastYearStart:
                return moment().subtract(1, "year").startOf("year");
            case this.DATE_RANGE_KEYWORDS.lastYearEnd:
                return moment().subtract(1, "year").endOf("year");
            case this.DATE_RANGE_KEYWORDS.nextYearStart:
                return moment().add(1, "year").startOf("year");
            case this.DATE_RANGE_KEYWORDS.nextYearEnd:
                return moment().add(1, "year").endOf("year");
            default:
                return moment(keyword);
        }
    }

    /**
     * Parse relative date string with enhanced syntax support
     * Supports: 1d, +1d, -1d, 1w, +1w, -1w, 1m, +1m, -1m, 1y, +1y, -1y
     * Compatible with Dataview API relative date syntax
     *
     * @param relativeDate - Relative date string (e.g., "1d", "+2w", "-3m", "1y")
     * @returns Formatted date string (YYYY-MM-DD) or null if invalid
     */
    static parseRelativeDate(relativeDate: string): string | null {
        const moment = (window as any).moment;

        // Match pattern: optional +/-, number, unit (d/w/m/y)
        // Supports: 1d, +1d, -1d, 1w, +1w, -1w, 1m, +1m, -1m, 1y, +1y, -1y
        const match = relativeDate.match(/^([+-]?)(\d+)([dwmy])$/i);
        if (!match) return null;

        const sign = match[1] || "+"; // Default to + if no sign
        const amount = parseInt(match[2]);
        const unit = match[3].toLowerCase();

        // Map unit to moment unit
        const unitMap: { [key: string]: any } = {
            d: "days",
            w: "weeks",
            m: "months",
            y: "years",
        };

        const momentUnit = unitMap[unit];
        if (!momentUnit) return null;

        // Calculate target date
        let targetDate: any;
        if (sign === "-") {
            targetDate = moment().subtract(amount, momentUnit);
        } else {
            targetDate = moment().add(amount, momentUnit);
        }

        return targetDate.format("YYYY-MM-DD");
    }

    /**
     * Validate status orders for duplicates and conflicts
     * Checks if multiple categories share the same order number
     *
     * @param statusMapping - Task status mapping from settings
     * @returns Validation result with duplicates and warnings
     */
    static validateStatusOrders(
        statusMapping: Record<
            string,
            {
                symbols: string[];
                score: number;
                displayName: string;
                aliases: string;
                order?: number;
                description?: string;
                terms?: string;
            }
        >,
    ): {
        valid: boolean;
        duplicates: Array<{ order: number; categories: string[] }>;
        warnings: string[];
    } {
        const orderMap = new Map<number, string[]>();

        // Group categories by order number
        for (const [key, config] of Object.entries(statusMapping)) {
            if (config.order !== undefined) {
                const existing = orderMap.get(config.order) || [];
                existing.push(key);
                orderMap.set(config.order, existing);
            }
        }

        // Find duplicates (orders used by multiple categories)
        const duplicates: Array<{ order: number; categories: string[] }> = [];
        for (const [order, categories] of orderMap.entries()) {
            if (categories.length > 1) {
                duplicates.push({ order, categories });
            }
        }

        // Generate user-friendly warnings
        const warnings: string[] = [];
        for (const dup of duplicates) {
            const categoryNames = dup.categories
                .map((key) => statusMapping[key]?.displayName || key)
                .join(", ");
            warnings.push(
                `Order ${dup.order} is used by multiple categories: ${categoryNames}. ` +
                    `This may cause unpredictable sorting behavior when sorting by status.`,
            );
        }

        return {
            valid: duplicates.length === 0,
            duplicates,
            warnings,
        };
    }

    /**
     * Auto-fix duplicate status orders by renumbering with gaps
     * Assigns new order numbers: 10, 20, 30... (leaves gaps for future insertions)
     *
     * @param statusMapping - Task status mapping from settings
     * @returns Updated status mapping with fixed orders
     */
    static autoFixStatusOrders(
        statusMapping: Record<
            string,
            {
                symbols: string[];
                score: number;
                displayName: string;
                aliases: string;
                order?: number;
                description?: string;
                terms?: string;
            }
        >,
    ): Record<
        string,
        {
            symbols: string[];
            score: number;
            displayName: string;
            aliases: string;
            order?: number;
            description?: string;
            terms?: string;
        }
    > {
        // Get all categories sorted by their current effective order
        const categories = Object.entries(statusMapping);

        // Sort by effective order (respecting defaults)
        categories.sort(([keyA, configA], [keyB, configB]) => {
            const orderA =
                configA.order ?? this.DEFAULT_STATUS_CONFIG[keyA]?.order ?? 999;
            const orderB =
                configB.order ?? this.DEFAULT_STATUS_CONFIG[keyB]?.order ?? 999;
            return orderA - orderB;
        });

        // Calculate dynamic gap based on total category count
        // For 10 or fewer categories: gap = 10 (10, 20, 30...)
        // For more categories: smaller gaps to fit within reasonable range
        // Ensures we can always insert new categories between existing ones
        const categoryCount = categories.length;
        const dynamicGap = Math.max(10, Math.ceil(100 / categoryCount));

        // Assign new orders with dynamic gaps
        const fixed = { ...statusMapping };
        categories.forEach(([key], index) => {
            fixed[key] = {
                ...fixed[key],
                order: (index + 1) * dynamicGap,
            };
        });

        return fixed;
    }

    // ============================================================================
    // FIELD EXTRACTION UTILITIES
    // Used by both DataviewService and DatacoreService
    // ============================================================================

    /**
     * Extract emoji shorthand date from task text
     *
     * IMPORTANT: Only extracts the emoji for the SPECIFIC field being requested
     * Don't extract other date emojis (e.g., don't return created date when looking for due date)
     *
     * @param text - Task text containing emoji shorthands
     * @param fieldKey - Field name being requested (due, dueDate, created, etc.)
     * @returns Extracted date string in YYYY-MM-DD format, or undefined
     */
    static extractEmojiShorthand(
        text: string,
        fieldKey: string,
    ): string | undefined {
        if (!text || typeof text !== "string") return undefined;

        // Map field key to specific emoji pattern
        // Only check the emoji that corresponds to THIS field
        const fieldToEmojiPattern: { [key: string]: RegExp } = {
            due: this.DATE_EMOJI_PATTERNS.due,
            dueDate: this.DATE_EMOJI_PATTERNS.due,
            completion: this.DATE_EMOJI_PATTERNS.completion,
            completedDate: this.DATE_EMOJI_PATTERNS.completion,
            completed: this.DATE_EMOJI_PATTERNS.completion,
            created: this.DATE_EMOJI_PATTERNS.created,
            createdDate: this.DATE_EMOJI_PATTERNS.created,
            start: this.DATE_EMOJI_PATTERNS.start,
            startDate: this.DATE_EMOJI_PATTERNS.start,
            scheduled: this.DATE_EMOJI_PATTERNS.scheduled,
            scheduledDate: this.DATE_EMOJI_PATTERNS.scheduled,
        };

        const pattern = fieldToEmojiPattern[fieldKey];
        if (!pattern) {
            // No specific emoji pattern for this field
            return undefined;
        }

        const match = text.match(pattern);
        if (match && match[1]) {
            const extractedDate = match[1].trim();
            const momentDate = moment(extractedDate, "YYYY-MM-DD", true);
            if (momentDate.isValid()) {
                return extractedDate;
            }
        }

        return undefined;
    }

    /**
     * Extract inline field from task text using [key::value] syntax
     *
     * @param text - Task text containing inline fields
     * @param fieldKey - Field name to extract
     * @returns Extracted value, or undefined
     */
    static extractInlineField(
        text: string,
        fieldKey: string,
    ): string | undefined {
        if (!text || typeof text !== "string") return undefined;

        // Match [fieldKey::value] or [fieldKey:: value]
        const regex = new RegExp(`\\[${fieldKey}::([^\\]]+)\\]`, "i");
        const match = text.match(regex);

        if (match && match[1]) {
            return match[1].trim();
        }

        return undefined;
    }

    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    // UNIFIED FIELD EXTRACTION (Dataview + Datacore)
    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

    /**
     * Get task text based on source (Dataview vs Datacore)
     * @param task - Task object from either Dataview or Datacore
     * @param source - Source type ('dataview' or 'datacore')
     * @returns Task text
     */
    private static getTaskText(task: any, source: TaskSource): string {
        if (source === "datacore") {
            return task.$text || task.text || "";
        } else {
            return task.visual || task.text || task.content || "";
        }
    }

    /**
     * Get Datacore built-in field key (with $ prefix)
     * Maps common field names to Datacore's $ prefixed built-ins
     */
    private static getDatacoreBuiltInKey(fieldKey: string): string | null {
        const builtInMap: { [key: string]: string } = {
            text: "$text",
            symbol: "$status",
            status: "$status",
            completed: "$completed",
            due: "$due",
            dueDate: "$due",
            deadline: "$due",
            created: "$created",
            createdDate: "$created",
            completion: "$completion",
            completedDate: "$completion",
            start: "$start",
            startDate: "$start",
            scheduled: "$scheduled",
            scheduledDate: "$scheduled",
            priority: "$priority",
            p: "$priority",
            pri: "$priority",
            prio: "$priority",
            tags: "$tags",
            file: "$file",
            path: "$file",
        };
        return builtInMap[fieldKey] || null;
    }

    /**
     * Get standard field mapping for a given field key and source
     * Returns array of standard field names to check
     */
    private static getStandardFieldMapping(
        fieldKey: string,
        settings: PluginSettings,
        source: TaskSource,
    ): string[] {
        const fieldMap: { [key: string]: string[] } = {};

        if (source === "datacore") {
            // Datacore: $ prefix for built-ins
            fieldMap[settings.dataviewKeys.dueDate] = ["$due"];
            fieldMap["due"] = ["$due"];
            fieldMap["dueDate"] = ["$due"];
            fieldMap["deadline"] = ["$due"];
            fieldMap[settings.dataviewKeys.completedDate] = ["$completion"];
            fieldMap["completion"] = ["$completion"];
            fieldMap["completed"] = ["$completion"];
            fieldMap["completedDate"] = ["$completion"];
            fieldMap[settings.dataviewKeys.createdDate] = ["$created"];
            fieldMap["created"] = ["$created"];
            fieldMap["createdDate"] = ["$created"];
            fieldMap["start"] = ["$start"];
            fieldMap["startDate"] = ["$start"];
            fieldMap["scheduled"] = ["$scheduled"];
            fieldMap["scheduledDate"] = ["$scheduled"];
            fieldMap[settings.dataviewKeys.priority] = ["$priority"];
            fieldMap["priority"] = ["$priority"];
            fieldMap["p"] = ["$priority"];
            fieldMap["pri"] = ["$priority"];
            fieldMap["prio"] = ["$priority"];
            fieldMap["tags"] = ["$tags"];
            fieldMap["file"] = ["$file"];
            fieldMap["path"] = ["$file"];
        } else {
            // Dataview: emoji shorthand names
            fieldMap[settings.dataviewKeys.dueDate] = ["due"];
            fieldMap["due"] = ["due"];
            fieldMap["dueDate"] = ["due"];
            fieldMap["deadline"] = ["due"];
            fieldMap[settings.dataviewKeys.completedDate] = ["completion"];
            fieldMap["completion"] = ["completion"];
            fieldMap["completed"] = ["completion"];
            fieldMap["completedDate"] = ["completion"];
            fieldMap[settings.dataviewKeys.createdDate] = ["created"];
            fieldMap["created"] = ["created"];
            fieldMap["createdDate"] = ["created"];
            fieldMap["start"] = ["start"];
            fieldMap["startDate"] = ["start"];
            fieldMap["scheduled"] = ["scheduled"];
            fieldMap["scheduledDate"] = ["scheduled"];
            fieldMap[settings.dataviewKeys.priority] = ["priority"];
            fieldMap["priority"] = ["priority"];
            fieldMap["p"] = ["priority"];
            fieldMap["pri"] = ["priority"];
            fieldMap["prio"] = ["priority"];
        }

        return fieldMap[fieldKey] || [];
    }

    /**
     * Unified field value extraction for both Dataview and Datacore
     * Handles different task object structures transparently
     *
     * @param task - Task object from either Dataview or Datacore
     * @param fieldKey - Field name to extract
     * @param text - Task text for fallback extraction
     * @param settings - Plugin settings
     * @param source - Source type ('dataview' or 'datacore')
     * @returns Field value, or undefined if not found
     */
    static getUnifiedFieldValue(
        task: any,
        fieldKey: string,
        text: string,
        settings: PluginSettings,
        source: TaskSource,
    ): any {
        // Strategy 1: Check source-specific direct fields
        if (source === "datacore") {
            // Try $ prefix first for Datacore built-ins
            const builtInKey = this.getDatacoreBuiltInKey(fieldKey);
            if (builtInKey && task[builtInKey] !== undefined) {
                return task[builtInKey];
            }
        }

        // Try direct property (both sources)
        if (task[fieldKey] !== undefined) {
            return task[fieldKey];
        }

        // Strategy 2: Check fields object (same for both)
        if (task.fields && task.fields[fieldKey] !== undefined) {
            return task.fields[fieldKey];
        }

        // Strategy 3: Check standard fields (source-specific mapping)
        const standardFields = this.getStandardFieldMapping(
            fieldKey,
            settings,
            source,
        );
        for (const standardField of standardFields) {
            if (task[standardField] !== undefined) {
                return task[standardField];
            }
            if (task.fields && task.fields[standardField] !== undefined) {
                return task.fields[standardField];
            }
        }

        // Strategy 4: Extract emoji shorthands from text (same for both)
        const emojiValue = this.extractEmojiShorthand(text, fieldKey);
        if (emojiValue !== undefined) {
            return emojiValue;
        }

        // Strategy 5: Extract from inline field syntax (same for both)
        const inlineValue = this.extractInlineField(text, fieldKey);
        if (inlineValue !== undefined) {
            return inlineValue;
        }

        return undefined;
    }

    /**
     * Unified due date matching for both Dataview and Datacore
     * Checks if a task matches a specific due date value
     *
     * @param task - Task object from either Dataview or Datacore
     * @param dueDateValue - Due date value to match against
     * @param dueDateFields - Array of due date field names to check
     * @param settings - Plugin settings
     * @param source - Source type ('dataview' or 'datacore')
     * @returns True if task matches the due date value
     */
    static matchesUnifiedDueDateValue(
        task: any,
        dueDateValue: string,
        dueDateFields: string[],
        settings: PluginSettings,
        source: TaskSource,
    ): boolean {
        const taskText = this.getTaskText(task, source);

        // Check for "all"/"any" - has any due date
        if (
            dueDateValue === this.DUE_DATE_FILTER_KEYWORDS.all ||
            dueDateValue === this.DUE_DATE_FILTER_KEYWORDS.any
        ) {
            return dueDateFields.some((field) => {
                const value = this.getUnifiedFieldValue(
                    task,
                    field,
                    taskText,
                    settings,
                    source,
                );
                return value !== undefined && value !== null;
            });
        }

        // Check for "none" - no due date
        if (dueDateValue === this.DUE_DATE_FILTER_KEYWORDS.none) {
            return !dueDateFields.some((field) => {
                const value = this.getUnifiedFieldValue(
                    task,
                    field,
                    taskText,
                    settings,
                    source,
                );
                return value !== undefined && value !== null;
            });
        }

        // Check for date keywords (today, overdue, etc.)
        const dueDateKeywords = Object.values(
            this.DUE_DATE_KEYWORDS,
        ) as string[];
        if (dueDateKeywords.includes(dueDateValue)) {
            return dueDateFields.some((field) => {
                const value = this.getUnifiedFieldValue(
                    task,
                    field,
                    taskText,
                    settings,
                    source,
                );
                return this.matchesDueDateKeyword(
                    value,
                    dueDateValue as keyof typeof TaskPropertyService.DUE_DATE_KEYWORDS,
                    this.formatDate.bind(this),
                );
            });
        }

        // Check for relative dates (1d, 2w, etc.)
        const parsedRelativeDate = this.parseRelativeDate(dueDateValue);
        if (parsedRelativeDate) {
            return dueDateFields.some((field) => {
                const value = this.getUnifiedFieldValue(
                    task,
                    field,
                    taskText,
                    settings,
                    source,
                );
                const formatted = this.formatDate(value);
                return formatted === parsedRelativeDate;
            });
        }

        // Check for specific dates (YYYY-MM-DD)
        return dueDateFields.some((field) => {
            const value = this.getUnifiedFieldValue(
                task,
                field,
                taskText,
                settings,
                source,
            );
            const formatted = this.formatDate(value);
            return formatted === dueDateValue;
        });
    }

    /**
     * Unified filter building for both Dataview and Datacore
     * Creates a filter function that can be applied to tasks from either source
     *
     * @param propertyFilters - Property filters to apply
     * @param settings - Plugin settings
     * @param source - Source type ('dataview' or 'datacore')
     * @returns Filter function, or null if no filters
     */
    static buildUnifiedTaskFilter(
        propertyFilters: {
            priority?: number | number[] | "all" | "any" | "none" | null;
            dueDate?: string | string[] | null;
            dueDateRange?: { start?: string; end?: string } | null;
            status?: string | string[] | null;
            statusValues?: string[] | null;
        },
        settings: PluginSettings,
        source: TaskSource,
    ): ((task: any) => boolean) | null {
        const filters: ((task: any) => boolean)[] = [];

        // Build priority filter
        if (propertyFilters.priority) {
            const priorityFields = this.getAllPriorityFieldNames(settings);

            if (
                propertyFilters.priority ===
                    this.PRIORITY_FILTER_KEYWORDS.all ||
                propertyFilters.priority === this.PRIORITY_FILTER_KEYWORDS.any
            ) {
                // Tasks with ANY priority (P1-P4)
                filters.push((task: any) => {
                    const taskText = this.getTaskText(task, source);
                    return priorityFields.some((field) => {
                        const value = this.getUnifiedFieldValue(
                            task,
                            field,
                            taskText,
                            settings,
                            source,
                        );
                        if (value === undefined || value === null) return false;
                        const mapped = this.mapPriority(value, settings);
                        return (
                            mapped !== undefined && mapped >= 1 && mapped <= 4
                        );
                    });
                });
            } else if (
                propertyFilters.priority === this.PRIORITY_FILTER_KEYWORDS.none
            ) {
                // Tasks with NO priority
                filters.push((task: any) => {
                    const taskText = this.getTaskText(task, source);
                    return !priorityFields.some((field) => {
                        const value = this.getUnifiedFieldValue(
                            task,
                            field,
                            taskText,
                            settings,
                            source,
                        );
                        if (value === undefined || value === null) return false;
                        const mapped = this.mapPriority(value, settings);
                        return mapped !== undefined;
                    });
                });
            } else {
                // Specific priority values
                const targetPriorities = Array.isArray(propertyFilters.priority)
                    ? propertyFilters.priority
                    : [propertyFilters.priority];

                filters.push((task: any) => {
                    const taskText = this.getTaskText(task, source);
                    return priorityFields.some((field) => {
                        const value = this.getUnifiedFieldValue(
                            task,
                            field,
                            taskText,
                            settings,
                            source,
                        );
                        if (value !== undefined && value !== null) {
                            const mapped = this.mapPriority(value, settings);
                            return (
                                mapped !== undefined &&
                                targetPriorities.includes(mapped)
                            );
                        }
                        return false;
                    });
                });
            }
        }

        // Build due date filter
        if (propertyFilters.dueDate) {
            const dueDateFields = this.getAllDueDateFieldNames(settings);
            const dueDateValues = Array.isArray(propertyFilters.dueDate)
                ? propertyFilters.dueDate
                : [propertyFilters.dueDate];

            filters.push((task: any) => {
                for (const dueDateValue of dueDateValues) {
                    if (
                        this.matchesUnifiedDueDateValue(
                            task,
                            dueDateValue,
                            dueDateFields,
                            settings,
                            source,
                        )
                    ) {
                        return true;
                    }
                }
                return false;
            });
        }

        // Build date range filter
        if (propertyFilters.dueDateRange) {
            const dueDateFields = this.getAllDueDateFieldNames(settings);
            const { start, end } = propertyFilters.dueDateRange;

            if (start || end) {
                const startDate = start
                    ? this.parseDateRangeKeyword(start)
                    : null;
                const endDate = end ? this.parseDateRangeKeyword(end) : null;

                filters.push((task: any) => {
                    const taskText = this.getTaskText(task, source);
                    return dueDateFields.some((field) => {
                        const value = this.getUnifiedFieldValue(
                            task,
                            field,
                            taskText,
                            settings,
                            source,
                        );
                        if (!value) return false;

                        const taskDate = moment(this.formatDate(value));

                        if (
                            startDate &&
                            !taskDate.isSameOrAfter(startDate, "day")
                        )
                            return false;
                        if (endDate && !taskDate.isSameOrBefore(endDate, "day"))
                            return false;

                        return true;
                    });
                });
            }
        }

        // Build status filter
        if (propertyFilters.status) {
            const targetStatuses = Array.isArray(propertyFilters.status)
                ? propertyFilters.status
                : [propertyFilters.status];

            filters.push((task: any) => {
                const status =
                    source === "datacore"
                        ? task.$status || task.status
                        : task.status;
                if (status !== undefined) {
                    const mapped = this.mapStatusToCategory(status, settings);
                    return targetStatuses.includes(mapped);
                }
                return false;
            });
        }

        // Build unified status filter (s: syntax)
        if (
            propertyFilters.statusValues &&
            propertyFilters.statusValues.length > 0
        ) {
            filters.push((task: any) => {
                const taskStatus =
                    source === "datacore"
                        ? task.$status || task.status
                        : task.status;
                if (taskStatus === undefined) return false;

                return propertyFilters.statusValues!.some((value) => {
                    if (taskStatus === value) return true;

                    const normalizedValue = value
                        .toLowerCase()
                        .replace(/-/g, "")
                        .replace(/\s+/g, "");

                    for (const [categoryKey, categoryConfig] of Object.entries(
                        settings.taskStatusMapping,
                    )) {
                        if (
                            categoryKey.toLowerCase() === normalizedValue ||
                            categoryKey.toLowerCase().replace(/-/g, "") ===
                                normalizedValue
                        ) {
                            return categoryConfig.symbols.includes(taskStatus);
                        }

                        const aliases = categoryConfig.aliases
                            .toLowerCase()
                            .split(",")
                            .map((a) => a.trim());
                        if (aliases.includes(value.toLowerCase())) {
                            return categoryConfig.symbols.includes(taskStatus);
                        }
                    }

                    return false;
                });
            });
        }

        if (filters.length === 0) return null;

        return (task: any) => filters.every((f) => f(task));
    }
}
