import { PluginSettings } from "../settings";

/**
 * Property Recognition Service
 *
 * Provides three-layer property term recognition:
 * Layer 1: User-configured terms (highest priority)
 * Layer 2: Internal embedded mappings (fallback)
 * Layer 3: Semantic expansion (AI-powered, broadest coverage)
 *
 * Used across ALL modes: Simple Search, Smart Search, Task Chat
 */
export class PropertyRecognitionService {
    /**
     * Internal embedded mappings - Core property terms in multiple languages
     * These serve as fallback when user hasn't configured custom terms
     *
     * Architecture: Internal mappings + User terms → Combined → Semantic expansion
     */
    private static INTERNAL_PRIORITY_TERMS = {
        // General priority terms (any priority)
        general: [
            "priority",
            "important",
            "urgent",
            "优先级",
            "优先",
            "重要",
            "紧急",
            "prioritet",
            "viktig",
            "brådskande",
        ],
        // High priority specific
        high: [
            "high",
            "highest",
            "critical",
            "top",
            "高",
            "最高",
            "关键",
            "首要",
            "hög",
            "högst",
            "kritisk",
        ],
        // Medium priority specific
        medium: ["medium", "normal", "中", "中等", "普通", "medel", "normal"],
        // Low priority specific
        low: ["low", "minor", "低", "次要", "不重要", "låg", "mindre"],
    };

    private static INTERNAL_DUE_DATE_TERMS = {
        // General due date terms (any due date)
        general: [
            "due",
            "deadline",
            "scheduled",
            "截止日期",
            "到期",
            "期限",
            "计划",
            "förfallodatum",
            "deadline",
            "schemalagd",
        ],
        // Time-specific
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
    };

    private static INTERNAL_STATUS_TERMS = {
        open: [
            "open",
            "pending",
            "todo",
            "incomplete",
            "未完成",
            "待办",
            "进行中",
            "öppen",
            "väntande",
        ],
        completed: [
            "done",
            "completed",
            "finished",
            "完成",
            "已完成",
            "结束",
            "klar",
            "färdig",
            "slutförd",
        ],
        inProgress: [
            "working",
            "in progress",
            "ongoing",
            "进行中",
            "正在做",
            "pågående",
            "arbetar på",
        ],
    };

    /**
     * Get combined property terms (user-configured + internal mappings)
     * This is used for regex matching in Simple Search mode and as base for semantic expansion
     *
     * @param settings Plugin settings containing user-configured terms
     * @returns Combined property terms ready for use
     */
    static getCombinedPropertyTerms(settings: PluginSettings) {
        return {
            priority: {
                general: [
                    ...this.INTERNAL_PRIORITY_TERMS.general,
                    ...settings.userPropertyTerms.priority,
                ],
                high: this.INTERNAL_PRIORITY_TERMS.high,
                medium: this.INTERNAL_PRIORITY_TERMS.medium,
                low: this.INTERNAL_PRIORITY_TERMS.low,
            },
            dueDate: {
                general: [
                    ...this.INTERNAL_DUE_DATE_TERMS.general,
                    ...settings.userPropertyTerms.dueDate,
                ],
                today: this.INTERNAL_DUE_DATE_TERMS.today,
                tomorrow: this.INTERNAL_DUE_DATE_TERMS.tomorrow,
                overdue: this.INTERNAL_DUE_DATE_TERMS.overdue,
                thisWeek: this.INTERNAL_DUE_DATE_TERMS.thisWeek,
                nextWeek: this.INTERNAL_DUE_DATE_TERMS.nextWeek,
                future: this.INTERNAL_DUE_DATE_TERMS.future,
            },
            status: {
                open: [
                    ...this.INTERNAL_STATUS_TERMS.open,
                    ...settings.userPropertyTerms.status,
                ],
                completed: this.INTERNAL_STATUS_TERMS.completed,
                inProgress: this.INTERNAL_STATUS_TERMS.inProgress,
            },
        };
    }

    /**
     * Build property term mappings for AI query parser prompt
     * Combines user-configured terms with internal mappings
     * Used in Smart Search and Task Chat modes for semantic expansion
     *
     * @param settings Plugin settings
     * @param queryLanguages User-configured languages for semantic expansion
     * @returns Formatted string for AI prompt
     */
    static buildPropertyTermMappingsForParser(
        settings: PluginSettings,
        queryLanguages: string[],
    ): string {
        const combined = this.getCombinedPropertyTerms(settings);
        const languageList = queryLanguages.join(", ");

        return `
🚨 PROPERTY TERM RECOGNITION (Three-Layer System)

You have access to three layers of property term recognition:

LAYER 1: User-Configured Terms (Highest Priority)
${settings.userPropertyTerms.priority.length > 0 ? `- Priority: ${settings.userPropertyTerms.priority.join(", ")}` : "- Priority: (none configured)"}
${settings.userPropertyTerms.dueDate.length > 0 ? `- Due Date: ${settings.userPropertyTerms.dueDate.join(", ")}` : "- Due Date: (none configured)"}
${settings.userPropertyTerms.status.length > 0 ? `- Status: ${settings.userPropertyTerms.status.join(", ")}` : "- Status: (none configured)"}

LAYER 2: Internal Embedded Mappings (Fallback)
These are built-in terms that work across languages:

Priority Terms:
- General: ${combined.priority.general.slice(0, 10).join(", ")}...
- High: ${combined.priority.high.slice(0, 8).join(", ")}...
- Medium: ${combined.priority.medium.join(", ")}
- Low: ${combined.priority.low.slice(0, 8).join(", ")}...

Due Date Terms:
- General: ${combined.dueDate.general.slice(0, 10).join(", ")}...
- Today: ${combined.dueDate.today.join(", ")}
- Tomorrow: ${combined.dueDate.tomorrow.join(", ")}
- Overdue: ${combined.dueDate.overdue.slice(0, 8).join(", ")}...
- This Week: ${combined.dueDate.thisWeek.join(", ")}
- Next Week: ${combined.dueDate.nextWeek.join(", ")}
- Future: ${combined.dueDate.future.slice(0, 8).join(", ")}...

Status Terms:
- Open: ${combined.status.open.slice(0, 8).join(", ")}...
- Completed: ${combined.status.completed.slice(0, 8).join(", ")}...
- In Progress: ${combined.status.inProgress.slice(0, 8).join(", ")}...

LAYER 3: Semantic Expansion (You provide this!)
- Apply semantic expansion to ALL property terms across configured languages: ${languageList}
- Generate semantic equivalents DIRECTLY in each language
- This enables cross-language property recognition

PROPERTY EXPANSION FLOW (Like Keywords):

Step 1: Identify Core Property Terms
- Extract property-related terms from query
- Example: "优先级任务" → core property term: "优先级"
- Example: "with due date" → core property term: "due date"

Step 2: Apply Semantic Expansion
- Expand EACH core property term into ALL ${queryLanguages.length} languages: ${languageList}
- Generate semantic equivalents DIRECTLY in each language
- Example: "优先级" (Chinese) → 
  * English: priority, important, urgent, critical, high-priority
  * 中文: 优先级, 优先, 重要, 紧急, 关键
  * Swedish: prioritet, viktig, brådskande, kritisk, hög-prioritet

Step 3: Match Against Combined Terms (Layer 1 + Layer 2)
- Check expanded terms against user-configured terms (Layer 1)
- Check expanded terms against internal mappings (Layer 2)
- Extract structured property values (priority, dueDate, status)

Step 4: Separate Property Terms from Keywords
- Property terms → structured filters (priority, dueDate, status fields)
- Content keywords → keywords array (for text matching)
- Example: "urgent bug fix" → 
  * Property: priority = 1 (from "urgent")
  * Keywords: ["bug", "fix"]
`;
    }

    /**
     * Build DUE DATE VALUE MAPPING for AI parser
     * Maps various phrases to normalized dueDate values
     */
    static buildDueDateValueMapping(): string {
        return `
DUE DATE VALUE MAPPING (normalize to these values):

IMPORTANT: There's a difference between:
1. Asking for tasks WITH a property (any value)
2. Asking for tasks with SPECIFIC property value

DUE DATE NORMALIZATION:
- "any" = tasks that HAVE a due date (用户要求"有截止日期的任务", "含有deadline", "scheduled tasks", "with due date")
- "today" = tasks due TODAY only (今天, today, due today, 今天到期, idag)
- "tomorrow" = tasks due TOMORROW only (明天, tomorrow, imorgon, due tomorrow)
- "overdue" = past due tasks (过期, 逾期, 延迟, overdue, past due, late, försenad)
- "future" = future tasks (未来, 将来, future, upcoming, later, framtida, kommande)
- "week" = this week (本周, this week, 这周, denna vecka, 本周内)
- "next-week" = next week (下周, next week, nästa vecka, 下周内)
- Specific dates in YYYY-MM-DD format

KEY DISTINCTION:
- "due tasks" or "deadline tasks" = "any" (has a due date) ✅
- "overdue tasks" = "overdue" (specific value) ✅
- "tasks due today" = "today" (specific value) ✅

Be smart about implied meanings:
- "deadline" alone → "any" (has deadline)
- "expired" → "overdue" (past due)
- "upcoming" → "future" (future tasks)
`;
    }

    /**
     * Build PRIORITY VALUE MAPPING for AI parser
     */
    static buildPriorityValueMapping(settings: PluginSettings): string {
        const mapping = settings.dataviewPriorityMapping;
        const lines: string[] = [];

        if (mapping[1] && mapping[1].length > 0) {
            lines.push(
                `- 1 = highest/high priority (${mapping[1].join(", ")})`,
            );
        }
        if (mapping[2] && mapping[2].length > 0) {
            lines.push(`- 2 = medium priority (${mapping[2].join(", ")})`);
        }
        if (mapping[3] && mapping[3].length > 0) {
            lines.push(`- 3 = low priority (${mapping[3].join(", ")})`);
        }
        if (mapping[4] && mapping[4].length > 0) {
            lines.push(`- 4 = none/no priority (${mapping[4].join(", ")})`);
        }

        return `
PRIORITY VALUE MAPPING (User-Configured DataView values):
${lines.join("\n")}

IMPORTANT: Similar to due dates, there's a difference:
1. Asking for tasks WITH priority (any value) → priority: null
2. Asking for tasks with SPECIFIC priority → priority: 1, 2, 3, or 4

KEY DISTINCTION:
- "priority tasks" or "important tasks" → null (has any priority) ✅
- "high priority" or "urgent" → 1 (specific value) ✅
- "medium priority" → 2 (specific value) ✅
- "low priority" → 3 (specific value) ✅
`;
    }

    /**
     * Build STATUS VALUE MAPPING for AI parser
     */
    static buildStatusValueMapping(settings: PluginSettings): string {
        const names = settings.taskStatusDisplayNames;

        return `
STATUS VALUE MAPPING (User-Configured):
- "open" = ${names.open || "Open"} tasks (incomplete, pending, todo, 未完成, 待办, öppen)
- "completed" = ${names.completed || "Completed"} tasks (done, finished, 完成, 已完成, klar, färdig)
- "inProgress" = ${names.inProgress || "In progress"} tasks (working on, ongoing, 进行中, 正在做, pågående)

STATUS DISTINCTION:
- Query about status → extract "open", "completed", or "inProgress"
- General task queries → no status filter needed
`;
    }

    /**
     * Simple regex-based property recognition for Simple Search mode
     * Uses combined terms (user + internal) for regex matching
     *
     * @param query User's search query
     * @param settings Plugin settings
     * @returns Detected property hints for Simple Search
     */
    static detectPropertiesSimple(
        query: string,
        settings: PluginSettings,
    ): {
        hasPriority: boolean;
        hasDueDate: boolean;
        hasStatus: boolean;
    } {
        const combined = this.getCombinedPropertyTerms(settings);
        const lowerQuery = query.toLowerCase();

        // Check for priority terms
        const hasPriority =
            combined.priority.general.some((term) =>
                lowerQuery.includes(term.toLowerCase()),
            ) ||
            combined.priority.high.some((term) =>
                lowerQuery.includes(term.toLowerCase()),
            ) ||
            combined.priority.medium.some((term) =>
                lowerQuery.includes(term.toLowerCase()),
            ) ||
            combined.priority.low.some((term) =>
                lowerQuery.includes(term.toLowerCase()),
            );

        // Check for due date terms
        const hasDueDate =
            combined.dueDate.general.some((term) =>
                lowerQuery.includes(term.toLowerCase()),
            ) ||
            combined.dueDate.today.some((term) =>
                lowerQuery.includes(term.toLowerCase()),
            ) ||
            combined.dueDate.tomorrow.some((term) =>
                lowerQuery.includes(term.toLowerCase()),
            ) ||
            combined.dueDate.overdue.some((term) =>
                lowerQuery.includes(term.toLowerCase()),
            ) ||
            combined.dueDate.thisWeek.some((term) =>
                lowerQuery.includes(term.toLowerCase()),
            ) ||
            combined.dueDate.nextWeek.some((term) =>
                lowerQuery.includes(term.toLowerCase()),
            ) ||
            combined.dueDate.future.some((term) =>
                lowerQuery.includes(term.toLowerCase()),
            );

        // Check for status terms
        const hasStatus =
            combined.status.open.some((term) =>
                lowerQuery.includes(term.toLowerCase()),
            ) ||
            combined.status.completed.some((term) =>
                lowerQuery.includes(term.toLowerCase()),
            ) ||
            combined.status.inProgress.some((term) =>
                lowerQuery.includes(term.toLowerCase()),
            );

        return {
            hasPriority,
            hasDueDate,
            hasStatus,
        };
    }
}
