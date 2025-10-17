import { PluginSettings, SortCriterion } from "../settings";

/**
 * Shared utility service for building AI prompt components
 * Used by both AIService (task analysis) and QueryParserService (query parsing)
 *
 * This ensures consistency across all AI interactions and avoids code duplication
 */
export class PromptBuilderService {
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

        return `\nPRIORITY MAPPING (DataView format [${settings.dataviewKeys.priority}::value]):\n${lines.join("\n")}\n\nWhen users ask for tasks by priority, search using these values.`;
    }

    /**
     * Build priority mapping for query parser (more concise format)
     * Used specifically in QueryParserService for parsing natural language
     */
    static buildPriorityMappingForParser(settings: PluginSettings): string {
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

        return lines.length > 0
            ? `PRIORITY MAPPING (User-Configured):\n${lines.join("\n")}`
            : `PRIORITY MAPPING:\n- 1 = highest/high priority\n- 2 = medium priority\n- 3 = low priority\n- 4 = none/no priority`;
    }

    /**
     * Build date format documentation from user settings (all date types)
     * Used in task analysis prompts
     */
    static buildDateFormats(settings: PluginSettings): string {
        const keys = settings.dataviewKeys;
        return `
DATE FORMATS (DataView):
- Due date: [${keys.dueDate}::YYYY-MM-DD] - Users may ask for "due today", "overdue", "this week", etc.
- Created date: [${keys.createdDate}::YYYY-MM-DD] - When the task was created
- Completed date: [${keys.completedDate}::YYYY-MM-DD] - When the task was finished
Users may reference tasks by any of these dates.`;
    }

    /**
     * Build date field names for query parser
     * Used in QueryParserService to recognize field name variations
     */
    static buildDateFieldNamesForParser(settings: PluginSettings): string {
        const keys = settings.dataviewKeys;
        return `DATE FIELD NAMES (User-Configured):
Users may use these field names in queries - recognize all variations:
- Due date: "${keys.dueDate}", "due", "deadline", "dueDate"
- Created date: "${keys.createdDate}", "created", "createdDate"
- Completed date: "${keys.completedDate}", "completed", "completedDate", "done"`;
    }

    /**
     * Build task status mapping from user settings
     * Used in task analysis prompts
     */
    static buildStatusMapping(settings: PluginSettings): string {
        const names = settings.taskStatusDisplayNames;
        return `
TASK STATUS CATEGORIES (User-Configured):
- ${names.open || "Open"}: Tasks not yet started or in progress
- ${names.completed || "Completed"}: Finished tasks
- ${names.inProgress || "In progress"}: Tasks currently being worked on
- ${names.cancelled || "Cancelled"}: Tasks that were abandoned
- ${names.other || "Other"}: Miscellaneous task states
Use these exact names when referring to task status.`;
    }

    /**
     * Build status mapping for query parser (more concise format)
     * Used in QueryParserService for parsing natural language
     */
    static buildStatusMappingForParser(settings: PluginSettings): string {
        const names = settings.taskStatusDisplayNames;
        return `STATUS MAPPING (User-Configured):
- "open" = ${names.open || "Open"} tasks (incomplete, pending, todo)
- "completed" = ${names.completed || "Completed"} tasks (done, finished)
- "inProgress" = ${names.inProgress || "In progress"} tasks (working on)`;
    }

    /**
     * Build recommendation limits based on user settings
     * Used in task analysis prompts to guide AI on how many tasks to recommend
     */
    static buildRecommendationLimits(settings: PluginSettings): string {
        return `
TASK RECOMMENDATION REQUIREMENTS:
⚠️ CRITICAL: You MUST be comprehensive in your recommendations!

- Recommend ALL truly relevant tasks, not just a "top few"
- When there are 20+ relevant matches, aim for at least 10-15 recommendations
- Maximum allowed: ${settings.maxRecommendations} tasks
- DO NOT be overly selective - if a task matches the query and has reasonable relevance, INCLUDE IT
- Users prefer comprehensive lists over missing relevant tasks
- Goal: Give user complete view of ALL relevant work, not a curated subset
- Only exclude tasks that are clearly NOT relevant to the query

⚠️ Remember: It's better to recommend more relevant tasks than to exclude potentially useful ones!`;
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
        const statusNames = Object.values(settings.taskStatusDisplayNames).join(
            ", ",
        );
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
1. Original task text (may contain raw DataView syntax)
2. Extracted metadata below each task (clean, structured format)

Example:
  [TASK_1] Fix bug [due::2025-10-20] 🗓️ 2025-10-20 [p::1] ⏫
    Status: Open | Priority: 1 | Due: 2025-10-20

WHY you see raw syntax in text:
- Raw syntax ([due::DATE], 🗓️ DATE, ⏫) is how users store metadata in their vault
- We keep it in task text for vault compatibility
- BUT we've ALREADY extracted it using DataView API

WHAT YOU MUST DO:
→ Use ONLY the structured metadata (e.g., "Priority: 1", "Due: 2025-10-20")
→ Do NOT try to parse [due::2025-10-20] or 🗓️ 2025-10-20 from the task text
→ If you see BOTH raw syntax in text AND clean metadata, trust the metadata
→ The raw syntax is already processed - you don't need to interpret it

Common raw DataView formats you might see in text (already extracted for you):
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

REMEMBER: All these fields are extracted from DataView syntax and shown as clean metadata. Always use the metadata values, never try to parse raw syntax from task text!`;
    }
}
