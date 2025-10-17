import { requestUrl } from "obsidian";
import { PluginSettings } from "../settings";
import { ModelProviderService } from "./modelProviderService";
import { PromptBuilderService } from "./promptBuilderService";
import { StopWords } from "./stopWords";

/**
 * Structured query result from AI parsing - Three-part system
 *
 * PART 1: Task Content
 * - Core keywords and semantic expansions for matching task text
 *
 * PART 2: Task Attributes
 * - Structured filters: priority, dueDate, status, folder, tags
 *
 * PART 3: Executor/Environment Context (Future)
 * - Time context, energy state, user preferences, etc.
 * - Reserved for future implementation
 */
export interface ParsedQuery {
    // PART 1: Task Content (Keywords & Semantic Search)
    keywords?: string[]; // Expanded keywords for semantic matching
    coreKeywords?: string[]; // Original extracted keywords before expansion

    // PART 2: Task Attributes (Structured Filters)
    priority?: number; // 1, 2, 3, 4
    dueDate?: string; // "any" (has due date), "today", "tomorrow", "overdue", "future", "week", "next-week", or specific date
    status?: string; // "open", "completed", "inProgress"
    folder?: string;
    tags?: string[];

    // PART 3: Executor/Environment Context (Future - Reserved)
    // timeContext?: string; // Current time, time of day, etc.
    // energyState?: string; // User's energy level, focus state
    // userPreferences?: Record<string, any>; // Custom user context

    // Metadata
    originalQuery?: string;
    expansionMetadata?: {
        enabled: boolean;
        maxExpansionsPerKeyword: number;
        languagesUsed: string[];
        totalKeywords: number; // Total after expansion
        coreKeywordsCount: number; // Original count before expansion
    };
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
     * Uses shared PromptBuilderService for consistent prompt generation
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

        // Get semantic expansion settings
        const maxExpansions = settings.maxKeywordExpansions || 5;
        const expansionEnabled = settings.enableSemanticExpansion !== false;
        // Max keywords to generate PER core keyword (not total for entire query)
        const maxKeywordsPerCore = expansionEnabled
            ? maxExpansions * queryLanguages.length
            : queryLanguages.length; // Just translations, no extra expansions

        // Build user-specific mappings (using shared PromptBuilderService)
        const priorityMapping =
            PromptBuilderService.buildPriorityMappingForParser(settings);
        const statusMapping =
            PromptBuilderService.buildStatusMappingForParser(settings);
        const dateFieldNames =
            PromptBuilderService.buildDateFieldNamesForParser(settings);

        const systemPrompt = `You are a query parser for a task management system. Parse the user's natural language query into structured filters.

THREE-PART QUERY PARSING SYSTEM:
This system extracts queries into three distinct parts:

PART 1: TASK CONTENT (Keywords)
- Core search terms that match task content
- Semantic expansions for better recall

PART 2: TASK ATTRIBUTES (Structured Filters)  
- Priority, due date, status, folder, tags
- Used for precise filtering via DataView API

PART 3: EXECUTOR/ENVIRONMENT CONTEXT (Reserved for future)
- Time context, energy state, etc.
- Not yet implemented

SEMANTIC KEYWORD EXPANSION SETTINGS:
- Languages configured: ${languageList}
- Max expansions per keyword per language: ${maxExpansions}
- Expansion enabled: ${expansionEnabled}
- Max variations to generate PER core keyword: ${maxKeywordsPerCore}
  (Formula: ${maxExpansions} expansions/language × ${queryLanguages.length} languages)

IMPORTANT: This means EACH core keyword should be expanded to approximately ${maxKeywordsPerCore} total variations.
Example with 2 languages and max 5 expansions:
  Core keyword "develop" → ~10 variations total:
  ["develop", "build", "create", "code", "implement",  ← English variations
   "开发", "构建", "创建", "编程", "实现"]              ← Chinese variations

${priorityMapping}

${statusMapping}

${dateFieldNames}

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
- Users may use different field names - recognize all the variations listed above

Extract ALL filters from the query and return ONLY a JSON object with this EXACT structure:
{
  "coreKeywords": [<array of ORIGINAL extracted keywords BEFORE expansion>],
  "keywords": [<array of EXPANDED search terms with translations and semantic variations>],
  "priority": <number or null>,
  "dueDate": <string or null>,
  "status": <string or null>,
  "folder": <string or null>,
  "tags": [<hashtags from query, WITHOUT the # symbol>]
}

⚠️ CRITICAL FIELD USAGE RULES:
1. "coreKeywords" field: ORIGINAL keywords extracted from query (BEFORE expansion)
   - Extract main concepts/nouns/verbs from the query
   - Remove stop words and filter-related terms
   - These are the BASE keywords before semantic expansion
   - Example: "How to develop plugin" → ["develop", "plugin"]

2. "keywords" field: FULLY EXPANDED keywords with ALL semantic variations
   - This should contain ALL variations for ALL core keywords combined
   - For EACH core keyword, generate up to ${maxKeywordsPerCore} variations
   - Include original + translations + synonyms across all languages
   - Distribute evenly: ~${maxExpansions} variations per language in ${languageList}
   - Example for ONE core keyword "develop":
     ["develop", "build", "create", "code", "implement",
      "开发", "构建", "创建", "编程", "实现"]
   - Example for TWO core keywords "fix" + "bug":
     ["fix", "repair", "solve", "correct", "debug",        ← fix variations
      "修复", "解决", "处理", "纠正", "调试",             ← fix 中文
      "bug", "error", "issue", "defect", "fault",        ← bug variations
      "错误", "问题", "缺陷", "故障", "漏洞"]             ← bug 中文
   - Do NOT include hashtags in keywords
   
3. "tags" field: Extract hashtags/tags from query (e.g., #work → ["work"])
   - ONLY extract tags that are explicitly marked with # in the query
   - Remove the # symbol when adding to the array
   - If no hashtags in query, leave empty []
   
4. Return ONLY valid JSON, no reasoning text, no <think> tags, just pure JSON

KEYWORD EXTRACTION & EXPANSION EXAMPLES:

Example 1: Basic expansion
  Query: "如何开发 Task Chat"
  {
    "coreKeywords": ["开发", "Task", "Chat"],
    "keywords": ["开发", "develop", "build", "create", "implement", "Task", "Chat"],
    "tags": []
  }

Example 2: With multiple languages (max ${maxExpansions} per language)
  Query: "Fix bug"
  {
    "coreKeywords": ["fix", "bug"],
    "keywords": ["fix", "修复", "repair", "解决", "solve", "处理", "bug", "错误", "error", "问题", "issue", "故障"],
    "tags": []
  }

Example 3: With task attributes
  Query: "tasks with #work priority 1"
  {
    "coreKeywords": [],
    "keywords": [],
    "tags": ["work"],
    "priority": 1
  }

Example 4: Mixed content
  Query: "Fix bug #urgent #backend"
  {
    "coreKeywords": ["fix", "bug"],
    "keywords": ["fix", "修复", "repair", "solve", "bug", "错误", "error", "问题"],
    "tags": ["urgent", "backend"]
  }

CRITICAL RULES:
- Extract INDIVIDUAL words, not phrases (e.g., "Obsidian AI plugin" → ["Obsidian", "AI", "plugin"] NOT ["Obsidian AI plugin"])
- Always include proper nouns exactly as written (e.g., "Obsidian", "AI", "Task", "Chat")
- For each meaningful keyword, provide translations in ALL configured languages
- Keywords should be 1-2 words maximum, prefer single words for better substring matching
- This enables queries in ANY language to match tasks in ANY other configured language
- Remove filter-related words (priority, due date, status) from keywords
- Remove common stop words (how, what, when, where, why, the, a, an, show, find, 如何, 什么, 怎么, etc.) from keywords
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
                // Split by whitespace and filter stop words
                keywords = StopWords.filterStopWords(
                    query.split(/\s+/).filter((word) => word.length > 0),
                );
            }

            // Post-process keywords to remove stop words (ensures consistency)
            const filteredKeywords = StopWords.filterStopWords(keywords);

            console.log(
                `[Task Chat] Keywords after stop word filtering: ${keywords.length} → ${filteredKeywords.length}`,
            );
            if (keywords.length !== filteredKeywords.length) {
                console.log(
                    `[Task Chat] Removed stop words: [${keywords.filter((k: string) => !filteredKeywords.includes(k)).join(", ")}]`,
                );
            }

            // Extract core keywords (before expansion) and expanded keywords
            const coreKeywords = parsed.coreKeywords || [];
            const expandedKeywords = filteredKeywords;

            // Validate expansion worked correctly
            if (expansionEnabled && coreKeywords.length > 0) {
                const expectedMinKeywords = coreKeywords.length; // At minimum, should have core keywords
                const expectedTargetKeywords =
                    coreKeywords.length * maxKeywordsPerCore;

                if (expandedKeywords.length < expectedMinKeywords) {
                    console.warn(
                        `[Task Chat] Expansion failed: ${coreKeywords.length} core → ${expandedKeywords.length} expanded (expected at least ${expectedMinKeywords})`,
                    );
                } else if (
                    expandedKeywords.length <
                    expectedTargetKeywords * 0.3
                ) {
                    console.warn(
                        `[Task Chat] Expansion under-performing: ${coreKeywords.length} core → ${expandedKeywords.length} expanded (target: ~${expectedTargetKeywords})`,
                    );
                }
            }

            // Build expansion metadata
            const expansionMetadata = {
                enabled: expansionEnabled,
                maxExpansionsPerKeyword: maxExpansions,
                languagesUsed: queryLanguages,
                coreKeywordsCount: coreKeywords.length,
                totalKeywords: expandedKeywords.length,
            };

            // Detailed expansion logging
            console.log(
                "[Task Chat] ========== SEMANTIC EXPANSION DETAILS ==========",
            );
            console.log("[Task Chat] User Settings:", {
                languages: queryLanguages,
                maxExpansionsPerLanguage: maxExpansions,
                targetPerCore: maxKeywordsPerCore,
                expansionEnabled: expansionEnabled,
            });

            console.log("[Task Chat] Extraction Results:", {
                coreKeywords: coreKeywords,
                coreCount: coreKeywords.length,
            });

            console.log("[Task Chat] Expansion Results:", {
                expandedKeywords: expandedKeywords,
                totalExpanded: expandedKeywords.length,
                averagePerCore:
                    coreKeywords.length > 0
                        ? (
                              expandedKeywords.length / coreKeywords.length
                          ).toFixed(1)
                        : "N/A",
                targetPerCore: maxKeywordsPerCore,
            });

            // Analyze language distribution (if possible)
            if (coreKeywords.length > 0 && expandedKeywords.length > 0) {
                const languageBreakdown: Record<string, string[]> = {};
                queryLanguages.forEach((lang) => {
                    languageBreakdown[lang] = [];
                });

                // Try to categorize keywords by language (approximate)
                expandedKeywords.forEach((keyword) => {
                    // Simple heuristic: Chinese characters vs others
                    if (/[\u4e00-\u9fff]/.test(keyword)) {
                        if (languageBreakdown["中文"]) {
                            languageBreakdown["中文"].push(keyword);
                        }
                    } else {
                        if (languageBreakdown["English"]) {
                            languageBreakdown["English"].push(keyword);
                        } else {
                            // First non-Chinese language
                            const firstLang = queryLanguages.find(
                                (l) => l !== "中文",
                            );
                            if (firstLang && languageBreakdown[firstLang]) {
                                languageBreakdown[firstLang].push(keyword);
                            }
                        }
                    }
                });

                console.log("[Task Chat] Language Distribution (estimated):");
                Object.entries(languageBreakdown).forEach(([lang, words]) => {
                    if (words.length > 0) {
                        console.log(
                            `  ${lang}: ${words.length} keywords - [${words.slice(0, 5).join(", ")}${words.length > 5 ? "..." : ""}]`,
                        );
                    }
                });
            }

            console.log(
                "[Task Chat] ================================================",
            );

            // Summary
            console.log("[Task Chat] Semantic expansion summary:", {
                core: coreKeywords.length,
                expanded: expandedKeywords.length,
                perCore:
                    coreKeywords.length > 0
                        ? (
                              expandedKeywords.length / coreKeywords.length
                          ).toFixed(1)
                        : "N/A",
                target: maxKeywordsPerCore,
                enabled: expansionEnabled,
            });

            const result: ParsedQuery = {
                // PART 1: Task Content
                coreKeywords: coreKeywords,
                keywords: expandedKeywords,

                // PART 2: Task Attributes
                priority: parsed.priority || undefined,
                dueDate: parsed.dueDate || undefined,
                status: parsed.status || undefined,
                folder: parsed.folder || undefined,
                tags: parsed.tags || [],

                // Metadata
                originalQuery: query,
                expansionMetadata: expansionMetadata,
            };

            console.log(
                "[Task Chat] Query parser returning (three-part):",
                result,
            );
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
                return settings.openaiApiKey || "";
            case "anthropic":
                return settings.anthropicApiKey || "";
            case "openrouter":
                return settings.openrouterApiKey || "";
            case "ollama":
                return ""; // No API key needed
            default:
                return "";
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
