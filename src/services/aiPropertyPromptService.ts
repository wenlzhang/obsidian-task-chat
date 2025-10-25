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
        const keywords = TaskPropertyService.DUE_DATE_KEYWORDS;

        return `
DUE DATE MAPPING (normalize to values):

"${keywords.any}" = tasks WITH due date ("due tasks", "deadline tasks", "scheduled")
"${keywords.today}" = due today (今天, today, idag)
"${keywords.tomorrow}" = due tomorrow (明天, tomorrow, imorgon)
"${keywords.overdue}" = past due (过期, overdue, late, försenad)
"${keywords.future}" = future (未来, upcoming, framtida)
"${keywords.week}" = this week (本周, denna vecka)
"${keywords.nextWeek}" = next week (下周, nästa vecka)
YYYY-MM-DD = specific dates

Distinction: "due tasks" = "${keywords.any}" (any) | "overdue" = "${keywords.overdue}" (specific)
`;
    }

    /**
     * Build STATUS VALUE MAPPING for AI parser
     * Maps various phrases to normalized status values
     * Now DYNAMIC: includes all custom status categories from user's taskStatusMapping
     */
    static buildStatusValueMapping(settings: PluginSettings): string {
        const statusExamples = Object.entries(settings.taskStatusMapping)
            .map(([key, config]) => {
                const termSuggestions = this.inferStatusTerms(key, settings);
                return `"${key}" = ${config.displayName} (${termSuggestions})`;
            })
            .join(" | ");

        return `
STATUS MAPPING (recognize concepts → category keys):

${statusExamples}

Terminology: Key = internal ("open"), Display = UI ("Open"), Alias = query terms ("wip"), Symbol = checkbox ("[/]")

Values:
- Single: status: "open"
- Multiple: status: ["open", "inprogress"]
- Any: status: null (rare)

Query patterns: Category ("s:inprogress"), Display ("in progress"), Alias ("wip"), Symbol ("s:/"), Mixed ("s:open,/,wip")

⚠️ Use native understanding to map concepts to keys.
`;
    }
}
