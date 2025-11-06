import { moment } from "obsidian";
import { Task, TaskStatusCategory, DateRange } from "../../models/task";
import { PluginSettings } from "../../settings";
import * as chrono from "chrono-node";
import { Logger } from "../../utils/logger";

/**
 * Moment.js instance type (from window.moment)
 */
interface MomentInstance {
    valueOf(): number;
    format(_format: string): string;
    startOf(_unit: string): MomentInstance;
    endOf(_unit: string): MomentInstance;
    isValid(): boolean;
    isBefore(_date: MomentInstance): boolean;
    isAfter(_date: MomentInstance): boolean;
    isSame(_date: MomentInstance, _unit: string): boolean;
    isSameOrAfter(_date: MomentInstance, _unit: string): boolean;
    isSameOrBefore(_date: MomentInstance, _unit: string): boolean;
    add(_amount: number, _unit: string): MomentInstance;
    subtract(_amount: number, _unit: string): MomentInstance;
    clone(): MomentInstance;
}

/**
 * Moment.js function type (callable function that returns a Moment instance)
 * Uses unknown because moment.js accepts various date-like objects beyond just string/Date/number
 * (e.g., Datacore date objects, moment instances, objects with toString(), etc.)
 */
type MomentFn = {
    (): MomentInstance;
    (_date?: unknown): MomentInstance;
};

/**
 * Global window extensions for Obsidian plugins
 */
interface WindowWithPlugins extends Window {
    moment?: MomentFn;
}

declare const window: WindowWithPlugins;

/**
 * Generic task type for property extraction (supports both Task and Datacore task formats)
 */
export interface GenericTask {
    $text?: string;
    text?: string;
    due?: unknown;
    $due?: unknown;
    priority?: unknown;
    status?: unknown;
    completed?: unknown;
    $completed?: unknown;
    fields?: { [key: string]: unknown };
    [key: string]: unknown;
}

/**
 * Task source type for distinguishing between different task indexing APIs
 */
export type TaskSource = "datacore";

/**
 * Centralized Task Property Service
 *
 * This service consolidates ALL task property operations (status, priority, due date)
 * that were previously duplicated across multiple services:
 * - DatacoreService
 * - TaskSearchService
 * - TaskSortService
 * - PromptBuilderService
 * - PropertyRecognitionService
 * - TaskFilterService
 *
 * Key Principles:
 * 1. Single source of truth for each operation
 * 2. Always respect user settings (taskStatusMapping, etc.)
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
 * 3. AI converts concept DIRECTLY to Datacore format:
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
     * Standard date field names (Datacore compatible)
     * Used across datacoreService, taskFilterService, propertyDetectionService, aiPropertyPromptService
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
     * Used in datacoreService for extracting dates from task text
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
     * Get comprehensive list of all property patterns for removal
     * SHARED PATTERN LIST - Single source of truth for property syntax removal
     *
     * Used by:
     * - TaskSearchService.removePropertySyntax() - Positional removal (beginning/end only)
     * - AiQueryParserService.removeStandardProperties() - Global removal (anywhere)
     *
     * @returns Array of all regex patterns for property syntax
     */
    static getAllPropertyPatterns(): RegExp[] {
        return [
            // Priority patterns
            this.QUERY_PATTERNS.priority,
            this.QUERY_PATTERNS.priorityUnified,

            // Status patterns
            this.QUERY_PATTERNS.status,

            // Due date patterns
            this.QUERY_PATTERNS.dueUnified,
            this.getDueDateKeywordsPattern(),
            this.QUERY_PATTERNS.dueBeforeRange,
            this.QUERY_PATTERNS.dueAfterRange,
            this.QUERY_PATTERNS.dateBeforeRange,
            this.QUERY_PATTERNS.dateAfterRange,

            // Other property patterns
            this.QUERY_PATTERNS.project,
            this.QUERY_PATTERNS.search,
            this.QUERY_PATTERNS.folder,
            this.QUERY_PATTERNS.hashtag,

            // Special keyword patterns
            this.QUERY_PATTERNS.specialKeywordOverdue,
            this.QUERY_PATTERNS.specialKeywordRecurring,
            this.QUERY_PATTERNS.specialKeywordSubtask,
            this.QUERY_PATTERNS.specialKeywordNoDate,
            this.QUERY_PATTERNS.specialKeywordNoPriority,

            // Operators
            this.QUERY_PATTERNS.operators,
        ];
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
     * Returns primary field and aliases
     *
     * @param settings - Plugin settings
     * @returns Array of field names to check for priority
     */
    static getAllPriorityFieldNames(settings: PluginSettings): string[] {
        return [
            settings.datacoreKeys.priority,
            this.PRIORITY_FIELDS.primary,
            ...this.PRIORITY_FIELDS.aliases,
        ];
    }

    /**
     * Get all due date field names to check
     * Returns standard aliases for due dates
     *
     * @param settings - Plugin settings
     * @returns Array of field names to check for due dates
     */
    static getAllDueDateFieldNames(settings: PluginSettings): string[] {
        return [settings.datacoreKeys.dueDate, ...this.DATE_FIELDS.due];
    }

    /**
     * Map a task status symbol to status category
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

        const cleanSymbol = symbol.replace(/[[\]]/g, "").trim();

        // Check user's configured status mapping
        for (const [category, config] of Object.entries(
            settings.taskStatusMapping,
        )) {
            if (config && Array.isArray(config.symbols)) {
                if (config.symbols.some((s) => s === cleanSymbol)) {
                    return category;
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
            const getEffective = (
                key: string,
                config: {
                    symbols: string[];
                    score: number;
                    displayName: string;
                    aliases: string;
                    order?: number;
                    description?: string;
                    terms?: string;
                },
            ): number => {
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
     * Map a priority value to internal numeric priority
     * Supports standard Datacore priority values
     *
     * @param value - Priority value (can be string or number)
     * @param settings - Plugin settings
     * @returns Priority number: 1 (highest), 2 (high), 3 (medium), 4 (low), undefined (none)
     */
    static mapPriority(
        value: unknown,
        settings: PluginSettings,
    ): number | undefined {
        if (value === undefined || value === null) {
            return undefined;
        }

        // Only handle primitive values (string, number, boolean)
        // Objects would produce "[object Object]" which is not useful
        if (typeof value === "object") {
            return undefined;
        }

        // At this point, value is guaranteed to be a primitive type
        const strValue = String(value as string | number | boolean)
            .toLowerCase()
            .trim();

        // Check user's configured priority mapping
        for (const [priority, values] of Object.entries(
            settings.datacorePriorityMapping,
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
     * Handles multiple date object types (Date, moment, Datacore, string)
     *
     * @param date - Date to format (various types supported)
     * @param format - Optional format string (default: YYYY-MM-DD)
     * @returns Formatted date string or undefined
     */
    static formatDate(date: unknown, format?: string): string | undefined {
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
                "format" in date &&
                typeof (date as { format: unknown }).format === "function"
            ) {
                const dateWithFormat = date as {
                    // eslint-disable-next-line no-unused-vars
                    format: (_fmt: string) => string;
                };
                return format
                    ? dateWithFormat.format(format)
                    : dateWithFormat.format("YYYY-MM-DD");
            }

            // Handle Datacore date objects (toString() but not .format())
            if (
                date &&
                typeof date === "object" &&
                "toString" in date &&
                typeof (date as { toString: unknown }).toString === "function"
            ) {
                const dateWithToString = date as { toString: () => string };
                const dateStr = dateWithToString.toString();
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
            const errorMsg = e instanceof Error ? e.message : String(e);
            Logger.error("Error formatting date:", errorMsg);
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
        } catch {
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

    // ==========================================
    // CORE DATE MATCHING HELPER
    // ==========================================

    /**
     * Core helper: Check if a date matches a keyword filter
     * This is the SINGLE SOURCE OF TRUTH for date keyword matching logic
     * All other date methods MUST use this helper to avoid duplication
     *
     * @param dateValue - Date value to check (as moment object or date string)
     * @param keyword - Keyword to match ("today", "overdue", "week", etc.)
     * @returns True if date matches the keyword
     */
    private static matchesDateKeyword(
        dateValue: unknown,
        keyword: string,
    ): boolean {
        const moment = window.moment;
        if (!moment) {
            Logger.warn("[TaskPropertyService] window.moment is not available");
            return false;
        }

        if (!dateValue) return false;

        // Parse date using moment
        const date = moment(dateValue);
        if (!date.isValid()) return false;

        // Normalize to start of day for comparisons
        const dateNormalized = date.startOf("day");
        const today = moment().startOf("day");

        switch (keyword) {
            case "overdue":
            case this.DUE_DATE_KEYWORDS.overdue:
                return dateNormalized.isBefore(today);

            case "future":
            case this.DUE_DATE_KEYWORDS.future:
                return dateNormalized.isAfter(today);

            case "today":
            case this.DUE_DATE_KEYWORDS.today:
                return dateNormalized.isSame(today, "day");

            case "tomorrow":
            case this.DUE_DATE_KEYWORDS.tomorrow:
                return dateNormalized.isSame(
                    today.clone().add(1, "day"),
                    "day",
                );

            case "yesterday":
            case this.DUE_DATE_KEYWORDS.yesterday:
                return dateNormalized.isSame(
                    today.clone().subtract(1, "day"),
                    "day",
                );

            case "week":
            case this.DUE_DATE_KEYWORDS.week: {
                const startOfWeek = moment().startOf("week");
                const endOfWeek = moment().endOf("week");
                return (
                    dateNormalized.isSameOrAfter(startOfWeek, "day") &&
                    dateNormalized.isSameOrBefore(endOfWeek, "day")
                );
            }

            case "last-week":
            case this.DUE_DATE_KEYWORDS.lastWeek: {
                const startOfLastWeek = moment()
                    .subtract(1, "week")
                    .startOf("week");
                const endOfLastWeek = moment()
                    .subtract(1, "week")
                    .endOf("week");
                return (
                    dateNormalized.isSameOrAfter(startOfLastWeek, "day") &&
                    dateNormalized.isSameOrBefore(endOfLastWeek, "day")
                );
            }

            case "next-week":
            case this.DUE_DATE_KEYWORDS.nextWeek: {
                const startOfNextWeek = moment().add(1, "week").startOf("week");
                const endOfNextWeek = moment().add(1, "week").endOf("week");
                return (
                    dateNormalized.isSameOrAfter(startOfNextWeek, "day") &&
                    dateNormalized.isSameOrBefore(endOfNextWeek, "day")
                );
            }

            case "month":
            case this.DUE_DATE_KEYWORDS.month: {
                const startOfMonth = moment().startOf("month");
                const endOfMonth = moment().endOf("month");
                return (
                    dateNormalized.isSameOrAfter(startOfMonth, "day") &&
                    dateNormalized.isSameOrBefore(endOfMonth, "day")
                );
            }

            case "last-month":
            case this.DUE_DATE_KEYWORDS.lastMonth: {
                const startOfLastMonth = moment()
                    .subtract(1, "month")
                    .startOf("month");
                const endOfLastMonth = moment()
                    .subtract(1, "month")
                    .endOf("month");
                return (
                    dateNormalized.isSameOrAfter(startOfLastMonth, "day") &&
                    dateNormalized.isSameOrBefore(endOfLastMonth, "day")
                );
            }

            case "next-month":
            case this.DUE_DATE_KEYWORDS.nextMonth: {
                const startOfNextMonth = moment()
                    .add(1, "month")
                    .startOf("month");
                const endOfNextMonth = moment().add(1, "month").endOf("month");
                return (
                    dateNormalized.isSameOrAfter(startOfNextMonth, "day") &&
                    dateNormalized.isSameOrBefore(endOfNextMonth, "day")
                );
            }

            case "year":
            case this.DUE_DATE_KEYWORDS.year: {
                const startOfYear = moment().startOf("year");
                const endOfYear = moment().endOf("year");
                return (
                    dateNormalized.isSameOrAfter(startOfYear, "day") &&
                    dateNormalized.isSameOrBefore(endOfYear, "day")
                );
            }

            case "last-year":
            case this.DUE_DATE_KEYWORDS.lastYear: {
                const startOfLastYear = moment()
                    .subtract(1, "year")
                    .startOf("year");
                const endOfLastYear = moment()
                    .subtract(1, "year")
                    .endOf("year");
                return (
                    dateNormalized.isSameOrAfter(startOfLastYear, "day") &&
                    dateNormalized.isSameOrBefore(endOfLastYear, "day")
                );
            }

            case "next-year":
            case this.DUE_DATE_KEYWORDS.nextYear: {
                const startOfNextYear = moment().add(1, "year").startOf("year");
                const endOfNextYear = moment().add(1, "year").endOf("year");
                return (
                    dateNormalized.isSameOrAfter(startOfNextYear, "day") &&
                    dateNormalized.isSameOrBefore(endOfNextYear, "day")
                );
            }

            default:
                return false;
        }
    }

    /**
     * Filter tasks by due date using moment for consistent date handling
     * OPTIMIZED: Uses moment from Obsidian API instead of native Date objects
     *
     * Handles: any, today, tomorrow, overdue, future, week, next-week, +Nd/+Nw/+Nm, specific dates
     *
     * @param tasks - Array of tasks to filter
     * @param filter - Date filter keyword or date string
     * @returns Filtered array of tasks
     */
    static filterByDueDate(tasks: Task[], filter: string): Task[] {
        const moment = window.moment;
        if (!moment) {
            Logger.warn(
                "[TaskPropertyService] window.moment is not available, cannot filter by due date",
            );
            return tasks; // Return all tasks if moment unavailable
        }

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

            // Try keyword matching first (uses core helper)
            if (this.matchesDateKeyword(task.dueDate, filter)) {
                return true;
            }

            // Handle relative dates (+Nd, +Nw, +Nm)
            if (filter.startsWith("+")) {
                const relativeMatch = filter.match(/^\+(\d+)([dwm])$/);
                if (relativeMatch) {
                    const amount = parseInt(relativeMatch[1]);
                    const unit = relativeMatch[2];
                    const today = moment().startOf("day");
                    let targetDate = today.clone();

                    if (unit === "d") {
                        targetDate = targetDate.add(amount, "days");
                    } else if (unit === "w") {
                        targetDate = targetDate.add(amount, "weeks");
                    } else if (unit === "m") {
                        targetDate = targetDate.add(amount, "months");
                    }

                    const dueDate = moment(task.dueDate).startOf("day");
                    return (
                        dueDate.isValid() && dueDate.isSame(targetDate, "day")
                    );
                }
            }

            // Try specific date match using moment
            const targetDate = moment(filter);
            if (targetDate.isValid()) {
                const dueDate = moment(task.dueDate).startOf("day");
                return (
                    dueDate.isValid() &&
                    dueDate.isSame(targetDate.startOf("day"), "day")
                );
            }

            return false;
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

    // ==========================================
    // CORE STATUS MATCHING HELPER
    // ==========================================

    /**
     * Core helper: Match a single status value against category/alias/symbol
     * This is the SINGLE SOURCE OF TRUTH for status matching logic
     * All other status methods MUST use this helper to avoid duplication
     *
     * @param value - Status value to check (e.g., "open", "wip", "x", "b")
     * @param settings - Plugin settings with taskStatusMapping
     * @returns Match result with detailed information, or null if no match
     */
    private static matchStatusValue(
        value: string,
        settings: PluginSettings,
    ): {
        matched: boolean;
        categoryKey: string;
        matchType: "category" | "alias" | "symbol";
        originalValue: string;
    } | null {
        if (!value) return null;

        const lowerValue = value.toLowerCase();

        // Check user-configured categories first
        for (const [categoryKey, config] of Object.entries(
            settings.taskStatusMapping,
        )) {
            // Check if value matches category key
            if (categoryKey.toLowerCase() === lowerValue) {
                return {
                    matched: true,
                    categoryKey,
                    matchType: "category",
                    originalValue: value,
                };
            }

            // Check if value matches any alias
            if (config.aliases) {
                const aliases = config.aliases
                    .split(",")
                    .map((a) => a.trim().toLowerCase());
                if (aliases.includes(lowerValue)) {
                    return {
                        matched: true,
                        categoryKey,
                        matchType: "alias",
                        originalValue: value,
                    };
                }
            }

            // Check if value matches any symbol
            if (config.symbols && Array.isArray(config.symbols)) {
                // Check both exact match and lowercase match
                if (
                    config.symbols.includes(value) ||
                    config.symbols.some((s) => s.toLowerCase() === lowerValue)
                ) {
                    return {
                        matched: true,
                        categoryKey,
                        matchType: "symbol",
                        originalValue: value,
                    };
                }
            }
        }

        // Fallback: Check default status config
        for (const [categoryKey, defaultConfig] of Object.entries(
            this.DEFAULT_STATUS_CONFIG,
        )) {
            // Check if value matches default category key
            if (categoryKey.toLowerCase() === lowerValue) {
                return {
                    matched: true,
                    categoryKey,
                    matchType: "category",
                    originalValue: value,
                };
            }

            // Check if value matches default terms
            const terms = defaultConfig.terms
                .split(",")
                .map((t) => t.trim().toLowerCase());
            if (terms.includes(lowerValue)) {
                return {
                    matched: true,
                    categoryKey,
                    matchType: "alias",
                    originalValue: value,
                };
            }
        }

        return null;
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
        Logger.debug(`[resolveStatusValue] Attempting to resolve: "${value}"`);

        const match = this.matchStatusValue(value, settings);

        if (match) {
            Logger.debug(
                `[resolveStatusValue] ✓ Matched ${match.matchType}: "${value}" → category "${match.categoryKey}"`,
            );
            return match.categoryKey;
        }

        Logger.warn(
            `[resolveStatusValue] ✗ No match found for "${value}" in user settings or defaults`,
        );
        Logger.warn(
            `[resolveStatusValue] If "${value}" is a custom category, please verify:`,
        );
        Logger.warn(
            `[resolveStatusValue]   1. Category key matches "${value}"`,
        );
        Logger.warn(
            `[resolveStatusValue]   2. Aliases include "${value}" (comma-separated, no quotes)`,
        );
        Logger.warn(`[resolveStatusValue]   3. Symbols array is not empty`);
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
            .filter((v): v is string => v !== null);

        // Remove duplicates
        return [...new Set(resolved)];
    }

    /**
     * Resolve status search values (category names, aliases, OR symbols) to symbols
     * Handles the key difference between category and symbol searches:
     * - Category/alias search: Returns ALL symbols for that category
     * - Direct symbol search: Returns ONLY that specific symbol
     *
     * Examples:
     * - "open" (category) → [" "] (all symbols for open)
     * - "wip" (alias for inProgress) → ["/"] (all symbols for inProgress)
     * - "b" (direct symbol) → ["b"] (only that symbol, not all symbols in category)
     * - "important" (category with symbols !, I, b) → ["!", "I", "b"] (all)
     *
     * @param values - Array of status values from user query (can be categories, aliases, or symbols)
     * @param settings - Plugin settings with taskStatusMapping
     * @returns Array of status symbols to use in Datacore query
     */
    static resolveStatusValuesToSymbols(
        values: string[],
        settings: PluginSettings,
    ): string[] {
        const symbols: string[] = [];

        Logger.debug(
            `[resolveStatusValuesToSymbols] Resolving ${values.length} values: [${values.join(", ")}]`,
        );

        for (const value of values) {
            const match = this.matchStatusValue(value, settings);

            if (match) {
                const categoryConfig =
                    settings.taskStatusMapping[match.categoryKey];

                if (match.matchType === "symbol") {
                    // Direct symbol match → return ONLY that symbol
                    symbols.push(match.originalValue);
                    Logger.debug(
                        `[resolveStatusValuesToSymbols]   "${value}" matched direct symbol in category "${match.categoryKey}" → symbol: [${match.originalValue}] (not all symbols!)`,
                    );
                } else {
                    // Category or alias match → return ALL symbols for that category
                    if (
                        categoryConfig &&
                        categoryConfig.symbols &&
                        categoryConfig.symbols.length > 0
                    ) {
                        symbols.push(...categoryConfig.symbols);
                        Logger.debug(
                            `[resolveStatusValuesToSymbols]   "${value}" matched ${match.matchType} "${match.categoryKey}" → symbols: [${categoryConfig.symbols.join(", ")}]`,
                        );
                    }
                }
            } else {
                Logger.warn(
                    `[resolveStatusValuesToSymbols]   "${value}" did not match any category, alias, or symbol`,
                );
            }
        }

        // Remove duplicates
        const uniqueSymbols = [...new Set(symbols)];
        Logger.debug(
            `[resolveStatusValuesToSymbols] Final symbols: [${uniqueSymbols.join(", ")}]`,
        );

        return uniqueSymbols;
    }

    /**
     * Convert status category keys to status symbols
     * Handles all cases: standard categories, custom categories, "other" category
     * Used by both Filter UI and Search/Chat workflows
     *
     * @param statusCategories - Array of category keys (e.g., ["open", "inProgress"])
     * @param settings - Plugin settings with taskStatusMapping
     * @returns Object with statusValues (symbols) and statusExclusions (for "other")
     */
    static convertStatusCategoriesToSymbols(
        statusCategories: string[],
        settings: PluginSettings,
    ): {
        statusValues?: string[];
        statusExclusions?: string[];
    } {
        const statusSymbols: string[] = [];
        const hasOtherCategory = statusCategories.includes("other");

        Logger.debug(
            `[convertStatusCategoriesToSymbols] Converting ${statusCategories.length} categories: [${statusCategories.join(", ")}]`,
        );
        Logger.debug(
            `[convertStatusCategoriesToSymbols] Available in settings: [${Object.keys(settings.taskStatusMapping).join(", ")}]`,
        );

        // Special handling for "other" category
        // "other" should EXCLUDE all symbols defined in other categories
        let statusExclusions: string[] | undefined;
        if (hasOtherCategory) {
            const allDefinedSymbols: string[] = [];
            for (const [categoryKey, statusConfig] of Object.entries(
                settings.taskStatusMapping,
            )) {
                if (
                    categoryKey !== "other" &&
                    statusConfig &&
                    statusConfig.symbols &&
                    statusConfig.symbols.length > 0
                ) {
                    allDefinedSymbols.push(...statusConfig.symbols);
                }
            }

            statusExclusions = allDefinedSymbols;
            Logger.debug(
                `[convertStatusCategoriesToSymbols] "other" category: excluding symbols [${allDefinedSymbols.join(", ")}]`,
            );
        }

        // Handle regular categories (not "other")
        const regularCategories = statusCategories.filter(
            (cat) => cat !== "other",
        );

        for (const categoryKey of regularCategories) {
            const statusConfig = settings.taskStatusMapping[categoryKey];
            if (statusConfig && statusConfig.symbols) {
                Logger.debug(
                    `[convertStatusCategoriesToSymbols]   "${categoryKey}" -> symbols: [${statusConfig.symbols.join(", ")}]`,
                );
                // Add all symbols for this category (handles multiple symbols per category)
                statusSymbols.push(...statusConfig.symbols);
            } else if (
                statusConfig &&
                (!statusConfig.symbols || statusConfig.symbols.length === 0)
            ) {
                Logger.warn(
                    `[convertStatusCategoriesToSymbols] ⚠️ Category "${categoryKey}" exists but has NO symbols configured!`,
                );
                Logger.warn(
                    `[convertStatusCategoriesToSymbols]    Please add symbols in Settings > Task Chat > Task Status Categories`,
                );
            } else {
                Logger.warn(
                    `[convertStatusCategoriesToSymbols] ⚠️ Category "${categoryKey}" not found in taskStatusMapping!`,
                );
                Logger.warn(
                    `[convertStatusCategoriesToSymbols]    Available categories: [${Object.keys(settings.taskStatusMapping).join(", ")}]`,
                );
                Logger.warn(
                    `[convertStatusCategoriesToSymbols]    This may have been resolved via alias - check resolveStatusValue logs above`,
                );
            }
        }

        const result: {
            statusValues?: string[];
            statusExclusions?: string[];
        } = {};

        // Only add if we found symbols (avoid empty array)
        if (statusSymbols.length > 0) {
            result.statusValues = statusSymbols;
            Logger.debug(
                `[convertStatusCategoriesToSymbols] Final status symbols: [${statusSymbols.join(", ")}]`,
            );
        } else if (!hasOtherCategory) {
            Logger.warn(
                `[convertStatusCategoriesToSymbols] No symbols found for categories: ${statusCategories.join(", ")}`,
            );
        }

        if (statusExclusions && statusExclusions.length > 0) {
            result.statusExclusions = statusExclusions;
        }

        return result;
    }

    /**
     * Check if a date value matches a due date keyword
     * Centralized date matching logic for all due date keywords
     *
     * @param dateValue - The date value from task field (Datacore format)
     * @param keyword - The keyword to match against (today, tomorrow, overdue, etc.)
     * @param formatDate - Function to format date value to YYYY-MM-DD
     * @returns True if the date matches the keyword
     */
    static matchesDueDateKeyword(
        dateValue: unknown,
        keyword: string,
        // eslint-disable-next-line no-unused-vars
        formatDate: (_date: unknown) => string | undefined,
    ): boolean {
        if (!dateValue) return false;

        // Format the date value first, then use core helper
        const formatted = formatDate(dateValue);
        if (!formatted) return false;

        // Delegate to core helper for all keyword matching
        return this.matchesDateKeyword(formatted, keyword);
    }

    /**
     * Parse date range keyword to moment date
     * Centralized date range parsing for week-start, month-end, etc.
     *
     * @param keyword - The date range keyword
     * @returns Moment date object or null if moment unavailable
     */
    static parseDateRangeKeyword(keyword: string): MomentInstance | null {
        const moment = window.moment;
        if (!moment) {
            Logger.warn(
                "[TaskPropertyService] window.moment is not available, cannot parse date range keyword",
            );
            return null;
        }

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
     * Compatible with Datacore API relative date syntax
     *
     * @param relativeDate - Relative date string (e.g., "1d", "+2w", "-3m", "1y")
     * @returns Formatted date string (YYYY-MM-DD) or null if invalid
     */
    static parseRelativeDate(relativeDate: string): string | null {
        const moment = window.moment;
        if (!moment) {
            Logger.warn(
                "[TaskPropertyService] window.moment is not available, cannot parse relative date",
            );
            return null;
        }

        // Match pattern: optional +/-, number, unit (d/w/m/y)
        // Supports: 1d, +1d, -1d, 1w, +1w, -1w, 1m, +1m, -1m, 1y, +1y, -1y
        const match = relativeDate.match(/^([+-]?)(\d+)([dwmy])$/i);
        if (!match) return null;

        const sign = match[1] || "+"; // Default to + if no sign
        const amount = parseInt(match[2]);
        const unit = match[3].toLowerCase();

        // Map unit to moment unit
        const unitMap: { [key: string]: string } = {
            d: "days",
            w: "weeks",
            m: "months",
            y: "years",
        };

        const momentUnit = unitMap[unit];
        if (!momentUnit) return null;

        // Calculate target date
        let targetDate: MomentInstance;
        if (sign === "-") {
            targetDate = moment().subtract(
                amount,
                momentUnit as "days" | "weeks" | "months" | "years",
            );
        } else {
            targetDate = moment().add(
                amount,
                momentUnit as "days" | "weeks" | "months" | "years",
            );
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
    // Used by DatacoreService
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
    // FIELD EXTRACTION (Datacore)
    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

    /**
     * Get task text from Datacore task object
     * @param task - Task object from Datacore
     * @returns Task text
     */
    private static getTaskText(task: GenericTask): string {
        // Always use Datacore format
        return task.$text || task.text || "";
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
     * Get standard field mapping for a given field key
     * Returns array of Datacore standard field names to check
     */
    private static getStandardFieldMapping(fieldKey: string): string[] {
        const fieldMap: { [key: string]: string[] } = {};

        // Datacore: $ prefix for built-ins
        fieldMap["due"] = ["$due"];
        fieldMap["dueDate"] = ["$due"];
        fieldMap["deadline"] = ["$due"];
        fieldMap["completion"] = ["$completion"];
        fieldMap["completed"] = ["$completion"];
        fieldMap["completedDate"] = ["$completion"];
        fieldMap["created"] = ["$created"];
        fieldMap["createdDate"] = ["$created"];
        fieldMap["start"] = ["$start"];
        fieldMap["startDate"] = ["$start"];
        fieldMap["scheduled"] = ["$scheduled"];
        fieldMap["scheduledDate"] = ["$scheduled"];
        fieldMap["priority"] = ["$priority"];
        fieldMap["p"] = ["$priority"];
        fieldMap["pri"] = ["$priority"];
        fieldMap["prio"] = ["$priority"];
        fieldMap["tags"] = ["$tags"];
        fieldMap["file"] = ["$file"];
        fieldMap["path"] = ["$file"];

        return fieldMap[fieldKey] || [];
    }

    /**
     * Field value extraction for Datacore
     * Handles different task object structures transparently
     *
     * @param task - Task object from Datacore
     * @param fieldKey - Field name to extract
     * @param text - Task text for fallback extraction
     * @returns Field value, or undefined if not found
     */
    static getUnifiedFieldValue(
        task: GenericTask,
        fieldKey: string,
        text: string,
    ): unknown {
        // Strategy 1: Check Datacore built-in fields
        // Try $ prefix first for Datacore built-ins
        const builtInKey = this.getDatacoreBuiltInKey(fieldKey);
        if (builtInKey && task[builtInKey] !== undefined) {
            return task[builtInKey];
        }

        // Try direct property
        if (task[fieldKey] !== undefined) {
            return task[fieldKey];
        }

        // Strategy 2: Check fields object
        if (task.fields && task.fields[fieldKey] !== undefined) {
            return task.fields[fieldKey];
        }

        // Strategy 3: Check standard fields
        const standardFields = this.getStandardFieldMapping(fieldKey);
        for (const standardField of standardFields) {
            if (task[standardField] !== undefined) {
                return task[standardField];
            }
            if (task.fields && task.fields[standardField] !== undefined) {
                return task.fields[standardField];
            }
        }

        // Strategy 4: Extract emoji shorthands from text
        const emojiValue = this.extractEmojiShorthand(text, fieldKey);
        if (emojiValue !== undefined) {
            return emojiValue;
        }

        // Strategy 5: Extract from inline field syntax
        const inlineValue = this.extractInlineField(text, fieldKey);
        if (inlineValue !== undefined) {
            return inlineValue;
        }

        return undefined;
    }

    /**
     * Due date matching for Datacore
     * Checks if a task matches a specific due date value
     *
     * @param task - Task object from Datacore
     * @param dueDateValue - Due date value to match against
     * @param dueDateFields - Array of due date field names to check
     * @returns True if task matches the due date value
     */
    static matchesUnifiedDueDateValue(
        task: GenericTask,
        dueDateValue: string,
        dueDateFields: string[],
    ): boolean {
        const taskText = this.getTaskText(task);

        // Check for "all"/"any" - has any due date
        if (
            dueDateValue === this.DUE_DATE_FILTER_KEYWORDS.all ||
            dueDateValue === this.DUE_DATE_FILTER_KEYWORDS.any
        ) {
            return dueDateFields.some((field) => {
                const value = this.getUnifiedFieldValue(task, field, taskText);
                return value !== undefined && value !== null;
            });
        }

        // Check for "none" - no due date
        if (dueDateValue === this.DUE_DATE_FILTER_KEYWORDS.none) {
            return !dueDateFields.some((field) => {
                const value = this.getUnifiedFieldValue(task, field, taskText);
                return value !== undefined && value !== null;
            });
        }

        // Check for date keywords (today, overdue, etc.)
        const dueDateKeywords = Object.values(
            this.DUE_DATE_KEYWORDS,
        ) as string[];
        if (dueDateKeywords.includes(dueDateValue)) {
            return dueDateFields.some((field) => {
                const value = this.getUnifiedFieldValue(task, field, taskText);
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
                const value = this.getUnifiedFieldValue(task, field, taskText);
                const formatted = this.formatDate(value);
                return formatted === parsedRelativeDate;
            });
        }

        // Check for specific dates (YYYY-MM-DD)
        return dueDateFields.some((field) => {
            const value = this.getUnifiedFieldValue(task, field, taskText);
            const formatted = this.formatDate(value);
            return formatted === dueDateValue;
        });
    }

    /**
     * Filter building for Datacore
     * Creates a filter function that can be applied to tasks from Datacore
     *
     * @param propertyFilters - Property filters to apply
     * @param settings - Plugin settings
     * @returns Filter function, or null if no filters
     */
    static buildUnifiedTaskFilter(
        propertyFilters: {
            priority?: number | number[] | "all" | "any" | "none" | null;
            dueDate?: string | string[] | null;
            dueDateRange?: DateRange | null;
            status?: string | string[] | null;
            statusValues?: string[] | null;
        },
        settings: PluginSettings,
        // eslint-disable-next-line no-unused-vars
    ): ((_task: GenericTask) => boolean) | null {
        // eslint-disable-next-line no-unused-vars
        const filters: ((_task: GenericTask) => boolean)[] = [];

        // Build priority filter
        if (propertyFilters.priority) {
            const priorityFields = this.getAllPriorityFieldNames(settings);

            if (
                propertyFilters.priority ===
                    this.PRIORITY_FILTER_KEYWORDS.all ||
                propertyFilters.priority === this.PRIORITY_FILTER_KEYWORDS.any
            ) {
                // Tasks with ANY priority (P1-P4)
                filters.push((task: GenericTask) => {
                    const taskText = this.getTaskText(task);
                    return priorityFields.some((field) => {
                        const value = this.getUnifiedFieldValue(
                            task,
                            field,
                            taskText,
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
                filters.push((task: GenericTask) => {
                    const taskText = this.getTaskText(task);
                    return !priorityFields.some((field) => {
                        const value = this.getUnifiedFieldValue(
                            task,
                            field,
                            taskText,
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

                filters.push((task: GenericTask) => {
                    const taskText = this.getTaskText(task);
                    return priorityFields.some((field) => {
                        const value = this.getUnifiedFieldValue(
                            task,
                            field,
                            taskText,
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

            filters.push((task: GenericTask) => {
                for (const dueDateValue of dueDateValues) {
                    if (
                        this.matchesUnifiedDueDateValue(
                            task,
                            dueDateValue,
                            dueDateFields,
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

                // OPTIMIZATION: Pre-compute start/end timestamps for faster comparison
                const startTimestamp = startDate
                    ? startDate.startOf("day").valueOf()
                    : null;
                const endTimestamp = endDate
                    ? endDate.endOf("day").valueOf()
                    : null;

                // OPTIMIZATION: Cache extracted dates to avoid re-parsing
                const dateCache = new Map<string, number | null>();

                filters.push((task: GenericTask) => {
                    // Generate cache key from task
                    const taskRecord = task as Record<string, unknown>;
                    const taskId = `${String(taskRecord.$file ?? taskRecord.file)}:${String(taskRecord.$line ?? taskRecord.line)}`;

                    // Check cache first
                    let taskTimestamp: number | null;
                    if (dateCache.has(taskId)) {
                        // taskTimestamp is guaranteed to exist in cache when has() returns true
                        taskTimestamp = dateCache.get(taskId) ?? null;
                    } else {
                        // Extract and parse date (only once per task)
                        const taskText = this.getTaskText(task);
                        taskTimestamp = null; // Initialize to null

                        for (const field of dueDateFields) {
                            const value = this.getUnifiedFieldValue(
                                task,
                                field,
                                taskText,
                            );
                            if (value) {
                                const taskDate = moment(this.formatDate(value));
                                if (taskDate.isValid()) {
                                    taskTimestamp = taskDate
                                        .startOf("day")
                                        .valueOf();
                                    break;
                                }
                            }
                        }

                        // Cache the result (either found timestamp or null)
                        dateCache.set(taskId, taskTimestamp);
                    }

                    // If no date found, exclude task
                    if (taskTimestamp === null) return false;

                    // Fast timestamp comparison (no moment objects needed)
                    if (
                        startTimestamp !== null &&
                        taskTimestamp < startTimestamp
                    )
                        return false;
                    if (endTimestamp !== null && taskTimestamp > endTimestamp)
                        return false;

                    return true;
                });
            }
        }

        // Build status filter
        if (propertyFilters.status) {
            const targetStatuses = Array.isArray(propertyFilters.status)
                ? propertyFilters.status
                : [propertyFilters.status];

            filters.push((task: GenericTask) => {
                const status = task.$status || task.status;
                if (typeof status === "string") {
                    const mapped = this.mapStatusToCategory(status, settings);
                    return targetStatuses.includes(mapped);
                }
                return false;
            });
        }

        // Build unified status filter (s: syntax)
        // OPTIMIZED: Pre-resolve status values once instead of for each task
        if (
            propertyFilters.statusValues &&
            propertyFilters.statusValues.length > 0
        ) {
            // Pre-resolve all status values to category keys (O(M) operation)
            const resolvedCategories = this.resolveStatusValues(
                propertyFilters.statusValues,
                settings,
            );

            // If no valid categories resolved, skip this filter
            if (resolvedCategories.length === 0) {
                Logger.warn(
                    "No valid status categories resolved from filter values",
                );
            } else {
                filters.push((task: GenericTask) => {
                    const taskStatus = task.$status || task.status;
                    if (typeof taskStatus !== "string") return false;

                    // Map task status to category and check if it's in resolved list (O(1) operation)
                    const mappedCategory = this.mapStatusToCategory(
                        taskStatus,
                        settings,
                    );
                    return resolvedCategories.includes(mappedCategory);
                });
            }
        }

        if (filters.length === 0) return null;

        return (task: GenericTask) => filters.every((f) => f(task));
    }
}
