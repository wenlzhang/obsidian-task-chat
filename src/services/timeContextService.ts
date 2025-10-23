import { PluginSettings } from "../settings";
import { TaskPropertyService } from "./taskPropertyService";
import { DateRange } from "../models/task";

/**
 * Time Context Service
 * 
 * Centralized service for detecting and converting time context terms to date ranges.
 * Used for vague queries where time context (like "today", "this week") should include
 * overdue tasks (everything needing attention by that time).
 * 
 * Key principle: For vague queries, always use "<=" operator to include overdue!
 */
export class TimeContextService {
    /**
     * Detect time context from query string using centralized terms
     * 
     * @param query - User's query string
     * @param settings - Plugin settings
     * @returns Time context type or null if none detected
     */
    static detectTimeContext(
        query: string,
        settings: PluginSettings
    ): {
        type: 'today' | 'tomorrow' | 'yesterday' | 'thisWeek' | 'lastWeek' | 'nextWeek' | 
              'thisMonth' | 'lastMonth' | 'nextMonth' | 
              'thisYear' | 'lastYear' | 'nextYear' | null;
        matchedTerm?: string;
    } {
        const dueDateTerms = TaskPropertyService.getCombinedDueDateTerms(settings);
        const lowerQuery = query.toLowerCase();

        // Check each time context (order matters - more specific first)
        const contexts: Array<{
            type: 'today' | 'tomorrow' | 'yesterday' | 'thisWeek' | 'lastWeek' | 'nextWeek' | 
                  'thisMonth' | 'lastMonth' | 'nextMonth' | 
                  'thisYear' | 'lastYear' | 'nextYear';
            terms: string[];
        }> = [
            { type: 'today', terms: dueDateTerms.today },
            { type: 'tomorrow', terms: dueDateTerms.tomorrow },
            { type: 'yesterday', terms: dueDateTerms.yesterday },
            { type: 'lastWeek', terms: dueDateTerms.lastWeek },
            { type: 'thisWeek', terms: dueDateTerms.thisWeek },
            { type: 'nextWeek', terms: dueDateTerms.nextWeek },
            { type: 'lastMonth', terms: dueDateTerms.lastMonth },
            { type: 'thisMonth', terms: dueDateTerms.thisMonth },
            { type: 'nextMonth', terms: dueDateTerms.nextMonth },
            { type: 'lastYear', terms: dueDateTerms.lastYear },
            { type: 'thisYear', terms: dueDateTerms.thisYear },
            { type: 'nextYear', terms: dueDateTerms.nextYear },
        ];

        for (const context of contexts) {
            for (const term of context.terms) {
                if (lowerQuery.includes(term.toLowerCase())) {
                    return {
                        type: context.type,
                        matchedTerm: term
                    };
                }
            }
        }

        return { type: null };
    }

    /**
     * Convert time context to DateRange with operator
     * For vague queries: Always use "<=" to include overdue tasks
     * 
     * @param timeContext - Time context type
     * @returns DateRange with operator and date string
     */
    static timeContextToRange(
        timeContext: 'today' | 'tomorrow' | 'yesterday' | 'thisWeek' | 'lastWeek' | 'nextWeek' |
                     'thisMonth' | 'lastMonth' | 'nextMonth' |
                     'thisYear' | 'lastYear' | 'nextYear'
    ): DateRange {
        // Map time context to date string and operator
        const mapping: Record<string, { operator: DateRange['operator']; date: string }> = {
            'today': { operator: '<=', date: 'today' },
            'tomorrow': { operator: '<=', date: 'tomorrow' },
            'yesterday': { operator: '=', date: 'yesterday' },
            'thisWeek': { operator: '<=', date: 'end-of-week' },
            'lastWeek': { operator: 'between', date: 'start-of-last-week' },
            'nextWeek': { operator: '<=', date: 'end-of-next-week' },
            'thisMonth': { operator: '<=', date: 'end-of-month' },
            'lastMonth': { operator: 'between', date: 'start-of-last-month' },
            'nextMonth': { operator: '<=', date: 'end-of-next-month' },
            'thisYear': { operator: '<=', date: 'end-of-year' },
            'lastYear': { operator: 'between', date: 'start-of-last-year' },
            'nextYear': { operator: '<=', date: 'end-of-next-year' },
        };

        const config = mapping[timeContext];
        
        // For "between" operator (last week/month/year), set both start and end
        if (config.operator === 'between') {
            let endDate: string;
            if (timeContext === 'lastWeek') {
                endDate = 'end-of-last-week';
            } else if (timeContext === 'lastMonth') {
                endDate = 'end-of-last-month';
            } else if (timeContext === 'lastYear') {
                endDate = 'end-of-last-year';
            }
            
            return {
                operator: 'between',
                date: config.date,
                start: config.date,
                end: endDate!
            };
        }

        return {
            operator: config.operator,
            date: config.date
        };
    }

    /**
     * Get human-readable description of time context range
     * 
     * @param timeContext - Time context type
     * @returns Description string for logging/display
     */
    static getTimeContextDescription(
        timeContext: 'today' | 'tomorrow' | 'yesterday' | 'thisWeek' | 'lastWeek' | 'nextWeek' |
                     'thisMonth' | 'lastMonth' | 'nextMonth' |
                     'thisYear' | 'lastYear' | 'nextYear'
    ): string {
        const descriptions: Record<string, string> = {
            'today': 'Tasks due today + overdue',
            'tomorrow': 'Tasks due tomorrow + today + overdue',
            'yesterday': 'Tasks due yesterday only',
            'thisWeek': 'Tasks due this week + overdue',
            'lastWeek': 'Tasks due last week only',
            'nextWeek': 'Tasks due by end of next week + overdue',
            'thisMonth': 'Tasks due this month + overdue',
            'lastMonth': 'Tasks due last month only',
            'nextMonth': 'Tasks due by end of next month + overdue',
            'thisYear': 'Tasks due this year + overdue',
            'lastYear': 'Tasks due last year only',
            'nextYear': 'Tasks due by end of next year + overdue',
        };

        return descriptions[timeContext];
    }

    /**
     * Detect and convert time context in one step (convenience method)
     * 
     * @param query - User's query string
     * @param settings - Plugin settings
     * @returns DateRange if time context detected, null otherwise
     */
    static detectAndConvertTimeContext(
        query: string,
        settings: PluginSettings
    ): { range: DateRange; description: string; matchedTerm: string } | null {
        const detection = this.detectTimeContext(query, settings);
        
        if (!detection.type) {
            return null;
        }

        const range = this.timeContextToRange(detection.type);
        const description = this.getTimeContextDescription(detection.type);

        return {
            range,
            description,
            matchedTerm: detection.matchedTerm!
        };
    }
}
