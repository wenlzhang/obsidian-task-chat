import { App } from "obsidian";
import { DataviewService } from "./dataviewService";

/**
 * Warning types for DataView state
 */
export interface DataViewWarning {
    type: "not-enabled" | "no-tasks" | "indexing" | "ready";
    message: string;
    details?: string;
    suggestions?: string[];
}

/**
 * Service for handling DataView warnings and status checks
 * Centralizes DataView state detection and warning message generation
 *
 * Similar to ErrorMessageService, this provides dedicated warning handling
 * for DataView-specific issues that users need to be aware of.
 */
export class DataViewWarningService {
    /**
     * Check DataView status and return appropriate warning (if any)
     *
     * @param app - Obsidian app instance
     * @param taskCount - Current number of tasks loaded
     * @param isSearchQuery - Whether this check is during a search query (affects messaging)
     * @returns Warning object if there's an issue, null if everything is ready
     */
    static checkDataViewStatus(
        app: App,
        taskCount: number,
        isSearchQuery: boolean = false,
    ): DataViewWarning | null {
        const isDataviewEnabled = DataviewService.isDataviewEnabled(app);

        // Case 1: DataView not enabled
        if (!isDataviewEnabled) {
            return {
                type: "not-enabled",
                message: "DataView plugin required",
                details:
                    "This plugin requires the DataView plugin to function. Please install and enable it from Community Plugins.",
                suggestions: [
                    "Go to Settings → Community Plugins",
                    "Search for 'Dataview' and install it",
                    "Enable the plugin",
                    "Click the Refresh button above to load tasks",
                ],
            };
        }

        // Case 2: DataView enabled but no tasks found
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
                                ? "DataView is still indexing your vault"
                                : "No tasks found - DataView may still be indexing",
                            details: isSearchQuery
                                ? "Your search returned 0 results because DataView hasn't finished indexing your vault yet. This is common in large vaults or right after startup."
                                : "DataView is enabled but no tasks are currently available. This usually means indexing is in progress.",
                            suggestions: [
                                "Wait 10-30 seconds for DataView to finish indexing",
                                "Check DataView settings → Reduce 'Index delay' (default: 2000ms, try: 500ms)",
                                "Click the Refresh button above to reload tasks",
                                "Check console (Ctrl+Shift+I) for any DataView errors",
                            ],
                        };
                    }
                } catch (error) {
                    // API call failed - treat as indexing issue
                    return {
                        type: "indexing",
                        message: "DataView may still be initializing",
                        details:
                            "Unable to check DataView status. The plugin may still be starting up or indexing your vault.",
                        suggestions: [
                            "Wait a moment and try again",
                            "Click the Refresh button above",
                            "Check if DataView plugin is properly enabled",
                        ],
                    };
                }
            }

            // DataView is enabled and has pages, but no tasks found
            return {
                type: "no-tasks",
                message: isSearchQuery
                    ? "Your search returned 0 results"
                    : "No tasks found in your vault",
                details: isSearchQuery
                    ? "DataView is working but no tasks matched your search criteria. The tasks may exist but don't match your filters, or DataView's index delay is too long."
                    : "DataView is working but found no tasks in your vault. You may need to create tasks using proper markdown syntax (e.g., - [ ] Task).",
                suggestions: isSearchQuery
                    ? [
                          "Try broader search terms",
                          "Check if your tasks match the search criteria",
                          "Reduce DataView 'Index delay' in settings for faster updates",
                          "Click Refresh if you just created tasks",
                      ]
                    : [
                          "Create tasks using markdown syntax: - [ ] Task name",
                          "Verify tasks exist in your vault",
                          "Check DataView settings → Ensure 'Index delay' is reasonable (500-2000ms)",
                          "Click Refresh button to reload",
                      ],
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
            return `DataView ready: ${taskCount} task(s) loaded`;
        }

        return warning.message;
    }
}
