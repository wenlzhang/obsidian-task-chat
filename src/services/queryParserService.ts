import { requestUrl } from "obsidian";
import { PluginSettings } from "../settings";

/**
 * Structured query result from AI parsing
 */
export interface ParsedQuery {
    priority?: number; // 1, 2, 3, 4
    dueDate?: string; // "any" (has due date), "today", "tomorrow", "overdue", "future", "week", "next-week", or specific date
    status?: string; // "open", "completed", "inProgress"
    folder?: string;
    tags?: string[];
    keywords?: string[];
    originalQuery?: string;
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
     * Extract JSON from AI response, handling various wrappers and formats
     * Supports: DeepSeek <think> tags, markdown code blocks, reasoning tags, explanatory text
     */
    private static extractJSON(response: string): string {
        // Step 1: Remove various reasoning/thinking blocks from different models
        let cleaned = response
            // DeepSeek's <think> tags
            .replace(/<think>[\s\S]*?<\/think>/gi, "")
            // Generic <reasoning> tags
            .replace(/<reasoning>[\s\S]*?<\/reasoning>/gi, "")
            // Generic <thought> tags
            .replace(/<thought>[\s\S]*?<\/thought>/gi, "")
            .trim();

        // Step 2: Try to extract from markdown code blocks first (common format)
        // Pattern: ```json {...} ``` or ```{...}```
        const markdownMatch = cleaned.match(
            /```(?:json)?\s*(\{[\s\S]*?\})\s*```/,
        );
        if (markdownMatch && markdownMatch[1]) {
            try {
                // Verify it's valid JSON before returning
                JSON.parse(markdownMatch[1]);
                return markdownMatch[1];
            } catch (e) {
                // Continue to other extraction methods
            }
        }

        // Step 3: Find all potential JSON objects (using a more sophisticated approach)
        // Look for balanced braces that could be JSON objects
        const jsonCandidates: string[] = [];
        let braceCount = 0;
        let startIndex = -1;

        for (let i = 0; i < cleaned.length; i++) {
            if (cleaned[i] === "{") {
                if (braceCount === 0) {
                    startIndex = i;
                }
                braceCount++;
            } else if (cleaned[i] === "}") {
                braceCount--;
                if (braceCount === 0 && startIndex !== -1) {
                    // Found a complete JSON object
                    jsonCandidates.push(cleaned.substring(startIndex, i + 1));
                }
            }
        }

        // Step 4: Try to parse each candidate and return the first valid one
        // Prioritize candidates with expected fields (priority, keywords, etc.)
        for (const candidate of jsonCandidates) {
            try {
                const parsed = JSON.parse(candidate);
                // Check if it has expected query parser fields
                if (
                    typeof parsed === "object" &&
                    (parsed.hasOwnProperty("keywords") ||
                        parsed.hasOwnProperty("priority") ||
                        parsed.hasOwnProperty("dueDate") ||
                        parsed.hasOwnProperty("status") ||
                        parsed.hasOwnProperty("folder") ||
                        parsed.hasOwnProperty("tags"))
                ) {
                    return candidate; // This looks like our target JSON
                }
            } catch (e) {
                // Not valid JSON, try next candidate
                continue;
            }
        }

        // Step 5: If no valid query parser JSON found, return the first valid JSON object
        for (const candidate of jsonCandidates) {
            try {
                JSON.parse(candidate);
                return candidate; // At least it's valid JSON
            } catch (e) {
                continue;
            }
        }

        // Step 6: Fallback - use simple first/last brace extraction
        const firstBrace = cleaned.indexOf("{");
        const lastBrace = cleaned.lastIndexOf("}");

        if (firstBrace !== -1 && lastBrace !== -1 && lastBrace > firstBrace) {
            return cleaned.substring(firstBrace, lastBrace + 1);
        }

        // Step 7: If all else fails, return cleaned response and let JSON.parse throw error
        return cleaned;
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
        if (
            /^(due\s*tasks?|tasks?\s*due|has\s*due\s*date)$/i.test(lowerQuery)
        ) {
            return {
                dueDate: "any",
                originalQuery: query,
            };
        }
        if (
            /^(today|due\s*today|tasks?\s*due\s*today|today'?s?\s*tasks?)$/i.test(
                lowerQuery,
            )
        ) {
            return {
                dueDate: "today",
                originalQuery: query,
            };
        }
        if (
            /^(overdue|past\s*due|overdue\s*tasks?|tasks?\s*overdue)$/i.test(
                lowerQuery,
            )
        ) {
            return {
                dueDate: "overdue",
                originalQuery: query,
            };
        }
        if (
            /^(tomorrow|due\s*tomorrow|tasks?\s*due\s*tomorrow)$/i.test(
                lowerQuery,
            )
        ) {
            return {
                dueDate: "tomorrow",
                originalQuery: query,
            };
        }
        if (
            /^(future|future\s*tasks?|upcoming|upcoming\s*tasks?)$/i.test(
                lowerQuery,
            )
        ) {
            return {
                dueDate: "future",
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
        // Get configured languages for semantic search
        const queryLanguages =
            settings.queryLanguages && settings.queryLanguages.length > 0
                ? settings.queryLanguages
                : ["English", "中文"];
        const languageList = queryLanguages.join(", ");

        const systemPrompt = `You are a query parser for a task management system. Parse the user's natural language query into structured filters.

SEMANTIC KEYWORD EXPANSION:
The user has configured the following languages for semantic search: ${languageList}
When extracting keywords, provide translations and semantic variations in ALL configured languages to enable cross-language matching.

PRIORITY MAPPING:
- 1 = highest/high priority (高优先级, 最高优先级, high, highest, p1, 1)
- 2 = medium priority (中优先级, 普通优先级, medium, normal, p2, 2)
- 3 = low priority (低优先级, low, p3, 3)
- 4 = none/no priority (无优先级, none, p4, 4)

DUE DATE MAPPING (normalize different field names to these values):
- "any" = tasks that HAVE a due date (有截止日期, due, due tasks, scheduled, has due date)
- "today" = tasks due today ONLY (今天, today, due today, 今天到期)
- "tomorrow" = tasks due tomorrow ONLY (明天, tomorrow, due tomorrow, 明天到期)
- "overdue" = past due tasks (过期, 逾期, overdue, past due, 已过期)
- "future" = future tasks (未来, 将来, future, upcoming, 将来的)
- "week" = this week (本周, this week, 本周内)
- "next-week" = next week (下周, next week, 下周内)
- Specific dates in YYYY-MM-DD format

IMPORTANT for dueDate:
- "due" or "due tasks" alone means "any" (has a due date)
- Be smart about implied meanings: "deadline tasks" = "any" (has deadline/due date)
- Users may use different field names (due, deadline, dueDate) - ALWAYS map to the values above

STATUS MAPPING:
- "open" = incomplete tasks (未完成, 待办, open, incomplete, pending, todo)
- "completed" = done tasks (完成, 已完成, completed, done, finished)
- "inProgress" = in progress (进行中, 正在做, in progress, ongoing)

Extract ALL filters from the query and return ONLY a JSON object with this EXACT structure:
{
  "priority": <number or null>,
  "dueDate": <string or null>,
  "status": <string or null>,
  "folder": <string or null>,
  "tags": [<hashtags from query, WITHOUT the # symbol>],
  "keywords": [<array of search terms>]
}

⚠️ CRITICAL FIELD USAGE RULES:
1. "tags" field: Extract hashtags/tags from query (e.g., #work → ["work"], #personal → ["personal"])
   - ONLY extract tags that are explicitly marked with # in the query
   - Remove the # symbol when adding to the array
   - If no hashtags in query, leave empty []
   
2. "keywords" field: Extract semantic search terms for matching task content
   - These are the main search terms (nouns, verbs, concepts)
   - Provide translations in ALL configured languages
   - Do NOT include hashtags in keywords
   
3. Return ONLY valid JSON, no reasoning text, no <think> tags, just pure JSON

KEYWORD EXTRACTION RULES:
- Extract INDIVIDUAL WORDS and SHORT TERMS (not long phrases) in ALL configured languages (${languageList})
- Examples for semantic keyword expansion:
  * Query: "如何开发 Task Chat" → Extract: ["开发", "develop", "Task", "Chat", "如何", "how"]
  * Query: "How to develop Obsidian AI plugin" → Extract: ["develop", "开发", "Obsidian", "AI", "plugin", "插件", "how"]
  * Query: "如何开发 Obsidian AI 插件" → Extract: ["开发", "develop", "Obsidian", "AI", "插件", "plugin", "如何", "how"]
  * Query: "Fix bug" → Extract: ["fix", "修复", "bug", "错误", "问题"]
- Examples with tags and keywords:
  * Query: "如何开发 Task Chat" → {"keywords": ["开发", "develop", "Task", "Chat", "如何", "how"], "tags": []}
  * Query: "tasks with #work priority 1" → {"keywords": ["tasks"], "tags": ["work"], "priority": 1}
  * Query: "#personal high priority tasks" → {"keywords": ["tasks"], "tags": ["personal"], "priority": 1}
  * Query: "Fix bug #urgent #backend" → {"keywords": ["fix", "修复", "bug", "错误"], "tags": ["urgent", "backend"]}
  * Query: "开发任务 #项目A" → {"keywords": ["开发", "develop", "任务", "task"], "tags": ["项目A"]}

CRITICAL RULES:
- Extract INDIVIDUAL words, not phrases (e.g., "Obsidian AI plugin" → ["Obsidian", "AI", "plugin"] NOT ["Obsidian AI plugin"])
- Always include proper nouns exactly as written (e.g., "Obsidian", "AI", "Task", "Chat")
- For each meaningful keyword, provide translations in ALL configured languages
- Keywords should be 1-2 words maximum, prefer single words for better substring matching
- This enables queries in ANY language to match tasks in ANY other configured language
- Remove filter-related words (priority, due date, status) from keywords
- Tags and keywords serve DIFFERENT purposes - don't mix them!`;

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
            console.log("[Task Chat] AI query parser raw response:", response);

            // Extract JSON from response (handles DeepSeek's <think> tags and other wrappers)
            const jsonString = this.extractJSON(response);
            const parsed = JSON.parse(jsonString);
            console.log("[Task Chat] AI query parser parsed:", parsed);

            // If AI didn't extract any keywords but also didn't extract any filters,
            // split the query into words as fallback
            let keywords = parsed.keywords || [];
            if (
                keywords.length === 0 &&
                !parsed.priority &&
                !parsed.dueDate &&
                !parsed.status &&
                !parsed.folder &&
                (!parsed.tags || parsed.tags.length === 0)
            ) {
                console.log(
                    "[Task Chat] AI returned no filters or keywords, splitting query into words",
                );
                // Split by whitespace and filter out empty strings
                keywords = query.split(/\s+/).filter((word) => word.length > 0);
            }

            const result = {
                priority: parsed.priority || undefined,
                dueDate: parsed.dueDate || undefined,
                status: parsed.status || undefined,
                folder: parsed.folder || undefined,
                tags: parsed.tags || [],
                keywords: keywords,
                originalQuery: query,
            };

            console.log("[Task Chat] Query parser returning:", result);
            return result;
        } catch (error) {
            console.error("Query parsing error:", error);
            // Fallback: return query as keywords
            console.log(
                `[Task Chat] Query parser fallback: using entire query as keyword: "${query}"`,
            );
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

        if (settings.aiProvider === "anthropic") {
            return this.callAnthropic(messages, settings);
        }

        // Get provider-specific API key
        const apiKey = this.getApiKeyForProvider(settings);
        if (!apiKey) {
            throw new Error(
                `API key for ${settings.aiProvider} is not configured`,
            );
        }

        // OpenAI-compatible API (OpenAI and OpenRouter)
        const response = await requestUrl({
            url: settings.apiEndpoint,
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                Authorization: `Bearer ${apiKey}`,
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
     * Call Anthropic API (different format than OpenAI)
     */
    private static async callAnthropic(
        messages: any[],
        settings: PluginSettings,
    ): Promise<string> {
        const apiKey = this.getApiKeyForProvider(settings);
        if (!apiKey) {
            throw new Error("Anthropic API key is not configured");
        }

        const endpoint =
            settings.apiEndpoint || "https://api.anthropic.com/v1/messages";

        // Separate system message from conversation messages
        const systemMessage = messages.find((m: any) => m.role === "system");
        const conversationMessages = messages.filter(
            (m: any) => m.role !== "system",
        );

        const response = await requestUrl({
            url: endpoint,
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                "x-api-key": apiKey,
                "anthropic-version": "2023-06-01",
            },
            body: JSON.stringify({
                model: settings.model,
                messages: conversationMessages,
                system: systemMessage ? systemMessage.content : undefined,
                temperature: 0.1,
                max_tokens: 200,
            }),
        });

        if (response.status !== 200) {
            throw new Error(`Anthropic API error: ${response.status}`);
        }

        return response.json.content[0].text.trim();
    }

    /**
     * Get API key for the current provider
     */
    private static getApiKeyForProvider(settings: PluginSettings): string {
        switch (settings.aiProvider) {
            case "openai":
                return settings.openaiApiKey || settings.apiKey || "";
            case "anthropic":
                return settings.anthropicApiKey || settings.apiKey || "";
            case "openrouter":
                return settings.openrouterApiKey || settings.apiKey || "";
            case "ollama":
                return ""; // No API key needed
            default:
                return settings.apiKey || "";
        }
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
