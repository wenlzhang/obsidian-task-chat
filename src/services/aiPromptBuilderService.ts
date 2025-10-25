import { PluginSettings, SortCriterion } from "../settings";
import { TaskPropertyService } from "./taskPropertyService";

/**
 * Shared utility service for building AI prompt components
 * Used by both AIService (task analysis) and QueryParserService (query parsing)
 *
 * This ensures consistency across all AI interactions and avoids code duplication
 */
export class PromptBuilderService {
    /**
     * Get status description based on category key
     * Delegates to TaskPropertyService for consistent behavior
     */
    private static inferStatusDescription(
        categoryKey: string,
        settings: PluginSettings,
    ): string {
        return TaskPropertyService.inferStatusDescription(
            categoryKey,
            settings,
        );
    }

    /**
     * Get status term suggestions based on category key
     * Delegates to TaskPropertyService for consistent behavior
     */
    private static inferStatusTermSuggestions(
        categoryKey: string,
        settings: PluginSettings,
    ): string {
        return TaskPropertyService.inferStatusTerms(categoryKey, settings);
    }

    /**
     * Build priority mapping documentation from user settings
     * Used in both query parsing and task analysis prompts
     */
    static buildPriorityMapping(settings: PluginSettings): string {
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

        return `\nPRIORITY MAPPING (Dataview format [${settings.dataviewKeys.priority}::value]):\n${lines.join("\n")}\n\nWhen users ask for tasks by priority, search using these values.`;
    }

    /**
     * Build priority mapping for query parser (more concise format)
     * Used specifically in QueryParserService for parsing natural language
     */
    static buildPriorityMappingForParser(
        settings: PluginSettings,
        queryLanguages: string[],
    ): string {
        const languageList = queryLanguages.join(", ");
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

        const baseMapping =
            lines.length > 0
                ? `PRIORITY MAPPING (User-Configured):\n${lines.join("\n")}`
                : `PRIORITY MAPPING:\n- 1 = highest/high priority\n- 2 = medium priority\n- 3 = low priority\n- 4 = none/no priority`;

        return `${baseMapping}

⚠️ EXPAND PRIORITY TERMS ACROSS ALL ${queryLanguages.length} LANGUAGES: ${languageList}
Generate semantic equivalents for priority levels in EACH configured language.

IMPORTANT DISTINCTION:
1. Asking for tasks WITH priority (any value) → priority: null
2. Asking for tasks with SPECIFIC priority → priority: 1, 2, 3, or 4

EXAMPLES:
- "priority tasks" or "tasks with priority" → null (has any priority) ✅
- "high priority" or "urgent" → 1 (specific value) ✅
- "medium priority" → 2 (specific value) ✅
- "low priority" → 3 (specific value) ✅

⚠️ NOTE: If "important" is a STATUS category (check STATUS MAPPING section), "important" refers to STATUS, not priority!`;
    }

    /**
     * Build date format documentation from user settings (all date types)
     * Used in task analysis prompts
     */
    static buildDateFormats(settings: PluginSettings): string {
        const keys = settings.dataviewKeys;
        return `
DATE FORMATS (Dataview):
- Due date: [${keys.dueDate}::YYYY-MM-DD] - Users may ask for "due today", "overdue", "this week", etc.
- Created date: [${keys.createdDate}::YYYY-MM-DD] - When the task was created
- Completed date: [${keys.completedDate}::YYYY-MM-DD] - When the task was finished
Users may reference tasks by any of these dates.`;
    }

    /**
     * Build date field names for query parser
     * Used in QueryParserService to recognize field name variations
     * Uses centralized field names from TaskPropertyService
     */
    static buildDateFieldNamesForParser(settings: PluginSettings): string {
        const keys = settings.dataviewKeys;
        // Use centralized date field names from TaskPropertyService
        const dueDateFields = TaskPropertyService.DATE_FIELDS.due.join('", "');
        const createdFields =
            TaskPropertyService.DATE_FIELDS.created.join('", "');
        const completedFields =
            TaskPropertyService.DATE_FIELDS.completion.join('", "');

        return `DATE FIELD NAMES (User-Configured):
Users may use these field names in queries - recognize all variations:
- Due date: "${keys.dueDate}", "${dueDateFields}"
- Created date: "${keys.createdDate}", "${createdFields}"
- Completed date: "${keys.completedDate}", "${completedFields}"`;
    }

    /**
     * Build task status mapping from user settings
     * Used in task analysis prompts
     * Dynamically includes all user-defined status categories
     */
    static buildStatusMapping(settings: PluginSettings): string {
        const categories = Object.entries(settings.taskStatusMapping)
            .map(([key, config]) => {
                // Get description based on category key (stable)
                const description = this.inferStatusDescription(key, settings);
                return `- ${config.displayName} (${key}): ${description}`;
            })
            .join("\n");

        const statusTerms = Object.entries(settings.taskStatusMapping)
            .map(([key, config]) => {
                // Get semantic terms based on category key (stable)
                const termSuggestions = this.inferStatusTermSuggestions(
                    key,
                    settings,
                );
                return `  - ${config.displayName} (${key}): ${termSuggestions}`;
            })
            .join("\n");

        return `
TASK STATUS CATEGORIES (User-Configured):
${categories}

Use the category key (in parentheses) when referring to status in structured data.
Use the display name when showing status to users.`;
    }

    /**
     * Build status mapping for query parser (comprehensive format with dynamic categories)
     * Used in QueryParserService for parsing natural language
     * Dynamically includes all user-defined status categories from taskStatusMapping
     */
    static buildStatusMappingForParser(
        settings: PluginSettings,
        queryLanguages: string[],
    ): string {
        const languageList = queryLanguages.join(", ");
        const categoryKeys = Object.keys(settings.taskStatusMapping);
        const categoryList = categoryKeys.map((k) => `"${k}"`).join(", ");

        // Build examples for each category dynamically from user settings
        const categoryExamples = Object.entries(settings.taskStatusMapping)
            .map(([key, config]) => {
                // Get semantic terms based on category key (stable)
                const termSuggestions = this.inferStatusTermSuggestions(
                    key,
                    settings,
                );
                return `- "${key}" = ${config.displayName} tasks (${termSuggestions})`;
            })
            .join("\n");

        return `STATUS CATEGORY MAPPING (User-Configured - Dynamic):

TERMINOLOGY CLARIFICATION:
- Category Key: Internal identifier (stable, used in code) - e.g., "open", "inprogress", "completed"
- Display Name: User-facing label (customizable, shown in UI) - e.g., "Open", "In Progress", "Completed"
- Alias: Alternative query terms (flexible, user-defined) - e.g., "wip", "doing", "active"
- Symbol: Checkbox symbol (direct matching) - e.g., "[/]", "[x]"

Category keys must be EXACTLY one of: ${categoryList}

⚠️ The system supports CUSTOM STATUS CATEGORIES defined by the user!
⚠️ Use your NATIVE LANGUAGE UNDERSTANDING to recognize status concepts in ALL languages: ${languageList}
NO expansion needed - recognize concepts directly and convert to category keys!

Current status categories:
${categoryExamples}

Your task: Recognize status concepts in user's query (ANY language) and convert to category keys.

🔑 CRITICAL DISAMBIGUATION RULES:
1. If a word/phrase EXACTLY MATCHES a status category name (e.g., "${categoryKeys[0]}", "${categoryKeys[1]}"), interpret it as a STATUS FILTER FIRST
2. When user says just "${categoryKeys.map((k) => settings.taskStatusMapping[k].displayName.toLowerCase()).join('", "')}" (without "tasks"), assume they mean that status
3. Only interpret as keywords if the term does NOT match any status category

STATUS DISTINCTION:
1. Asking for tasks WITH status (any value) → status: null (rare, usually unnecessary)
2. Asking for tasks with SPECIFIC status category → status: "${categoryKeys[0]}", "${categoryKeys[1]}", etc.
3. Asking for multiple status categories → status: ["${categoryKeys[0]}", "${categoryKeys[1]}"]

RECOGNITION EXAMPLES (using current categories):
${Object.entries(settings.taskStatusMapping)
    .slice(0, 4)
    .map(([key, config]) => {
        const displayLower = config.displayName.toLowerCase();
        return `- "${displayLower}" → Recognize concept → status: "${key}" ✅\n- "${displayLower} tasks" → Recognize concept → status: "${key}" ✅`;
    })
    .join("\n")}

MULTILINGUAL RECOGNITION (IMPORTANT!):
${Object.entries(settings.taskStatusMapping)
    .slice(0, 3)
    .map(([key, config]) => {
        const displayLower = config.displayName.toLowerCase();
        return `- "${displayLower}" (English) → Recognize concept → status: "${key}" ✅\n- Use native understanding for other languages → status: "${key}" ✅`;
    })
    .join("\n")}

USER QUERY PATTERNS:
1. Natural language: "in progress tasks" → Recognize IN_PROGRESS concept → status: "inprogress"
2. Alias: "wip tasks" → Match alias → status: "inprogress"
3. Symbol syntax: "s:/" → Match symbol → tasks with [/] symbol
4. Multiple: "s:open,wip,/" → ["open", "inprogress", symbol [/]]`;
    }

    /**
     * Build recommendation limits based on user settings
     * Used in task analysis prompts to guide AI on how many tasks to recommend
     */
    static buildRecommendationLimits(settings: PluginSettings): string {
        return `
CORE RECOMMENDATION PHILOSOPHY:
⚠️ Users prefer comprehensive task lists over curated subsets
⚠️ Maximum allowed: ${settings.maxRecommendations} tasks
⚠️ Goal: Show ALL relevant work, let users decide what to focus on
⚠️ Only exclude tasks that are clearly irrelevant to the query

Remember: Inclusion > Exclusion. When in doubt, include the task!`;
    }

    /**
     * Build sort order explanation based on user's actual configuration
     * Used in task analysis prompts to explain how tasks are ordered
     */
    static buildSortOrderExplanation(sortOrder: SortCriterion[]): string {
        // Convert criteria to human-readable names
        const criteriaNames = sortOrder.map((criterion) => {
            switch (criterion) {
                case "relevance":
                    return "keyword relevance";
                case "dueDate":
                    return "due date";
                case "priority":
                    return "priority level";
                case "created":
                    return "creation date";
                case "alphabetical":
                    return "alphabetical order";
                default:
                    return criterion;
            }
        });

        // Build primary sort description
        const primaryCriterion = sortOrder[0];
        let primaryDescription = "";

        switch (primaryCriterion) {
            case "relevance":
                primaryDescription = "keyword relevance (best matches first)";
                break;
            case "dueDate":
                primaryDescription = "urgency (overdue → today → future)";
                break;
            case "priority":
                primaryDescription = "priority (1=highest → 4=lowest)";
                break;
            case "created":
                primaryDescription = "recency (newest → oldest)";
                break;
            case "alphabetical":
                primaryDescription = "alphabetical order (A → Z)";
                break;
        }

        // Build complete explanation
        const sortChain = criteriaNames.join(" → ");

        // Build criterion-specific explanations ONLY for criteria actually in use
        const criteriaDetails: string[] = [];
        sortOrder.forEach((criterion) => {
            switch (criterion) {
                case "relevance":
                    criteriaDetails.push(
                        "Relevance: Higher keyword match scores first (100 → 0, best matches at top)",
                    );
                    break;
                case "priority":
                    criteriaDetails.push(
                        "Priority: Highest priority first (1=highest → 2 → 3 → 4=lowest, urgent tasks at top)",
                    );
                    break;
                case "dueDate":
                    criteriaDetails.push(
                        "Due date: Most urgent first (overdue → today → future → no due date, earliest deadlines at top)",
                    );
                    break;
                case "created":
                    criteriaDetails.push(
                        "Created date: Newest tasks first (recent → older, latest work at top)",
                    );
                    break;
                case "alphabetical":
                    criteriaDetails.push(
                        "Alphabetical: Standard order (A → Z)",
                    );
                    break;
            }
        });

        return `
TASK ORDERING (User-Configured):
⚠️ CRITICAL: Tasks are PRE-SORTED based on user's criteria before reaching you!

Multi-criteria sort order: ${sortChain}
- Primary sort: ${primaryDescription}
- Secondary/tertiary sorts break ties when primary criteria are equal

⚠️ IMPORTANT IMPLICATIONS FOR YOUR RECOMMENDATIONS:
- [TASK_1], [TASK_2], [TASK_3] are at the TOP because they rank highest by these criteria
- [TASK_90], [TASK_91], [TASK_92] are at the BOTTOM because they rank lowest
- Earlier task IDs = MORE relevant/urgent/important (based on sort criteria)
- When many tasks match the query, PRIORITIZE EARLIER TASK IDs (lower numbers)
- The system already did the sorting - you should respect and leverage this ordering

Sort criteria in use (in priority order):
${criteriaDetails.map((detail) => `  * ${detail}`).join("\n")}

⚠️ ACTION: When recommending tasks, start with lower task IDs and work your way up. Tasks near [TASK_1] are the most aligned with user's needs based on the sort criteria!`;
    }

    /**
     * Build metadata guidance explaining how task properties are structured
     * Used in task analysis prompts to ensure AI correctly interprets task metadata
     */
    static buildMetadataGuidance(settings: PluginSettings): string {
        // Get user's configured values
        const statusNames = Object.values(settings.taskStatusMapping)
            .map((config) => config.displayName)
            .join(", ");
        const priorityMappings = Object.entries(
            settings.dataviewPriorityMapping,
        )
            .map(([k, v]) => `${v[0] || k}=${k}`)
            .join(", ");

        return `
IMPORTANT: UNDERSTANDING TASK METADATA (User-Configured)
- Each task is displayed with its text content AND structured metadata
- ONLY use metadata shown explicitly - do NOT infer properties from task text

⚠️ IMPORTANT: RAW DATAVIEW SYNTAX IN TASK TEXT
You will see tasks with BOTH:
1. Original task text (may contain raw Dataview syntax)
2. Extracted metadata below each task (clean, structured format)

Example:
  [TASK_1] Fix bug [due::2025-10-20] 🗓️ 2025-10-20 [p::1] ⏫
    Status: Open | Priority: 1 | Due: 2025-10-20

WHY you see raw syntax in text:
- Raw syntax ([due::DATE], 🗓️ DATE, ⏫) is how users store metadata in their vault
- We keep it in task text for vault compatibility
- BUT we've ALREADY extracted it using Dataview API

WHAT YOU MUST DO:
→ Use ONLY the structured metadata (e.g., "Priority: 1", "Due: 2025-10-20")
→ Do NOT try to parse [due::2025-10-20] or 🗓️ 2025-10-20 from the task text
→ If you see BOTH raw syntax in text AND clean metadata, trust the metadata
→ The raw syntax is already processed - you don't need to interpret it

Common raw Dataview formats you might see in text (already extracted for you):
- Inline fields: [${settings.dataviewKeys.dueDate}::2025-10-20], [${settings.dataviewKeys.priority}::1]
- Emoji dates: 🗓️ 2025-10-20 (due), ✅ 2025-10-15 (completed), ➕ 2025-10-10 (created)
- Priority emojis: ⏫ (high), 🔼 (medium), 🔽 (low)

METADATA FIELD REFERENCE (User's Configuration):

- **Status**: Display names = (${statusNames})
  * Appears as: "Status: Open" (not "status: open" or [ ] checkbox)
  
- **Priority**: Values = (${priorityMappings})
  * Appears as: "Priority: 1" or "Priority: high" (user's first configured value)
  * Lower numbers = higher priority (1=highest, 4=lowest)
  * Vault field: "${settings.dataviewKeys.priority}"
  
- **Due date**: Vault field = "${settings.dataviewKeys.dueDate}"
  * Appears as: "Due: 2025-10-20" (clean date format)
  * If NO "Due:" in metadata → task has NO due date
  
- **Created date**: Vault field = "${settings.dataviewKeys.createdDate}"
  * Appears as: "Created: 2025-10-15" (when task was created)
  
- **Completed date**: Vault field = "${settings.dataviewKeys.completedDate}"
  * Appears as: "Completed: 2025-10-18" (when task was finished)
  
- **Folder**: Task's vault location (e.g., "Projects/Work")
- **Tags**: Task's tags (e.g., "#urgent #coding")

REMEMBER: All these fields are extracted from Dataview syntax and shown as clean metadata. Always use the metadata values, never try to parse raw syntax from task text!`;
    }

    /**
     * Build comprehensive property term guidance for AI prompts
     * Combines base terms + user-configured terms + status category terms
     * Respects ALL user settings and configured languages
     *
     * Used in query parsing to help AI recognize property terms across all layers
     *
     * @param settings - Plugin settings with all user configuration
     * @param queryLanguages - List of languages configured by user
     * @returns Formatted property term guidance for AI prompts
     */
    static buildPropertyTermGuidance(
        settings: PluginSettings,
        queryLanguages: string[],
    ): string {
        // Get combined terms from TaskPropertyService
        const combined = {
            priority: TaskPropertyService.getCombinedPriorityTerms(settings),
            dueDate: TaskPropertyService.getCombinedDueDateTerms(settings),
            status: TaskPropertyService.getCombinedStatusTerms(settings),
        };

        const languageList = queryLanguages.join(", ");

        // Build comprehensive guidance
        return `
🚨 PROPERTY TERM RECOGNITION (Three-Layer System)

You have access to three layers of property term recognition:

LAYER 1: User-Configured Terms (Highest Priority)
${settings.userPropertyTerms.priority.length > 0 ? `- Priority: ${settings.userPropertyTerms.priority.join(", ")}` : "- Priority: (none configured)"}
${settings.userPropertyTerms.dueDate.length > 0 ? `- Due Date: ${settings.userPropertyTerms.dueDate.join(", ")}` : "- Due Date: (none configured)"}
${settings.userPropertyTerms.status.length > 0 ? `- Status: ${settings.userPropertyTerms.status.join(", ")}` : "- Status: (none configured)"}

LAYER 2: Base Terms (Built-in, Multilingual)

Priority Terms:
- General: ${combined.priority.general.slice(0, 10).join(", ")}${combined.priority.general.length > 10 ? "..." : ""}
- High: ${combined.priority.high.slice(0, 8).join(", ")}${combined.priority.high.length > 8 ? "..." : ""}
- Medium: ${combined.priority.medium.join(", ")}
- Low: ${combined.priority.low.slice(0, 8).join(", ")}${combined.priority.low.length > 8 ? "..." : ""}

Due Date Terms:
- General: ${combined.dueDate.general.slice(0, 10).join(", ")}${combined.dueDate.general.length > 10 ? "..." : ""}
- Today: ${combined.dueDate.today.join(", ")}
- Tomorrow: ${combined.dueDate.tomorrow.join(", ")}
- Overdue: ${combined.dueDate.overdue.slice(0, 8).join(", ")}${combined.dueDate.overdue.length > 8 ? "..." : ""}
- This Week: ${combined.dueDate.thisWeek.join(", ")}
- Next Week: ${combined.dueDate.nextWeek.join(", ")}
- Future: ${combined.dueDate.future.slice(0, 8).join(", ")}${combined.dueDate.future.length > 8 ? "..." : ""}

Status Terms:
- General: ${combined.status.general.slice(0, 8).join(", ")}${combined.status.general.length > 8 ? "..." : ""}
${Object.entries(combined.status)
    .filter(([key]) => key !== "general")
    .map(([key, terms]) => {
        const categoryConfig = settings.taskStatusMapping[key];
        const displayName = categoryConfig?.displayName || key;
        return `- ${displayName}: ${terms.slice(0, 8).join(", ")}${terms.length > 8 ? "..." : ""}`;
    })
    .join("\n")}

LAYER 3: Native Language Understanding (You provide this!)
- Use your multilingual training to recognize property concepts in ANY language
- NO expansion needed - direct concept recognition and conversion!
- This enables cross-language property recognition automatically

PROPERTY RECOGNITION FLOW (Different from Keywords!):

Step 1: Identify Property Concepts in Query
- Recognize property-related concepts (not just terms)
- Example: "优先级任务" → Recognize PRIORITY concept
- Example: "with due date" → Recognize DUE_DATE concept

Step 2: Use Native Language Understanding
- Recognize property concepts in user's query (ANY language)
- Use your training to understand what the user means
- Example: "in progress" (English) → Recognize IN_PROGRESS concept
- Example: "进行中" (Chinese) → Recognize IN_PROGRESS concept
- Example: "pågående" (Swedish) → Recognize IN_PROGRESS concept

Step 3: Convert to Category Keys (Layer 1 + Layer 2 help with this)
- Map recognized concepts to internal category keys
- Check against user-configured terms (Layer 1) for aliases
- Check against base terms (Layer 2) for defaults
- Convert to structured values: "inprogress", 1, "overdue", etc.

Step 4: Separate Property Concepts from Content Keywords
- Property concepts → structured filters (priority, dueDate, status fields)
- Content keywords → keywords array (for text matching)
- Example: "urgent bug fix" → 
  * Property: priority = 1 (recognized URGENCY concept)
  * Keywords: ["bug", "fix"] (content terms)
`;
    }
}
