import { requestUrl } from "obsidian";
import { PluginSettings } from "../settings";

/**
 * Structured query result from AI parsing
 */
export interface ParsedQuery {
    priority?: number; // 1, 2, 3, 4
    dueDate?: string; // "today", "tomorrow", "overdue", "future", "week", "next-week", or specific date
    status?: string; // "open", "completed", "inProgress"
    folder?: string;
    tags?: string[];
    keywords?: string[];
    originalQuery: string;
}

/**
 * AI-powered query parser that extracts structured filters
 */
export class QueryParserService {
    /**
     * Use AI to parse user query into structured filters
     */
    static async parseQuery(
        query: string,
        settings: PluginSettings,
    ): Promise<ParsedQuery> {
        // Skip AI for very simple queries (optimization)
        const simpleResult = this.trySimpleParse(query);
        if (simpleResult) {
            return simpleResult;
        }

        // Use AI to parse complex queries
        return this.parseWithAI(query, settings);
    }

    /**
     * Try to parse simple queries without AI (fast path)
     */
    private static trySimpleParse(query: string): ParsedQuery | null {
        const lowerQuery = query.toLowerCase().trim();

        // Very simple priority queries
        if (/^(priority\s*1|p1)$/i.test(lowerQuery)) {
            return {
                priority: 1,
                originalQuery: query,
            };
        }
        if (/^(priority\s*2|p2)$/i.test(lowerQuery)) {
            return {
                priority: 2,
                originalQuery: query,
            };
        }

        // Very simple due date queries
        if (/^(today|due\s*today)$/i.test(lowerQuery)) {
            return {
                dueDate: "today",
                originalQuery: query,
            };
        }
        if (/^(overdue|past\s*due)$/i.test(lowerQuery)) {
            return {
                dueDate: "overdue",
                originalQuery: query,
            };
        }

        return null; // Complex query, needs AI
    }

    /**
     * Use AI to parse query into structured format
     */
    private static async parseWithAI(
        query: string,
        settings: PluginSettings,
    ): Promise<ParsedQuery> {
        const systemPrompt = `You are a query parser for a task management system. Parse the user's natural language query into structured filters.

PRIORITY MAPPING:
- 1 = highest/high priority (高优先级, 最高优先级, high, highest)
- 2 = medium priority (中优先级, 普通优先级, medium, normal)
- 3 = low priority (低优先级, low)
- 4 = none/no priority (无优先级, none)

DUE DATE MAPPING:
- "today" = tasks due today (今天, today)
- "tomorrow" = tasks due tomorrow (明天, tomorrow)
- "overdue" = past due tasks (过期, 逾期, overdue)
- "future" = future tasks (未来, 将来, future, upcoming)
- "week" = this week (本周, this week)
- "next-week" = next week (下周, next week)
- Specific dates in YYYY-MM-DD format

STATUS MAPPING:
- "open" = incomplete tasks (未完成, 待办, open, incomplete, pending, todo)
- "completed" = done tasks (完成, 已完成, completed, done, finished)
- "inProgress" = in progress (进行中, 正在做, in progress, ongoing)

Extract ALL filters from the query and return ONLY a JSON object with this structure:
{
  "priority": <number or null>,
  "dueDate": <string or null>,
  "status": <string or null>,
  "folder": <string or null>,
  "tags": [<string array or empty>],
  "keywords": [<string array or empty>]
}

IMPORTANT: 
- Return ONLY valid JSON, no other text
- Use null for missing filters
- For keywords: extract the SEMANTIC meaning, not just literal words
- Example: "如何开发 Task Chat" should extract meaningful phrases like ["开发", "Task Chat", "如何"]
- Remove filter-related words (priority, due date, status) from keywords
- Be smart about language - understand both English and Chinese
- Keywords should help match semantically similar task text`;

        const messages = [
            {
                role: "system",
                content: systemPrompt,
            },
            {
                role: "user",
                content: `Parse this query: "${query}"`,
            },
        ];

        try {
            const response = await this.callAI(messages, settings);
            const parsed = JSON.parse(response);

            return {
                priority: parsed.priority || undefined,
                dueDate: parsed.dueDate || undefined,
                status: parsed.status || undefined,
                folder: parsed.folder || undefined,
                tags: parsed.tags || [],
                keywords: parsed.keywords || [],
                originalQuery: query,
            };
        } catch (error) {
            console.error("Query parsing error:", error);
            // Fallback: return query as keywords
            return {
                keywords: [query],
                originalQuery: query,
            };
        }
    }

    /**
     * Call AI API for parsing
     */
    private static async callAI(
        messages: any[],
        settings: PluginSettings,
    ): Promise<string> {
        if (settings.aiProvider === "ollama") {
            return this.callOllama(messages, settings);
        }

        // OpenAI-compatible API
        const response = await requestUrl({
            url: settings.apiEndpoint,
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                Authorization: `Bearer ${settings.apiKey}`,
            },
            body: JSON.stringify({
                model: settings.model,
                messages: messages,
                temperature: 0.1, // Low temperature for consistent parsing
                max_tokens: 200, // Short response for JSON
            }),
        });

        if (response.status !== 200) {
            throw new Error(`AI API error: ${response.status}`);
        }

        return response.json.choices[0].message.content.trim();
    }

    /**
     * Call Ollama API
     */
    private static async callOllama(
        messages: any[],
        settings: PluginSettings,
    ): Promise<string> {
        const endpoint =
            settings.apiEndpoint || "http://localhost:11434/api/chat";

        const response = await requestUrl({
            url: endpoint,
            method: "POST",
            headers: {
                "Content-Type": "application/json",
            },
            body: JSON.stringify({
                model: settings.model,
                messages: messages,
                stream: false,
            }),
        });

        if (response.status !== 200) {
            throw new Error(`Ollama API error: ${response.status}`);
        }

        return response.json.message.content.trim();
    }
}
