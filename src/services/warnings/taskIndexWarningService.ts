import { App } from "obsidian";
import { TaskIndexService } from "../tasks/taskIndexService";
import { TaskFilter } from "../../models/task";
import type { PluginSettings } from "../../settings";

/**
 * Warning types for task indexing API state
 */
export interface TaskIndexWarning {
    type: "not-enabled" | "no-tasks" | "indexing" | "ready";
    message: string;
    details?: string;
    suggestions?: string[];
    apiInfo?: {
        activeAPI: "datacore" | "dataview" | null;
        datacoreAvailable: boolean;
        dataviewAvailable: boolean;
        canSwitchToDatacore: boolean;
    };
    filterInfo?: {
        hasActiveFilters: boolean;
        hasActiveExclusions: boolean;
        filterSummary?: string;
        exclusionSummary?: string;
    };
}

/**
 * Service for handling task indexing API warnings and status checks
 * Supports both Datacore and Dataview
 *
 * Centralizes API state detection and warning message generation.
 * Similar to ErrorMessageService, this provides dedicated warning handling
 * for task indexing issues that users need to be aware of.
 */
export class TaskIndexWarningService {
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
     * Check task indexing API status and determine warning type
     *
     * @param app - Obsidian app instance
     * @param settings - Plugin settings
     * @param taskCount - Current number of tasks loaded
     * @param currentFilter - Current active filter
     * @returns Warning object with type, message, and suggestions
     */
    static checkAPIStatus(
        app: App,
        settings: PluginSettings,
        taskCount: number,
        currentFilter: TaskFilter,
    ): TaskIndexWarning {
        // Get API status
        const status = TaskIndexService.getDetailedStatus(app, settings);
        const hasFilters = this.hasActiveFilters(currentFilter);
        const hasExclusions = this.hasActiveExclusions(settings);

        // Prepare filter info
        const filterInfo = {
            hasActiveFilters: hasFilters,
            hasActiveExclusions: hasExclusions,
            filterSummary: hasFilters
                ? this.getFilterSummary(currentFilter)
                : undefined,
            exclusionSummary: hasExclusions
                ? this.getExclusionSummary(settings)
                : undefined,
        };

        // Prepare API info
        const apiInfo = {
            activeAPI: status.activeAPI,
            datacoreAvailable: status.datacoreAvailable,
            dataviewAvailable: status.dataviewAvailable,
            canSwitchToDatacore: status.canSwitchToDatacore,
        };

        // Case 1: No API available
        if (!status.activeAPI) {
            return {
                type: "not-enabled",
                message: "Task indexing API not available",
                details:
                    "Please install Datacore or Dataview plugin to use Task Chat.",
                suggestions: [
                    "Install Datacore (recommended) from Community Plugins",
                    "Or install Dataview from Community Plugins",
                    "Restart Obsidian after installation",
                ],
                apiInfo,
                filterInfo,
            };
        }

        // Case 2: API ready but no tasks
        if (taskCount === 0) {
            const apiName =
                status.activeAPI === "datacore" ? "Datacore" : "Dataview";

            // Build suggestions based on filter/exclusion state
            const suggestions: string[] = [];

            if (hasFilters) {
                suggestions.push(
                    `Clear filters (currently filtering by: ${filterInfo.filterSummary})`,
                );
            }

            if (hasExclusions) {
                suggestions.push(
                    `Check exclusions (currently excluding: ${filterInfo.exclusionSummary})`,
                );
            }

            if (!hasFilters && !hasExclusions) {
                suggestions.push(
                    "Create some tasks with checkboxes in your notes",
                );
                suggestions.push(
                    `Verify ${apiName} is indexing your vault correctly`,
                );
            }

            return {
                type: "no-tasks",
                message: "No tasks found",
                details:
                    hasFilters || hasExclusions
                        ? "Your filters or exclusions may be too restrictive."
                        : `${apiName} is active, but no tasks were found in your vault.`,
                suggestions,
                apiInfo,
                filterInfo,
            };
        }

        // Case 3: Everything is ready
        let message = status.message;

        // Add performance recommendation if using Dataview but Datacore is available
        if (status.canSwitchToDatacore) {
            message +=
                " 💡 Datacore is available and offers 2-10x better performance.";
        }

        return {
            type: "ready",
            message: message,
            apiInfo,
            filterInfo,
        };
    }

    /**
     * Render warning message UI in the chat view
     *
     * @param containerEl - Container element to render warning in
     * @param app - Obsidian app instance
     * @param settings - Plugin settings
     * @param taskCount - Current number of tasks
     * @param currentFilter - Current active filter
     */
    static renderWarning(
        containerEl: HTMLElement,
        app: App,
        settings: PluginSettings,
        taskCount: number,
        currentFilter: TaskFilter,
    ): void {
        const warning = this.checkAPIStatus(
            app,
            settings,
            taskCount,
            currentFilter,
        );

        // Clear previous warnings
        containerEl.empty();

        // Only show warning UI for error states (not for "ready" state)
        if (warning.type === "ready") {
            return;
        }

        const warningEl = containerEl.createDiv("task-chat-task-index-warning");

        // Warning icon and title
        const titleEl = warningEl.createDiv(
            "task-chat-task-index-warning-title",
        );

        if (warning.type === "not-enabled") {
            titleEl.createSpan({ text: "⚠️ ", cls: "warning-icon" });
        } else {
            titleEl.createSpan({ text: "ℹ️ ", cls: "info-icon" });
        }

        titleEl.createSpan({ text: warning.message });

        // Details
        if (warning.details) {
            warningEl.createDiv({
                text: warning.details,
                cls: "task-chat-task-index-warning-details",
            });
        }

        // API Status
        if (warning.apiInfo) {
            const apiStatusEl = warningEl.createDiv(
                "task-chat-task-index-warning-api-status",
            );
            apiStatusEl.createEl("strong", { text: "API Status:" });

            const statusList = apiStatusEl.createEl("ul");

            if (warning.apiInfo.activeAPI) {
                const apiName =
                    warning.apiInfo.activeAPI === "datacore"
                        ? "Datacore"
                        : "Dataview";
                statusList.createEl("li", {
                    text: `✓ Using: ${apiName}`,
                });
            } else {
                statusList.createEl("li", {
                    text: `✗ Datacore: ${warning.apiInfo.datacoreAvailable ? "Available" : "Not installed"}`,
                });
                statusList.createEl("li", {
                    text: `✗ Dataview: ${warning.apiInfo.dataviewAvailable ? "Available" : "Not installed"}`,
                });
            }

            if (warning.apiInfo.canSwitchToDatacore) {
                statusList.createEl("li", {
                    text: "💡 Datacore available for better performance",
                    cls: "recommendation",
                });
            }
        }

        // Filter/Exclusion info
        if (warning.filterInfo) {
            if (
                warning.filterInfo.hasActiveFilters ||
                warning.filterInfo.hasActiveExclusions
            ) {
                const filterStatusEl = warningEl.createDiv(
                    "task-chat-task-index-warning-filter-status",
                );

                if (warning.filterInfo.hasActiveFilters) {
                    filterStatusEl.createDiv({
                        text: `Active filters: ${warning.filterInfo.filterSummary}`,
                        cls: "filter-info",
                    });
                }

                if (warning.filterInfo.hasActiveExclusions) {
                    filterStatusEl.createDiv({
                        text: `Active exclusions: ${warning.filterInfo.exclusionSummary}`,
                        cls: "exclusion-info",
                    });
                }
            }
        }

        // Suggestions
        if (warning.suggestions && warning.suggestions.length > 0) {
            const suggestionsEl = warningEl.createDiv(
                "task-chat-task-index-warning-suggestions",
            );
            suggestionsEl.createEl("strong", { text: "Suggestions:" });

            const suggestionsList = suggestionsEl.createEl("ul");
            for (const suggestion of warning.suggestions) {
                suggestionsList.createEl("li", { text: suggestion });
            }
        }
    }

    /**
     * Get short status message for status bar or header
     */
    static getShortStatus(
        app: App,
        settings: PluginSettings,
        taskCount: number,
    ): string {
        const status = TaskIndexService.getDetailedStatus(app, settings);

        if (!status.activeAPI) {
            return "⚠️ No task indexing API";
        }

        const apiName =
            status.activeAPI === "datacore" ? "Datacore" : "Dataview";

        if (taskCount === 0) {
            return `${apiName} • No tasks`;
        }

        let statusText = `${apiName} • ${taskCount} task${taskCount === 1 ? "" : "s"}`;

        if (status.canSwitchToDatacore) {
            statusText += " • 💡 Datacore available";
        }

        return statusText;
    }
}
