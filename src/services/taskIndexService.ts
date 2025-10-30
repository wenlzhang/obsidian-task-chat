import { App } from "obsidian";
import { Task } from "../models/task";
import { PluginSettings } from "../settings";
import { DataviewService } from "./dataviewService";
import { DatacoreService } from "./datacoreService";
import { Logger } from "../utils/logger";

/**
 * Unified Task Indexing Service
 *
 * Orchestrates between Datacore and Dataview APIs based on:
 * 1. User preference (taskIndexAPI setting)
 * 2. API availability
 * 3. Fallback strategy
 *
 * Provides a unified interface for the rest of the plugin,
 * abstracting away the underlying indexing implementation.
 */
export class TaskIndexService {
    /**
     * Detect which APIs are currently available
     * @returns Object with availability status for each API
     */
    static detectAvailableAPIs(app: App): {
        datacore: boolean;
        dataview: boolean;
    } {
        return {
            datacore: DatacoreService.isDatacoreEnabled(),
            dataview: DataviewService.isDataviewEnabled(app),
        };
    }

    /**
     * Determine which API to use based on settings and availability
     * @param app - Obsidian app instance
     * @param settings - Plugin settings
     * @returns The API type to use, or null if none available
     */
    static determineActiveAPI(
        app: App,
        settings: PluginSettings,
    ): "datacore" | "dataview" | null {
        const available = this.detectAvailableAPIs(app);
        const preference = settings.taskIndexAPI || "auto";

        // Handle user preference
        switch (preference) {
            case "datacore":
                if (available.datacore) {
                    Logger.info("Using Datacore (user preference)");
                    return "datacore";
                } else {
                    Logger.warn(
                        "Datacore requested but not available, checking fallback...",
                    );
                    // Fall through to auto logic
                    if (available.dataview) {
                        Logger.warn("Falling back to Dataview");
                        return "dataview";
                    }
                    return null;
                }

            case "dataview":
                if (available.dataview) {
                    Logger.info("Using Dataview (user preference)");
                    return "dataview";
                } else {
                    Logger.warn(
                        "Dataview requested but not available, checking fallback...",
                    );
                    // Fall through to auto logic
                    if (available.datacore) {
                        Logger.warn("Falling back to Datacore");
                        return "datacore";
                    }
                    return null;
                }

            case "auto":
            default:
                // Auto mode: Prefer Datacore (faster), fallback to Dataview
                if (available.datacore) {
                    Logger.info(
                        "Using Datacore (auto mode - better performance)",
                    );
                    return "datacore";
                } else if (available.dataview) {
                    Logger.info(
                        "Using Dataview (auto mode - Datacore not available)",
                    );
                    return "dataview";
                } else {
                    Logger.error("No task indexing API available");
                    return null;
                }
        }
    }

    /**
     * Get human-readable status message for current API
     */
    static getAPIStatus(app: App, settings: PluginSettings): string {
        const available = this.detectAvailableAPIs(app);
        const active = this.determineActiveAPI(app, settings);
        const preference = settings.taskIndexAPI || "auto";

        if (!active) {
            return "⚠️ No task indexing API available";
        }

        let status = "";

        if (active === "datacore") {
            status = "✓ Using Datacore";
            if (preference === "auto") {
                status += " (recommended for performance)";
            }
        } else if (active === "dataview") {
            status = "✓ Using Dataview";
            if (available.datacore && preference === "auto") {
                status +=
                    " (Datacore available - consider switching for better performance)";
            }
        }

        return status;
    }

    /**
     * Get detailed status information for settings UI
     */
    static getDetailedStatus(
        app: App,
        settings: PluginSettings,
    ): {
        activeAPI: "datacore" | "dataview" | null;
        datacoreAvailable: boolean;
        dataviewAvailable: boolean;
        preference: string;
        message: string;
        canSwitchToDatacore: boolean;
    } {
        const available = this.detectAvailableAPIs(app);
        const active = this.determineActiveAPI(app, settings);
        const preference = settings.taskIndexAPI || "auto";

        return {
            activeAPI: active,
            datacoreAvailable: available.datacore,
            dataviewAvailable: available.dataview,
            preference: preference,
            message: this.getAPIStatus(app, settings),
            canSwitchToDatacore: available.datacore && active !== "datacore",
        };
    }

    /**
     * Check if any task indexing API is available
     */
    static isAnyAPIAvailable(app: App): boolean {
        const available = this.detectAvailableAPIs(app);
        return available.datacore || available.dataview;
    }

    /**
     * Parse all tasks from the active indexing API
     * This is the main entry point used throughout the plugin
     *
     * @param app - Obsidian app instance
     * @param settings - Plugin settings
     * @param dateFilter - Optional date filter (legacy parameter)
     * @param propertyFilters - Optional property filters
     * @param inclusionFilters - Optional inclusion filters
     * @returns Array of tasks
     */
    static async parseTasksFromIndex(
        app: App,
        settings: PluginSettings,
        dateFilter?: string,
        propertyFilters?: {
            priority?: number | number[] | "all" | "none" | null;
            dueDate?: string | string[] | null;
            dueDateRange?: { start: string; end: string } | null;
            status?: string | string[] | null;
            statusValues?: string[] | null;
        },
        inclusionFilters?: {
            folders?: string[];
            noteTags?: string[];
            taskTags?: string[];
            notes?: string[];
        },
    ): Promise<Task[]> {
        const activeAPI = this.determineActiveAPI(app, settings);

        if (!activeAPI) {
            Logger.error("Cannot fetch tasks: No task indexing API available");
            return [];
        }

        try {
            if (activeAPI === "datacore") {
                Logger.debug("Fetching tasks from Datacore");
                return await DatacoreService.parseTasksFromDatacore(
                    app,
                    settings,
                    dateFilter,
                    propertyFilters,
                    inclusionFilters,
                );
            } else {
                Logger.debug("Fetching tasks from Dataview");
                return await DataviewService.parseTasksFromDataview(
                    app,
                    settings,
                    dateFilter,
                    propertyFilters,
                    inclusionFilters,
                );
            }
        } catch (error) {
            Logger.error(`Error fetching tasks from ${activeAPI}:`, error);
            return [];
        }
    }

    /**
     * Wait for task indexing API to be ready
     * Checks both Datacore and Dataview with appropriate timeout
     *
     * @param app - Obsidian app instance
     * @param settings - Plugin settings
     * @param maxAttempts - Maximum number of polling attempts (default: 20 = 10 seconds)
     * @returns true if API is ready, false if timeout
     */
    static async waitForAPI(
        app: App,
        settings: PluginSettings,
        maxAttempts: number = 20,
    ): Promise<boolean> {
        for (let i = 0; i < maxAttempts; i++) {
            const activeAPI = this.determineActiveAPI(app, settings);

            if (activeAPI) {
                Logger.info(
                    `Task indexing API ready: ${activeAPI} (attempt ${i + 1}/${maxAttempts})`,
                );
                return true;
            }

            if (i === 0) {
                Logger.debug(
                    "Waiting for task indexing API (Datacore or Dataview)...",
                );
            } else {
                Logger.debug(
                    `Still waiting for task indexing API... (attempt ${i + 1}/${maxAttempts})`,
                );
            }

            await new Promise((resolve) => setTimeout(resolve, 500));
        }

        Logger.error(
            "Task indexing API not available after waiting 10 seconds",
        );
        return false;
    }

    /**
     * Get recommendation message for users
     * Helps users understand which API they should use
     */
    static getRecommendationMessage(
        app: App,
        settings: PluginSettings,
    ): string | null {
        const available = this.detectAvailableAPIs(app);
        const active = this.determineActiveAPI(app, settings);
        const preference = settings.taskIndexAPI || "auto";

        // User is using Dataview but Datacore is available
        if (
            active === "dataview" &&
            available.datacore &&
            preference !== "dataview"
        ) {
            return "💡 Datacore is installed and available. It offers 2-10x better performance than Dataview. Consider switching in Task Chat settings!";
        }

        // User has Datacore preference but it's not installed
        if (preference === "datacore" && !available.datacore) {
            return "⚠️ You've selected Datacore as your preferred API, but it's not installed. Please install Datacore or change your preference to Dataview.";
        }

        // User has Dataview preference but it's not installed
        if (preference === "dataview" && !available.dataview) {
            return "⚠️ You've selected Dataview as your preferred API, but it's not installed. Please install Dataview or change your preference to Auto/Datacore.";
        }

        return null;
    }

    /**
     * Parse standard query syntax (delegates to DataviewService for consistency)
     * This ensures query parsing works the same regardless of which API is active
     */
    static parseStandardQuerySyntax(query: string): {
        keywords?: string[];
        priority?: number;
        dueDate?: string;
        dueDateRange?: { start?: string; end?: string };
        project?: string;
        statusValues?: string[];
        specialKeywords?: string[];
        operators?: { and?: boolean; or?: boolean; not?: boolean };
    } {
        // Delegate to DataviewService since query syntax is standardized
        return DataviewService.parseStandardQuerySyntax(query);
    }

    /**
     * Convert date filter to range (delegates to DataviewService)
     */
    static convertDateFilterToRange(dateFilter: string): {
        start?: string;
        end?: string;
    } | null {
        return DataviewService.convertDateFilterToRange(dateFilter);
    }
}
