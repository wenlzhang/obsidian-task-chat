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
RECOMMENDATION LIMITS:
- Recommend up to ${settings.maxRecommendations} tasks maximum
- If more tasks are relevant, prioritize the most critical ones
- It's okay to recommend fewer if only a few are truly relevant
- Focus on quality over quantity`;
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
- Tasks are sorted using multi-criteria sorting: ${sortChain}
- Primary sort: ${primaryDescription}
- Earlier tasks in the list are MORE important based on this sorting
- Lower task IDs (e.g., [TASK_1], [TASK_2]) are typically more critical than higher IDs
- When recommending tasks, prioritize earlier task IDs unless there's a specific reason not to

Sort criteria in use (in priority order):
${criteriaDetails.map((detail) => `  * ${detail}`).join("\n")}`;
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
- Metadata format: "Status: X | Priority: Y | Due: Z | Created: C | Completed: D | Folder: W | Tags: T1, T2"
- ONLY use metadata shown explicitly - do NOT infer properties from task text

FIELD-SPECIFIC RULES:
- **Status**: Uses your configured display names (${statusNames})
  → ONLY trust "Status:" field, NOT text content
  
- **Priority**: Uses your configured values (${priorityMappings})
  → ONLY trust "Priority:" field, NOT text content
  → Lower numbers = higher priority (1=highest, 4=lowest)
  
- **Due date**: Field name "${settings.dataviewKeys.dueDate}" in user's vault
  → ONLY trust "Due:" field, NOT text content
  → If task has NO "Due:" field, it has NO due date
  → Emojis in text (📝, ⏰) are NOT due dates
  → Timestamps in text are NOT due dates
  
- **Created date**: Field name "${settings.dataviewKeys.createdDate}" in user's vault
  → Shows when task was created
  → Appears in "Created:" field
  
- **Completed date**: Field name "${settings.dataviewKeys.completedDate}" in user's vault
  → Shows when task was finished
  → Appears in "Completed:" field
  
- **Folder**: Task's location in vault hierarchy
- **Tags**: Task's assigned tags from vault

CRITICAL: Dates/emojis/timestamps in task TEXT are NOT metadata unless shown in structured fields!`;
    }
}
