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
        const categoryKeys = Object.keys(settings.taskStatusMapping);
        const categoryList = categoryKeys.map((k) => `"${k}"`).join(", ");

        // Build examples for each category dynamically from user settings
        const categoryExamples = Object.entries(settings.taskStatusMapping)
            .map(([key, config]) => {
                const termSuggestions = this.inferStatusTermSuggestions(
                    key,
                    settings,
                );
                return `- "${key}" = ${config.displayName} (${termSuggestions})`;
            })
            .join("\n");

        return `STATUS MAPPING (User-Configured, ${categoryKeys.length} categories):

Valid keys: ${categoryList}
${categoryExamples}

DISAMBIGUATION:
1. Status category name → STATUS filter (highest priority)
2. Not a status category → check priority/dueDate/keywords
Examples: "${categoryKeys.map((k) => settings.taskStatusMapping[k].displayName.toLowerCase()).join('", "')}" → status: "${categoryKeys[0]}", "${categoryKeys[1]}", etc.

STATUS VALUES:
- Single: status: "${categoryKeys[0]}"
- Multiple: status: ["${categoryKeys[0]}", "${categoryKeys[1]}"]
- Any: status: null (rare)

RECOGNITION (ANY language):
${Object.entries(settings.taskStatusMapping)
    .slice(0, 3)
    .map(
        ([key, config]) =>
            `"${config.displayName.toLowerCase()}" → status: "${key}"`,
    )
    .join(" | ")}

Query patterns: Natural ("in progress tasks"), Alias ("wip"), Symbol ("s:/"), Multiple ("s:open,wip,/")`;
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
        const criteriaMap: Record<
            string,
            { name: string; desc: string; detail: string; scoring: string }
        > = {
            relevance: {
                name: "keyword relevance",
                desc: "best matches",
                detail: "Higher keyword match (100 → 0)",
                scoring:
                    "Comprehensive score: (coreKeywordRatio × coreWeight + allKeywordRatio × 1.0) × relevanceCoefficient",
            },
            dueDate: {
                name: "due date",
                desc: "urgency",
                detail: "Most urgent (overdue → today → future)",
                scoring:
                    "Time-range score: overdue=1.5, 7days=1.0, month=0.5, later=0.2, none=0.1 (× dueDateCoefficient)",
            },
            priority: {
                name: "priority",
                desc: "importance",
                detail: "Highest first (1 → 4)",
                scoring:
                    "Priority-level score: P1=1.0, P2=0.75, P3=0.5, P4=0.2, none=0.1 (× priorityCoefficient)",
            },
            created: {
                name: "creation date",
                desc: "recency",
                detail: "Newest first (recent → old)",
                scoring: "Date comparison: newer tasks ranked higher",
            },
            alphabetical: {
                name: "alphabetical",
                desc: "A → Z",
                detail: "Standard order (A → Z)",
                scoring: "Lexicographic comparison of task content",
            },
        };

        const primary = criteriaMap[sortOrder[0]];
        const secondary =
            sortOrder.length > 1 ? criteriaMap[sortOrder[1]] : null;
        const tertiary =
            sortOrder.length > 2 ? criteriaMap[sortOrder[2]] : null;

        const sortChain = sortOrder
            .map((c) => criteriaMap[c]?.name || c)
            .join(" → ");
        const details = sortOrder
            .map((c) => criteriaMap[c]?.detail)
            .filter(Boolean)
            .join(" | ");

        // Build sort criteria details
        let criteriaDetails = `PRIMARY CRITERION (${primary?.name}):\n  ${primary?.detail}\n  Scoring: ${primary?.scoring}`;

        if (secondary) {
            criteriaDetails += `\n\nSECONDARY CRITERION (${secondary.name}):\n  Applied when primary scores are equal\n  ${secondary.detail}\n  Scoring: ${secondary.scoring}`;
        }

        if (tertiary) {
            criteriaDetails += `\n\nTERTIARY CRITERION (${tertiary.name}):\n  Applied when primary AND secondary scores are equal\n  ${tertiary.detail}\n  Scoring: ${tertiary.scoring}`;
        }

        return `
🚨 TASK ORDERING IN USER CONFIGURATION (Pre-Sorted)
The task list below has been SORTED by the following criteria in this EXACT order:

SORT CHAIN: ${sortChain}

${criteriaDetails}

⚠️ CRITICAL IMPLICATIONS FOR YOUR RECOMMENDATIONS:

1. **TASK ID RANKING**:
   - Lower task IDs = HIGHER ranking by these criteria
   - [TASK_1], [TASK_2], [TASK_3] are the TOP-RANKED tasks
   - Task list already reflects user's preferred ordering

2. **PRIORITIZATION GUIDANCE**:
   - First tasks in list are most relevant/urgent/important by user's criteria
   - Recommend from early IDs ([TASK_1]-[TASK_10]) for highest-priority work
   - Later IDs ([TASK_50]+) are lower-ranked but may still be relevant

3. **SORT CRITERIA IN USE**:
   Primary: ${primary?.desc} - ${primary?.detail}
   ${secondary ? `Secondary: ${secondary.desc} - ${secondary.detail}` : ""}
   ${tertiary ? `Tertiary: ${tertiary.desc} - ${tertiary.detail}` : ""}

4. **WHAT THIS MEANS FOR RECOMMENDATIONS**:
   - Tasks are ALREADY ordered by importance/urgency/relevance
   - Your job is to identify WHICH of these pre-sorted tasks to recommend
   - Recommend 80%+ of tasks, prioritizing earlier IDs
   - Provide brief guidance on prioritization WITHIN these pre-sorted tasks

🔍 UNDERSTANDING TASK METADATA:
Each task includes clean metadata (Status, Priority, Due, etc.) - use this to understand why tasks are ranked this way.

Example ordering: "keyword relevance → due date → priority"
→ Best keyword matches first, then by urgency, then by importance
→ [TASK_1] has highest keyword match + may be most urgent/important
→ Recommend starting with [TASK_1], [TASK_2], [TASK_3], etc.

Full details: ${details}`;
    }

    /**
     * Build metadata guidance explaining how task properties are structured
     * Used in task analysis prompts to ensure AI correctly interprets task metadata
     */
    static buildMetadataGuidance(settings: PluginSettings): string {
        const statusNames = Object.values(settings.taskStatusMapping)
            .map((config) => config.displayName)
            .join(", ");
        const priorityMappings = Object.entries(
            settings.dataviewPriorityMapping,
        )
            .map(([k, v]) => `${v[0] || k}=${k}`)
            .join(", ");

        return `
TASK METADATA (Use Clean Metadata, Ignore Raw Syntax):

Example task display:
  [TASK_1] Fix bug [due::2025-10-20] 🗓️ 2025-10-20 [p::1] ⏫
    Status: Open | Priority: 1 | Due: 2025-10-20

⚠️ CRITICAL: Use ONLY the clean metadata line ("Status: Open | Priority: 1 | Due: 2025-10-20")
→ Ignore raw Dataview syntax in task text ([due::DATE], 🗓️, ⏫, etc.)
→ Raw syntax already extracted - trust the metadata line only

METADATA FIELDS (User-Configured):
Status: ${statusNames} (appears as "Status: Open")
Priority: ${priorityMappings} (appears as "Priority: 1", lower = higher, 1=highest → 4=lowest)
Due: ${settings.dataviewKeys.dueDate} (appears as "Due: 2025-10-20", missing = no due date)
Created: ${settings.dataviewKeys.createdDate} (appears as "Created: 2025-10-15")
Completed: ${settings.dataviewKeys.completedDate} (appears as "Completed: 2025-10-18")
Folder: Vault location (e.g., "Projects/Work")
Tags: Task tags (e.g., "#urgent #coding")

⚠️ Always use metadata values - never parse raw syntax from task text!`;
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

        // Build comprehensive guidance
        return `
🚨 PROPERTY RECOGNITION (User Terms + Base Terms + Native Understanding)

USER TERMS (Highest Priority):
${settings.userPropertyTerms.priority.length > 0 ? `Priority: ${settings.userPropertyTerms.priority.join(", ")}` : ""}${settings.userPropertyTerms.dueDate.length > 0 ? `\nDue Date: ${settings.userPropertyTerms.dueDate.join(", ")}` : ""}${settings.userPropertyTerms.status.length > 0 ? `\nStatus: ${settings.userPropertyTerms.status.join(", ")}` : ""}

BASE TERMS (Built-in, Multilingual):
Priority: General (${combined.priority.general.slice(0, 8).join(", ")}), High (${combined.priority.high.slice(0, 6).join(", ")}), Medium (${combined.priority.medium.join(", ")}), Low (${combined.priority.low.slice(0, 6).join(", ")})
Due Date: General (${combined.dueDate.general.slice(0, 8).join(", ")}), Today (${combined.dueDate.today.join(", ")}), Tomorrow (${combined.dueDate.tomorrow.join(", ")}), Overdue (${combined.dueDate.overdue.slice(0, 6).join(", ")}), This Week (${combined.dueDate.thisWeek.join(", ")}), Next Week (${combined.dueDate.nextWeek.join(", ")})
Status: ${Object.entries(combined.status)
            .map(([key, terms]) => {
                const categoryConfig = settings.taskStatusMapping[key];
                const displayName = categoryConfig?.displayName || key;
                return `${displayName} (${terms.slice(0, 6).join(", ")})`;
            })
            .join(", ")}

RECOGNITION PROCESS:
1. Recognize property CONCEPTS in user's query (ANY language)
2. Match against user terms (aliases) or base terms (defaults)
3. Convert to internal values: "inprogress", 1, "overdue", etc.
4. Separate from content keywords

Examples: "urgent bug" → priority: 1, keywords: ["bug"] | "进行中任务" → status: "inprogress", keywords: ["任务"]

⚠️ Use native understanding for ANY language - NO expansion needed!
`;
    }
}
