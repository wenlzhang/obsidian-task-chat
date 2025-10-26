import { PluginSettings } from "../settings";
import { TaskPropertyService } from "./taskPropertyService";
import { PromptBuilderService } from "./aiPromptBuilderService";

/**
 * AI Property Prompt Service
 *
 * AI-ONLY service for building property-related prompts for LLM query parsing
 *
 * Used by: Smart Search, Task Chat (AI-powered query parsing)
 * NOT used by: Simple Search
 */
export class AIPropertyPromptService {
    /**
     * Get semantic term suggestions based on category key
     * Delegates to TaskPropertyService for consistent behavior
     *
     * @param categoryKey - The category key (stable identifier)
     * @param settings - Plugin settings with taskStatusMapping
     * @returns Multilingual semantic terms for this category
     */
    private static inferStatusTerms(
        categoryKey: string,
        settings: PluginSettings,
    ): string {
        return TaskPropertyService.inferStatusTerms(categoryKey, settings);
    }

    /**
     * Build property term mappings for AI query parser prompt
     * Delegates to PromptBuilderService for centralized prompt generation
     *
     * @param settings Plugin settings
     * @param queryLanguages User-configured languages for semantic expansion
     * @returns Formatted string for AI prompt
     */
    static buildPropertyTermMappingsForParser(
        settings: PluginSettings,
        queryLanguages: string[],
    ): string {
        // Use centralized prompt builder
        return PromptBuilderService.buildPropertyTermGuidance(
            settings,
            queryLanguages,
        );
    }

    /**
     * Build DUE DATE VALUE MAPPING for AI parser
     * Maps various phrases to normalized dueDate values
     * Uses centralized constants from TaskPropertyService
     */
    static buildDueDateValueMapping(): string {
        // Use centralized due date keywords
        const keywords = TaskPropertyService.DUE_DATE_KEYWORDS;

        return `
DUE DATE VALUE MAPPING (normalize to these values):

IMPORTANT: There's a difference between:
1. Asking for tasks WITH a property (any value)
2. Asking for tasks with SPECIFIC property value

This guidance is consumed by the AI Query Parser, Property Prompt Builder, Task Chat prompts, etc. It uses the centralized keywords from TaskPropertyService so that every service shares the exact same vocabulary. Remember: urgency weighting (how "important" each bucket is) comes from the user's configurable scores in settings (dueDateOverdueScore, dueDateWithin7DaysScore, etc.). You only normalize the concept — scoring happens downstream.

🚦 PRESENCE FILTERS
- "${keywords.any}" / "${keywords.all}" = tasks that HAVE a due date (用户要求"有截止日期的任务", "含有deadline", "with due date")
- "${keywords.none}" = tasks with NO due date (无截止时间, no deadline)

🕒 SPECIFIC DAYS
- "${keywords.today}" = due TODAY (今天, today, 今天到期, idag)
- "${keywords.tomorrow}" = due TOMORROW (明天, tomorrow, imorgon)
- "${keywords.yesterday}" = due YESTERDAY (昨天, yesterday)

📆 WEEKLY WINDOWS
- "${keywords.week}" = due THIS week (本周, this week, 本周内, denna vecka)
- "${keywords.lastWeek}" = due LAST week (上周, last week, förra veckan)
- "${keywords.nextWeek}" = due NEXT week (下周, next week, nästa vecka)

🗓️ MONTHLY WINDOWS
- "${keywords.month}" = due THIS month (本月, this month, 本月内)
- "${keywords.lastMonth}" = due LAST month (上个月, last month)
- "${keywords.nextMonth}" = due NEXT month (下个月, next month)

📅 YEARLY WINDOWS
- "${keywords.year}" = due THIS year (今年, this year)
- "${keywords.lastYear}" = due LAST year (去年, last year)
- "${keywords.nextYear}" = due NEXT year (明年, next year)

📆 SPECIFIC RANGES
- "${keywords.overdue}" = past due (过期, 逾期, overdue, past due, late, försenad)
- "${keywords.future}" = future tasks with a due date (未来, 将来, future, upcoming, later, kommande)

KEY DISTINCTION:
- "due tasks" or "deadline tasks" → "${keywords.any}" (has a due date) ✅
- "no deadline" or "no due date" → "${keywords.none}" (no due date) ✅
- "overdue tasks" → "${keywords.overdue}" (specific range) ✅
- "tasks due today" → "${keywords.today}" (specific value) ✅

Be smart about implied meanings using concept recognition (no term matching only!):
- "deadline" alone → "${keywords.any}" (has deadline)
- "expired" → "${keywords.overdue}" (past due)
- "upcoming" / "即将到来" / "kommande" → "${keywords.future}" (future tasks)
- Natural language ranges like "later this month" → map to the closest bucket ("${keywords.month}" or a specific date) using context
- Specific calendar references ("2025-10-20", "next Friday") should be normalized to explicit dates when possible
`;
    }

    /**
     * Build STATUS VALUE MAPPING for AI parser
     * Maps various phrases to normalized status values
     * Now DYNAMIC: includes all custom status categories from user's taskStatusMapping
     */
    static buildStatusValueMapping(settings: PluginSettings): string {
        // Build status normalization examples dynamically from user settings
        // Uses pattern matching on display names to infer appropriate semantic terms
        const statusExamples = Object.entries(settings.taskStatusMapping)
            .map(([key, config]) => {
                // Get semantic terms based on category key (stable)
                const termSuggestions = this.inferStatusTerms(key, settings);

                return `- "${key}" = ${config.displayName} tasks (${termSuggestions})`;
            })
            .join("\n");

        // Build key distinction examples dynamically (first 5 categories)
        const distinctionExamples = Object.entries(settings.taskStatusMapping)
            .slice(0, 5)
            .map(([key, config]) => {
                const displayName = config.displayName.toLowerCase();
                return `- "${displayName} tasks" → "${key}" (specific value) ✅`;
            })
            .join("\n");

        return `
STATUS CATEGORY MAPPING (recognize concepts, convert to category keys):

TERMINOLOGY:
- Category Key: Internal identifier (e.g., "open", "inprogress", "completed")
- Display Name: User-facing label (e.g., "Open", "In Progress", "Completed")
- Alias: Alternative query terms (e.g., "wip", "doing", "active")
- Symbol: Checkbox symbol (e.g., "[/]", "[x]")

IMPORTANT: There's a difference between:
1. Asking for tasks WITH a status property (any value) → status: null
2. Asking for tasks with SPECIFIC status category → status: "open", "inprogress", etc.
3. Asking for multiple status categories → status: ["open", "inprogress"]

STATUS NORMALIZATION (User-Configured - supports custom categories):
${statusExamples}

KEY DISTINCTION:
- "status tasks" or "with status" = null (has any status - rarely used) ✅
${distinctionExamples}

USER QUERY INTENT:
1. Query by category key: "s:inprogress" → status: "inprogress"
2. Query by display name: "in progress tasks" → status: "inprogress"
3. Query by alias: "wip tasks" → status: "inprogress"
4. Query by symbol: "s:/" → tasks with [/] symbol
5. Mixed query: "s:open,/,wip" → ["open", symbol [/], "inprogress"]

Be smart about implied meanings and synonyms - use native language understanding to map concepts to category keys.
`;
    }
}
