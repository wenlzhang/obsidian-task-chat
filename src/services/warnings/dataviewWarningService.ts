import { App } from "obsidian";
import { DataviewService } from "../tasks/dataviewService";
import { TaskFilter } from "../../models/task";
import type { PluginSettings } from "../../settings";

/**
 * Warning types for Dataview state
 */
export interface DataViewWarning {
    type: "not-enabled" | "no-tasks" | "indexing" | "ready";
    message: string;
    details?: string;
    suggestions?: string[];
    filterInfo?: {
        hasActiveFilters: boolean;
        hasActiveExclusions: boolean;
        filterSummary?: string;
        exclusionSummary?: string;
    };
}

/**
 * Service for handling Dataview warnings and status checks
 * Centralizes Dataview state detection and warning message generation
 *
 * Similar to ErrorMessageService, this provides dedicated warning handling
 * for Dataview-specific issues that users need to be aware of.
 */
export class DataViewWarningService {
    /**
     * Get filter summary for display
     */
    private static getFilterSummary(filter: TaskFilter): string {
        const parts: string[] = [];

        if (filter.folders && filter.folders.length > 0) {
            parts.push(`${filter.folders.length} folder(s)`);
        }
        if (filter.noteTags && filter.noteTags.length > 0) {
            parts.push(`${filter.noteTags.length} note tag(s)`);
        }
        if (filter.taskTags && filter.taskTags.length > 0) {
            parts.push(`${filter.taskTags.length} task tag(s)`);
        }
        if (filter.notes && filter.notes.length > 0) {
            parts.push(`${filter.notes.length} note(s)`);
        }
        if (filter.priorities && filter.priorities.length > 0) {
            parts.push(`${filter.priorities.length} priority level(s)`);
        }
        if (filter.taskStatuses && filter.taskStatuses.length > 0) {
            parts.push(`${filter.taskStatuses.length} status(es)`);
        }
        if (filter.dueDateRange) {
            parts.push("due date range");
        }

        return parts.join(", ");
    }

    /**
     * Get exclusion summary for display
     */
    private static getExclusionSummary(settings: PluginSettings): string {
        const ex = settings.exclusions;
        const parts: string[] = [];

        if (ex.noteTags && ex.noteTags.length > 0) {
            parts.push(`${ex.noteTags.length} note tag(s)`);
        }
        if (ex.taskTags && ex.taskTags.length > 0) {
            parts.push(`${ex.taskTags.length} task tag(s)`);
        }
        if (ex.folders && ex.folders.length > 0) {
            parts.push(`${ex.folders.length} folder(s)`);
        }
        if (ex.notes && ex.notes.length > 0) {
            parts.push(`${ex.notes.length} note(s)`);
        }

        return parts.join(", ");
    }

    /**
     * Check if there are active filters
     */
    private static hasActiveFilters(filter: TaskFilter): boolean {
        return !!(
            (filter.folders && filter.folders.length > 0) ||
            (filter.noteTags && filter.noteTags.length > 0) ||
            (filter.taskTags && filter.taskTags.length > 0) ||
            (filter.notes && filter.notes.length > 0) ||
            (filter.priorities && filter.priorities.length > 0) ||
            (filter.taskStatuses && filter.taskStatuses.length > 0) ||
            filter.dueDateRange
        );
    }

    /**
     * Check if there are active exclusions
     */
    private static hasActiveExclusions(settings: PluginSettings): boolean {
        const ex = settings.exclusions;
        return !!(
            (ex.noteTags && ex.noteTags.length > 0) ||
            (ex.taskTags && ex.taskTags.length > 0) ||
            (ex.folders && ex.folders.length > 0) ||
            (ex.notes && ex.notes.length > 0)
        );
    }

    /**
     * Check Dataview status and return appropriate warning (if any)
     *
     * @param app - Obsidian app instance
     * @param taskCount - Current number of tasks loaded
     * @param isSearchQuery - Whether this check is during a search query (affects messaging)
     * @param filter - Optional current filter state
     * @param settings - Optional plugin settings
     * @returns Warning object if there's an issue, null if everything is ready
     */
    static checkDataViewStatus(
        app: App,
        taskCount: number,
        isSearchQuery = false,
        filter?: TaskFilter,
        settings?: PluginSettings,
    ): DataViewWarning | null {
        const isDataviewEnabled = DataviewService.isDataviewEnabled(app);

        // Case 1: Dataview not enabled
        if (!isDataviewEnabled) {
            return {
                type: "not-enabled",
                message: "Dataview plugin required",
                details:
                    "This plugin requires the Dataview plugin to function. Please install and enable it from Community Plugins.",
                suggestions: [
                    "Go to Settings → Community Plugins",
                    "Search for 'Dataview' and install it",
                    "Enable the plugin",
                    "Click the Refresh button to load tasks",
                ],
            };
        }

        // Case 2: Dataview enabled but no tasks found
        if (taskCount === 0) {
            // Check if this is likely due to indexing
            const api = DataviewService.getAPI(app);

            if (api) {
                // Try to get pages to see if vault has any files
                try {
                    const pages = api.pages();
                    const pageCount = pages ? pages.length : 0;

                    if (pageCount === 0) {
                        // No pages indexed yet - definitely still indexing
                        return {
                            type: "indexing",
                            message: isSearchQuery
                                ? "Dataview is still indexing your vault"
                                : "No tasks found - Dataview may still be indexing",
                            details: isSearchQuery
                                ? "Your search returned 0 results because Dataview hasn't finished indexing your vault yet. This is common in large vaults or right after startup."
                                : "Dataview is enabled but no tasks are currently available. This usually means indexing is in progress.",
                            suggestions: [
                                "Wait a moment for Dataview to finish indexing",
                                "Check Dataview settings → Reduce 'Index delay'",
                                "Click the Refresh button to reload tasks",
                                "Check console (Ctrl+Shift+I) for any Dataview errors",
                            ],
                        };
                    }
                } catch (error) {
                    // API call failed - treat as indexing issue
                    return {
                        type: "indexing",
                        message: "Dataview may still be initializing",
                        details:
                            "Unable to check Dataview status. The plugin may still be starting up or indexing your vault.",
                        suggestions: [
                            "Wait a moment and try again",
                            "Click the Refresh button",
                            "Check if Dataview plugin is properly enabled",
                        ],
                    };
                }
            }

            // Dataview is enabled and has pages, but no tasks found
            // Check if filters/exclusions might be the cause
            const hasFilters = filter ? this.hasActiveFilters(filter) : false;
            const hasExclusions = settings
                ? this.hasActiveExclusions(settings)
                : false;

            const filterInfo = {
                hasActiveFilters: hasFilters,
                hasActiveExclusions: hasExclusions,
                filterSummary:
                    filter && hasFilters
                        ? this.getFilterSummary(filter)
                        : undefined,
                exclusionSummary:
                    settings && hasExclusions
                        ? this.getExclusionSummary(settings)
                        : undefined,
            };

            // Build suggestions based on active filters/exclusions
            const suggestions: string[] = [];

            if (hasFilters) {
                suggestions.push(
                    `✅ Active Chat Filters: ${filterInfo.filterSummary} - Try resetting or adjusting filters`,
                );
            }

            if (hasExclusions) {
                suggestions.push(
                    `❌ Active Exclusions: ${filterInfo.exclusionSummary} - Check Settings → Exclusions`,
                );
            }

            if (hasFilters && hasExclusions) {
                suggestions.push(
                    "⚠️ NOTE: Exclusion rules (settings) always take priority over filters (chat interface)",
                );
            }

            if (!hasFilters && !hasExclusions) {
                if (isSearchQuery) {
                    suggestions.push("Try broader search terms");
                    suggestions.push("Click Refresh button to reload tasks");
                } else {
                    suggestions.push(
                        "Create tasks using markdown syntax: - [ ] Task name",
                    );
                    suggestions.push("Verify tasks exist in your vault");
                }
            }

            suggestions.push(
                "Check Dataview settings → Ensure 'Index delay' is reasonable",
            );

            if (isSearchQuery) {
                suggestions.push(
                    "Wait if Dataview is still indexing, then click Refresh",
                );
            }

            return {
                type: "no-tasks",
                message: isSearchQuery
                    ? "Your search returned 0 results"
                    : "No tasks found",
                details: isSearchQuery
                    ? hasFilters || hasExclusions
                        ? "Your filters or exclusions may be too restrictive, or no matching tasks exist."
                        : "Dataview is working but no tasks matched your search criteria."
                    : hasFilters || hasExclusions
                      ? "You have active filters or exclusions that may be hiding tasks."
                      : "Dataview is working but found no tasks in your vault. Create tasks using proper markdown syntax (e.g., - [ ] Task).",
                suggestions,
                filterInfo,
            };
        }

        // Case 3: Everything is ready - no warning needed
        return null;
    }

    /**
     * Render warning message in chat UI
     * Creates DOM elements with appropriate styling
     *
     * @param containerEl - Parent element to render warning in
     * @param warning - Warning object to render
     */
    static renderWarning(
        containerEl: HTMLElement,
        warning: DataViewWarning,
    ): void {
        // Clear any existing content
        containerEl.empty();

        // Choose icon and style based on warning type
        const isError = warning.type === "not-enabled";
        const iconText = isError ? "⚠️" : "ℹ️";
        const iconClass = isError
            ? "task-chat-warning-icon"
            : "task-chat-info-icon";
        const textClass = isError
            ? "task-chat-warning-text"
            : "task-chat-info-text";

        // Warning icon
        const icon = containerEl.createSpan({
            cls: iconClass,
            text: `${iconText} `,
        });

        // Warning text container
        const textContainer = containerEl.createSpan({
            cls: textClass,
        });

        // Main message
        textContainer.createEl("strong", {
            text: `${warning.message}: `,
        });

        // Details
        if (warning.details) {
            textContainer.appendText(warning.details);
        }

        // Suggestions
        if (warning.suggestions && warning.suggestions.length > 0) {
            textContainer.createEl("br");
            textContainer.createEl("br");
            textContainer.appendText("📋 Troubleshooting steps:");

            warning.suggestions.forEach((suggestion, index) => {
                textContainer.createEl("br");
                textContainer.appendText(`${index + 1}️⃣ ${suggestion}`);
            });
        }
    }

    /**
     * Create and render warning banner at top of chat interface
     *
     * @param containerEl - Parent element (should be the main content element)
     * @param warning - Warning to display
     * @returns The warning element created
     */
    static createWarningBanner(
        containerEl: HTMLElement,
        warning: DataViewWarning,
    ): HTMLElement {
        // Create warning banner element
        const warningEl = containerEl.createDiv("task-chat-dataview-warning");

        // Render the warning content
        this.renderWarning(warningEl, warning);

        return warningEl;
    }

    /**
     * Check if warning should be shown in search results
     * Returns true if the warning is critical and should be displayed even during normal searches
     *
     * @param warning - Warning to check
     * @returns Whether to show this warning prominently
     */
    static shouldShowInSearchResults(warning: DataViewWarning | null): boolean {
        if (!warning) return false;

        // Always show not-enabled and indexing warnings
        // These are critical issues that prevent the plugin from working
        return warning.type === "not-enabled" || warning.type === "indexing";
    }

    /**
     * Get brief status text for display
     * Returns a short one-line status message
     *
     * @param app - Obsidian app instance
     * @param taskCount - Current number of tasks
     * @returns Brief status text
     */
    static getStatusText(app: App, taskCount: number): string {
        const warning = this.checkDataViewStatus(app, taskCount, false);

        if (!warning) {
            return `Dataview ready: ${taskCount} task(s) loaded`;
        }

        return warning.message;
    }
}
