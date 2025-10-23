import { PluginSettings } from "../settings";
import { TaskPropertyService } from "./taskPropertyService";

/**
 * Property Detection Service
 *
 * NON-AI service for property term recognition in Simple Search mode
 *
 * Provides three-layer property term recognition:
 * Layer 1: User-configured terms (highest priority)
 * Layer 2: Internal embedded mappings (fallback)
 * Layer 3: Semantic expansion (handled by AI services)
 *
 * Used by: Simple Search (regex-based detection)
 */
export class PropertyDetectionService {
    /**
     * Get combined property terms (user-configured + base terms)
     * Delegates to TaskPropertyService for centralized term management
     *
     * @param settings Plugin settings containing user-configured terms
     * @returns Combined property terms ready for use
     */
    static getCombinedPropertyTerms(settings: PluginSettings) {
        return {
            priority: TaskPropertyService.getCombinedPriorityTerms(settings),
            dueDate: TaskPropertyService.getCombinedDueDateTerms(settings),
            status: TaskPropertyService.getCombinedStatusTerms(settings),
        };
    }

    /**
     * Simple regex-based property recognition for Simple Search mode
     * Uses combined terms (user + internal) for regex matching
     *
     * @param query User's search query
     * @param settings Plugin settings
     * @returns Detected property hints for Simple Search
     */
    static detectPropertiesSimple(
        query: string,
        settings: PluginSettings,
    ): {
        hasPriority: boolean;
        hasDueDate: boolean;
        hasStatus: boolean;
    } {
        const combined = this.getCombinedPropertyTerms(settings);
        const lowerQuery = query.toLowerCase();

        // Check for priority terms
        const hasPriority =
            combined.priority.general.some((term) =>
                lowerQuery.includes(term.toLowerCase()),
            ) ||
            combined.priority.high.some((term) =>
                lowerQuery.includes(term.toLowerCase()),
            ) ||
            combined.priority.medium.some((term) =>
                lowerQuery.includes(term.toLowerCase()),
            ) ||
            combined.priority.low.some((term) =>
                lowerQuery.includes(term.toLowerCase()),
            );

        // Check for due date terms (all time contexts)
        const hasDueDate =
            combined.dueDate.general.some((term) =>
                lowerQuery.includes(term.toLowerCase()),
            ) ||
            combined.dueDate.today.some((term) =>
                lowerQuery.includes(term.toLowerCase()),
            ) ||
            combined.dueDate.tomorrow.some((term) =>
                lowerQuery.includes(term.toLowerCase()),
            ) ||
            combined.dueDate.overdue.some((term) =>
                lowerQuery.includes(term.toLowerCase()),
            ) ||
            combined.dueDate.lastWeek.some((term) =>
                lowerQuery.includes(term.toLowerCase()),
            ) ||
            combined.dueDate.thisWeek.some((term) =>
                lowerQuery.includes(term.toLowerCase()),
            ) ||
            combined.dueDate.nextWeek.some((term) =>
                lowerQuery.includes(term.toLowerCase()),
            ) ||
            combined.dueDate.lastMonth.some((term) =>
                lowerQuery.includes(term.toLowerCase()),
            ) ||
            combined.dueDate.thisMonth.some((term) =>
                lowerQuery.includes(term.toLowerCase()),
            ) ||
            combined.dueDate.nextMonth.some((term) =>
                lowerQuery.includes(term.toLowerCase()),
            ) ||
            combined.dueDate.lastYear.some((term) =>
                lowerQuery.includes(term.toLowerCase()),
            ) ||
            combined.dueDate.thisYear.some((term) =>
                lowerQuery.includes(term.toLowerCase()),
            ) ||
            combined.dueDate.nextYear.some((term) =>
                lowerQuery.includes(term.toLowerCase()),
            ) ||
            combined.dueDate.future.some((term) =>
                lowerQuery.includes(term.toLowerCase()),
            );

        // Check for status terms (dynamically check ALL categories)
        let hasStatus = false;
        if (
            combined.status.general.some((term) =>
                lowerQuery.includes(term.toLowerCase()),
            )
        ) {
            hasStatus = true;
        } else {
            // Check all status categories dynamically (supports custom categories)
            for (const [categoryKey, terms] of Object.entries(
                combined.status,
            )) {
                if (categoryKey === "general") continue; // Already checked above
                if (
                    Array.isArray(terms) &&
                    terms.some((term) =>
                        lowerQuery.includes(term.toLowerCase()),
                    )
                ) {
                    hasStatus = true;
                    break;
                }
            }
        }

        return {
            hasPriority,
            hasDueDate,
            hasStatus,
        };
    }
}
