import { requestUrl } from "obsidian";
import { PluginSettings, getCurrentProviderConfig } from "../settings";
import { PromptBuilderService } from "./aiPromptBuilderService";
import { AIPropertyPromptService } from "./aiPropertyPromptService";
import { TaskPropertyService } from "./taskPropertyService";
import { StopWords } from "./stopWords";
import { DataviewService } from "./dataviewService";
import { Logger } from "../utils/logger";

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
    // Multi-value support: Can be single value or array
    priority?: number | number[]; // Single: 1, Multi: [1, 2, 3]
    dueDate?: string; // Single date: "today", "overdue", "+5d" (relative)
    dueDateRange?: {
        // Date range: "this week", "next month"
        start: string;
        end: string;
    };
    status?: string | string[]; // Single: "open", Multi: ["open", "inProgress"]
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

    // AI Understanding Metadata (for Natural Language & Typo Correction)
    aiUnderstanding?: {
        detectedLanguage?: string; // Primary language detected - full name (e.g., "English", "Chinese", "Swedish")
        correctedTypos?: string[]; // List of corrections made (e.g., ["urgant→urgent", "taks→task"])
        semanticMappings?: {
            // What AI understood from natural language
            status?: string; // e.g., "working on" → "inprogress"
            priority?: string; // e.g., "urgent" → 1
            dueDate?: string; // e.g., "tomorrow" → specific date
        };
        confidence?: number; // 0-1, how confident AI is in the parsing
        naturalLanguageUsed?: boolean; // Whether user used natural language vs exact syntax
    };
}

/**
 * AI-powered query parser that extracts structured filters
 */
export class QueryParserService {
    /**
     * Use AI to parse user query into structured filters
     *
     * Strategy:
     * 1. Extract standard property syntax (P1, s:open, overdue) via regex
     * 2. Remove extracted properties from query
     * 3. If remaining text has keywords → Use AI to expand those
     * 4. Combine results
     *
     * This ensures:
     * - Pure properties ("P1 overdue") → Skip AI entirely
     * - Mixed queries ("Fix bug P1") → Use AI only for keywords
     * - Pure keywords ("Fix bug") → Use AI for expansion
     */
    static async parseQuery(
        query: string,
        settings: PluginSettings,
    ): Promise<ParsedQuery> {
        // Step 1: Try to extract standard property syntax via regex
        const standardProperties = this.extractStandardProperties(
            query,
            settings,
        );

        // Step 2: Remove standard property syntax from query
        let remainingQuery = this.removeStandardProperties(query);
        remainingQuery = remainingQuery.trim();

        // Step 3: If no remaining keywords, return pure properties result
        if (!remainingQuery || remainingQuery.length === 0) {
            // Pure property query - no AI needed
            return {
                ...standardProperties,
                originalQuery: query,
            };
        }

        // Step 4: Use AI to parse remaining keywords (and detect natural language properties)
        // AI will naturally:
        // - Identify stop words via prompt instructions (smarter than regex)
        // - Extract meaningful keywords only
        // - Expand semantically across configured languages
        const aiResult = await this.parseWithAI(remainingQuery, settings);

        // Step 5: Merge standard properties with AI results
        // Standard properties take precedence (user was explicit)
        return {
            ...aiResult,
            ...standardProperties, // Override with standard syntax if present
            originalQuery: query,
        };
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

        // Step 1.5: Check if response contains markdown headings (## or ###)
        // This indicates the model returned analysis instead of JSON
        if (cleaned.match(/^#{1,6}\s+/m)) {
            Logger.warn(
                "AI returned markdown analysis instead of JSON. First 200 chars:",
                cleaned.substring(0, 200),
            );
            Logger.warn(
                "This often happens with smaller open-source models. Consider using a larger model or a cloud provider.",
            );
            // Continue trying to extract JSON, but log the issue
        }

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

        // Step 7: No JSON found at all - log detailed error
        Logger.error(
            "Failed to extract any JSON from AI response. Full response length:",
            response.length,
        );
        Logger.error("Response preview:", response.substring(0, 500));
        Logger.error(
            "This model may not support structured JSON output reliably. Consider:",
        );
        Logger.error(
            "1. Using a larger model (e.g., llama3.1:70b instead of 20b)",
        );
        Logger.error(
            "2. Using a cloud provider (OpenAI, Anthropic) for better reliability",
        );
        Logger.error(
            "3. Switching to Simple Search mode (which doesn't require AI parsing)",
        );

        // Step 8: Return cleaned response and let JSON.parse throw error with context
        return cleaned;
    }

    /**
     * Extract standard property syntax from query
     * Uses existing DataviewService.parseStandardQuerySyntax() to avoid code duplication
     *
     * This is a lightweight wrapper that delegates to the comprehensive standard parser
     * which handles: Todoist patterns, chrono-node dates, Dataview compatibility, and more.
     */
    private static extractStandardProperties(
        query: string,
        settings: PluginSettings,
    ): Partial<ParsedQuery> {
        // Use existing comprehensive standard syntax parser - it handles:
        // - Priority: p1, p2, p3, p4
        // - Status: s:open, s:completed, s:inprogress, etc.
        // - Due dates: overdue, today, tomorrow, "next Friday" (chrono-node)
        // - Special keywords: no date, recurring, etc.
        // - Projects: ##project
        // - Date ranges: due before:, due after:
        const standardParsed = DataviewService.parseStandardQuerySyntax(query);

        const result: Partial<ParsedQuery> = {};

        // Extract only the properties we need (priority, status, dueDate)
        // Leave keywords to AI for semantic expansion
        if (standardParsed.priority !== undefined) {
            result.priority = standardParsed.priority;
        }

        // Status from statusValues array (s:value syntax)
        // Resolve raw values (aliases, symbols, category names) to category keys
        if (
            standardParsed.statusValues &&
            standardParsed.statusValues.length > 0
        ) {
            // Use centralized resolution from TaskPropertyService
            const resolved = TaskPropertyService.resolveStatusValues(
                standardParsed.statusValues,
                settings,
            );

            if (resolved.length > 0) {
                // Single value or multiple values
                result.status = resolved.length === 1 ? resolved[0] : resolved;
            }
        }

        // Due date from either dueDate field or special keywords
        if (standardParsed.dueDate) {
            result.dueDate = standardParsed.dueDate;
        } else if (standardParsed.specialKeywords) {
            // Map special keywords to dueDate values
            if (standardParsed.specialKeywords.includes("overdue")) {
                result.dueDate = "overdue";
            } else if (standardParsed.specialKeywords.includes("no_date")) {
                result.dueDate = "no date";
            } else if (standardParsed.specialKeywords.includes("has_date")) {
                result.dueDate = "any";
            }
        }

        return result;
    }

    /**
     * Remove standard property syntax from query to get remaining keywords
     * Uses centralized patterns from TaskPropertyService for consistency
     */
    private static removeStandardProperties(query: string): string {
        let cleaned = query;

        // Use centralized QUERY_PATTERNS from TaskPropertyService
        // This ensures consistency across all services

        // Remove priority syntax (p1-p4)
        cleaned = cleaned.replace(
            TaskPropertyService.QUERY_PATTERNS.priority,
            "",
        );

        // Remove status syntax (s:value or s:value1,value2)
        cleaned = cleaned.replace(
            TaskPropertyService.QUERY_PATTERNS.status,
            "",
        );

        // Remove project syntax (##project)
        cleaned = cleaned.replace(
            TaskPropertyService.QUERY_PATTERNS.project,
            "",
        );

        // Remove search syntax (search:"term" or search:term)
        cleaned = cleaned.replace(
            TaskPropertyService.QUERY_PATTERNS.search,
            "",
        );

        // Remove special keywords (centralized patterns)
        cleaned = cleaned.replace(
            TaskPropertyService.QUERY_PATTERNS.specialKeywordOverdue,
            "",
        );
        cleaned = cleaned.replace(
            TaskPropertyService.QUERY_PATTERNS.specialKeywordRecurring,
            "",
        );
        cleaned = cleaned.replace(
            TaskPropertyService.QUERY_PATTERNS.specialKeywordSubtask,
            "",
        );
        cleaned = cleaned.replace(
            TaskPropertyService.QUERY_PATTERNS.specialKeywordNoDate,
            "",
        );
        cleaned = cleaned.replace(
            TaskPropertyService.QUERY_PATTERNS.specialKeywordNoPriority,
            "",
        );

        // Remove date range syntax (centralized patterns)
        cleaned = cleaned.replace(
            TaskPropertyService.QUERY_PATTERNS.dueBeforeRange,
            "",
        );
        cleaned = cleaned.replace(
            TaskPropertyService.QUERY_PATTERNS.dueAfterRange,
            "",
        );
        cleaned = cleaned.replace(
            TaskPropertyService.QUERY_PATTERNS.dateBeforeRange,
            "",
        );
        cleaned = cleaned.replace(
            TaskPropertyService.QUERY_PATTERNS.dateAfterRange,
            "",
        );

        // Remove operators
        cleaned = cleaned.replace(
            TaskPropertyService.QUERY_PATTERNS.operators,
            "",
        );

        // Clean up extra spaces
        cleaned = cleaned.replace(/\s+/g, " ").trim();

        return cleaned;
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
        // Formula: maxExpansions per language × number of languages
        // Example: 5 expansions × 3 languages = 15 semantic equivalents per keyword
        const maxKeywordsPerCore = expansionEnabled
            ? maxExpansions * queryLanguages.length
            : queryLanguages.length; // Just original keywords in each language, no semantic expansion

        // Build property term mappings (three-layer system: user + internal + semantic)
        const propertyTermMappings =
            AIPropertyPromptService.buildPropertyTermMappingsForParser(
                settings,
                queryLanguages,
            );
        const dueDateValueMapping =
            AIPropertyPromptService.buildDueDateValueMapping();
        const statusValueMapping =
            AIPropertyPromptService.buildStatusValueMapping(settings);
        const priorityValueMapping =
            PromptBuilderService.buildPriorityMappingForParser(
                settings,
                queryLanguages,
            );
        const statusMapping = PromptBuilderService.buildStatusMappingForParser(
            settings,
            queryLanguages,
        );
        const dateFieldNames =
            PromptBuilderService.buildDateFieldNamesForParser(settings);

        // Get COMPLETE stop words list dynamically from StopWords class
        const stopWordsList = StopWords.getStopWordsList();
        const stopWordsDisplay = stopWordsList.join('", "');

        const systemPrompt = `Parse user query into structured filters for task search.

OUTPUT FORMAT (JSON only, no markdown):
{
  "coreKeywords": [<original keywords before expansion>],
  "keywords": [<expanded keywords across all languages>],
  "priority": <number/array/null>,
  "dueDate": <string/null>,
  "dueDateRange": <{start, end}/null>,
  "status": <string/array/null>,
  "folder": <string/null>,
  "tags": [<without # symbol>],
  "aiUnderstanding": {
    "detectedLanguage": <full name>,
    "correctedTypos": [<"old→new">],
    "semanticMappings": {
      "priority": <"text → value">,
      "status": <"text → value">,
      "dueDate": <"text → value">
    },
    "confidence": <0-1>,
    "naturalLanguageUsed": <boolean>
  }
}

USER SETTINGS:
Languages: ${languageList}
Expansions per keyword per language: ${maxExpansions}
Total per keyword: ${maxKeywordsPerCore}
Priority mapping: ${JSON.stringify(settings.dataviewPriorityMapping)}
Status categories: ${Object.keys(settings.taskStatusMapping).join(", ")}
Due date field: ${settings.dataviewKeys.dueDate}

=== PARSING RULES ===

1. EXTRACT PROPERTIES FIRST (priority takes precedence):
   
   Priority (urgency/importance) → 1-4:
   - High/urgent/critical/asap → 1
   - Important/medium → 2
   - Normal → 3
   - Low/minor → 4
   - Multiple values: [1, 2] for "priority 1 or 2"
   Mapping: ${JSON.stringify(settings.dataviewPriorityMapping)}
   
   Status (task state) → category key:
   - Valid: ${Object.keys(settings.taskStatusMapping).join(", ")}
   - Examples: open/todo → "open", in progress → "inprogress", done → "completed"
   - Multiple: ["open", "inprogress"] for "open or in progress"
   Full mapping: ${JSON.stringify(settings.taskStatusMapping)}
   
   Due Date (deadline/timing) → date string:
   - today, tomorrow, overdue, this-week, next-week
   - Relative: "+5d" (5 days), "+2w" (2 weeks), "+1m" (1 month)
   - Range: {start: "week-start", end: "week-end"}
   Terms: ${JSON.stringify(settings.userPropertyTerms.dueDate)}

2. EXTRACT KEYWORDS (after removing properties):
   - Meaningful words only (nouns, verbs, adjectives)
   - Skip property words (they're already extracted)
   - Skip generic terms (use specific synonyms)
   - Extract: ["fix", "bug", "payment"]
   NOT: ["show", "me", "urgent", "tasks"]

3. EXPAND KEYWORDS (semantic equivalents):
   - For EACH keyword, generate ${maxExpansions} equivalents in EACH language
   - Total per keyword: ${maxKeywordsPerCore} (${maxExpansions} × ${queryLanguages.length})
   - Think: "How would native speakers express this?"
   - Direct generation in each language (NOT translation)

=== COMPREHENSIVE EXAMPLES ===

Example 1: Pure keywords
Query: "develop Task Chat plugin"
{
  "coreKeywords": ["develop", "Task", "Chat", "plugin"],
  "keywords": [
    "develop", "build", "create", "implement", "code",
    ${queryLanguages[1] ? `"开发", "构建", "创建", "编程", "实现",` : ""}
    ${queryLanguages[2] ? `"utveckla", "bygga", "skapa", "programmera", "implementera",` : ""}
    "Task", "work", "item", "assignment", "job",
    ${queryLanguages[1] ? `"任务", "工作", "事项", "项目", "作业",` : ""}
    ${queryLanguages[2] ? `"uppgift", "arbete", "göra", "uppdrag", "ärende",` : ""}
    "Chat", "conversation", "talk", "discussion", "dialogue",
    ${queryLanguages[1] ? `"聊天", "对话", "交流", "谈话", "沟通",` : ""}
    ${queryLanguages[2] ? `"chatt", "konversation", "prata", "diskussion", "samtal",` : ""}
    "plugin", "extension", "addon", "module", "component",
    ${queryLanguages[1] ? `"插件", "扩展", "组件", "模块", "附加",` : ""}
    ${queryLanguages[2] ? `"plugin", "tillägg", "modul", "komponent", "utökning"` : ""}
  ],
  "priority": null,
  "status": null,
  "dueDate": null,
  "tags": []
}

Example 2: Keywords + multiple properties
Query: "urgent open bugs in payment system due today"
{
  "coreKeywords": ["bugs", "payment", "system"],
  "keywords": [
    "bugs", "errors", "issues", "defects", "problems",
    ${queryLanguages[1] ? `"错误", "问题", "缺陷", "故障", "漏洞",` : ""}
    ${queryLanguages[2] ? `"buggar", "fel", "problem", "defekter", "brister",` : ""}
    "payment", "billing", "pay", "transaction", "invoice",
    ${queryLanguages[1] ? `"支付", "付款", "账单", "交易", "发票",` : ""}
    ${queryLanguages[2] ? `"betalning", "faktura", "betala", "transaktion", "avgift",` : ""}
    "system", "platform", "application", "service", "infrastructure",
    ${queryLanguages[1] ? `"系统", "平台", "应用", "服务", "基础设施",` : ""}
    ${queryLanguages[2] ? `"system", "plattform", "applikation", "tjänst", "infrastruktur"` : ""}
  ],
  "priority": 1,
  "status": "open",
  "dueDate": "today",
  "tags": []
}

Example 3: Pure properties
Query: "priority 1 overdue"
{
  "coreKeywords": [],
  "keywords": [],
  "priority": 1,
  "status": null,
  "dueDate": "overdue",
  "tags": []
}

Example 4: Multilingual (Chinese)
Query: "紧急的进行中任务明天到期"
{
  "coreKeywords": ["任务"],
  "keywords": [
    "任务", "task", "work", "item", "assignment",
    ${queryLanguages[1] ? `"任务", "工作", "事项", "项目", "作业",` : ""}
    ${queryLanguages[2] ? `"uppgift", "arbete", "göra", "uppdrag", "ärende"` : ""}
  ],
  "priority": 1,
  "status": "inprogress",
  "dueDate": "tomorrow",
  "tags": []
}

Example 5: With tags
Query: "Fix bug #backend #urgent due today"
{
  "coreKeywords": ["fix", "bug"],
  "keywords": [
    "fix", "repair", "solve", "correct", "resolve",
    ${queryLanguages[1] ? `"修复", "解决", "处理", "纠正", "修正",` : ""}
    ${queryLanguages[2] ? `"fixa", "reparera", "lösa", "korrigera", "åtgärda",` : ""}
    "bug", "error", "issue", "defect", "problem",
    ${queryLanguages[1] ? `"错误", "问题", "缺陷", "故障", "漏洞",` : ""}
    ${queryLanguages[2] ? `"bugg", "fel", "problem", "defekt", "brist"` : ""}
  ],
  "priority": null,
  "dueDate": "today",
  "status": null,
  "tags": ["backend", "urgent"]
}

=== CRITICAL RULES ===

1. MUTUAL EXCLUSIVITY: If word → property, exclude from keywords
   "urgent bug" → priority: 1, keywords: ["bug"] (NOT ["urgent", "bug"])

2. PROPERTY PRIORITY ORDER:
   Check status → Check priority → Check dueDate → Then keywords
   "important" = status if "important" in ${Object.keys(settings.taskStatusMapping).join(", ")}
   Otherwise check if priority indicator

3. MULTILINGUAL: Recognize concepts in ANY language, not just ${languageList}
   "срочные задачи" (Russian) → priority: 1, keywords: ["задачи"]
   "期限今日" (Japanese) → dueDate: "today"

4. TYPO CORRECTION: Auto-fix common typos
   "urgant" → "urgent", "taks" → "tasks", "complated" → "completed"

5. JSON FORMAT: 
   - NO comments (// or /* */)
   - NO markdown code blocks
   - NO explanatory text
   - PURE valid JSON only
   - Start with { and end with }

6. EXPANSION REQUIREMENT:
   - EVERY keyword needs ${maxKeywordsPerCore} total variations
   - Generate in ALL ${queryLanguages.length} languages
   - Proper nouns also expanded
   - Direct generation (NOT translation)

=== WHAT TO AVOID ===

Generic words (too broad, match everything):
"task", "tasks", "work", "item", "show", "find", "get", "all", "list"

Instead use specific synonyms for the actual concept:
"develop" → "build", "create", "implement", "code" (NOT "work")
"bug" → "error", "issue", "defect", "problem" (NOT "item")

Property words (they go to structured fields):
"urgent", "priority", "overdue", "today", "open", "completed"

⚠️ RETURN ONLY VALID JSON - NO OTHER TEXT`;

        const messages = [
            {
                role: "system",
                content: systemPrompt,
            },
            {
                role: "user",
                content: `Parse: "${query}"

Return ONLY JSON. No markdown, no explanations, no code blocks.`,
            },
        ];

        try {
            const response = await this.callAI(messages, settings);
            Logger.debug("AI query parser raw response:", response);

            // Extract JSON from response (handles DeepSeek's <think> tags and other wrappers)
            const jsonString = this.extractJSON(response);
            const parsed = JSON.parse(jsonString);
            Logger.debug("AI query parser parsed:", parsed);

            // Validate that AI returned the correct schema
            const hasExpectedFields =
                parsed.hasOwnProperty("keywords") ||
                parsed.hasOwnProperty("priority") ||
                parsed.hasOwnProperty("dueDate") ||
                parsed.hasOwnProperty("status") ||
                parsed.hasOwnProperty("folder") ||
                parsed.hasOwnProperty("tags");

            if (!hasExpectedFields) {
                Logger.error(
                    "⚠️ AI RETURNED WRONG JSON SCHEMA! Expected query parser fields but got:",
                    Object.keys(parsed),
                );
                Logger.error(
                    "This model returned linguistic analysis instead of query parsing.",
                );
                Logger.error(
                    `Model: ${getCurrentProviderConfig(settings).model}, Provider: ${settings.aiProvider}`,
                );
                Logger.error("Full response:", response.substring(0, 500));
                Logger.error(
                    "Recommendation: Switch to a larger model or cloud provider (OpenAI, Anthropic, OpenRouter).",
                );
            }

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
                Logger.debug(
                    "AI returned no filters or keywords, splitting query into words",
                );
                // Split by whitespace and filter stop words
                keywords = StopWords.filterStopWords(
                    query.split(/\s+/).filter((word) => word.length > 0),
                );
            }

            // Post-process keywords to remove stop words (safety net)
            // AI is instructed via prompt to NOT extract stop words (see STOP WORDS section in prompt)
            // This post-filter is a safety net in case AI ignores instructions
            const filteredKeywords = StopWords.filterStopWords(keywords);

            Logger.debug(
                `Keywords after stop word filtering: ${keywords.length} → ${filteredKeywords.length}`,
            );
            if (keywords.length !== filteredKeywords.length) {
                Logger.debug(
                    `[AI Parser] Post-filter safety net removed ${keywords.length - filteredKeywords.length} stop words that AI missed`,
                );
                Logger.debug(
                    `[AI Parser] Removed: [${keywords.filter((k: string) => !filteredKeywords.includes(k)).join(", ")}]`,
                );
            }

            // Extract core keywords and filter stop words (safety net)
            // AI should not extract stop words (prompt instructs this) but we verify
            const rawCoreKeywords = parsed.coreKeywords || [];
            const coreKeywords = StopWords.filterStopWords(rawCoreKeywords);

            if (rawCoreKeywords.length !== coreKeywords.length) {
                Logger.debug(
                    `[AI Parser] Post-filter safety net removed ${rawCoreKeywords.length - coreKeywords.length} stop words from core keywords`,
                );
                Logger.debug(
                    `[AI Parser] Removed: [${rawCoreKeywords.filter((k: string) => !coreKeywords.includes(k)).join(", ")}]`,
                );
            }

            const expandedKeywords = filteredKeywords;

            // Validate expansion worked correctly
            if (expansionEnabled && coreKeywords.length > 0) {
                const expectedMinKeywords = coreKeywords.length; // At minimum, should have core keywords
                const expectedTargetKeywords =
                    coreKeywords.length * maxKeywordsPerCore;

                if (expandedKeywords.length < expectedMinKeywords) {
                    Logger.warn(
                        `Expansion failed: ${coreKeywords.length} core → ${expandedKeywords.length} expanded (expected at least ${expectedMinKeywords})`,
                    );
                } else if (
                    expandedKeywords.length <
                    expectedTargetKeywords * 0.3
                ) {
                    Logger.warn(
                        `Expansion under-performing: ${coreKeywords.length} core → ${expandedKeywords.length} expanded (target: ~${expectedTargetKeywords})`,
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
            Logger.debug("========== SEMANTIC EXPANSION DETAILS ==========");
            Logger.debug("User Settings:", {
                languages: queryLanguages,
                maxExpansionsPerLanguage: maxExpansions,
                targetPerCore: maxKeywordsPerCore,
                expansionEnabled: expansionEnabled,
            });

            Logger.debug("Extraction Results:", {
                coreKeywords: coreKeywords,
                coreCount: coreKeywords.length,
            });

            Logger.debug("Expansion Results:", {
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
                    // Detect language based on character patterns
                    if (/[\u4e00-\u9fff]/.test(keyword)) {
                        // Chinese characters
                        if (languageBreakdown["中文"]) {
                            languageBreakdown["中文"].push(keyword);
                        }
                    } else if (
                        /[\u00e4\u00e5\u00f6]/.test(keyword.toLowerCase())
                    ) {
                        // Swedish special characters (ä, å, ö)
                        if (languageBreakdown["Svenska"]) {
                            languageBreakdown["Svenska"].push(keyword);
                        } else {
                            // Fallback for Swedish if not in breakdown
                            const swedishLang = queryLanguages.find(
                                (l) =>
                                    l.toLowerCase().includes("svenska") ||
                                    l.toLowerCase().includes("swedish"),
                            );
                            if (swedishLang && languageBreakdown[swedishLang]) {
                                languageBreakdown[swedishLang].push(keyword);
                            }
                        }
                    } else {
                        // Default to English or first non-Chinese language
                        if (languageBreakdown["English"]) {
                            languageBreakdown["English"].push(keyword);
                        } else {
                            const firstLang = queryLanguages.find(
                                (l) =>
                                    l !== "中文" &&
                                    !l.toLowerCase().includes("svenska") &&
                                    !l.toLowerCase().includes("swedish"),
                            );
                            if (firstLang && languageBreakdown[firstLang]) {
                                languageBreakdown[firstLang].push(keyword);
                            }
                        }
                    }
                });

                Logger.debug(
                    "Language Distribution (estimated - for diagnostics only):",
                );
                Logger.debug(
                    "Note: This uses heuristics to estimate distribution. Actual functionality doesn't depend on detection.",
                );

                // Check for missing languages
                const missingLanguages: string[] = [];
                const expectedMinPerLanguage = Math.floor(maxExpansions * 0.5); // At least 50% of expected

                Object.entries(languageBreakdown).forEach(([lang, words]) => {
                    if (words.length > 0) {
                        Logger.debug(
                            `  ${lang}: ${words.length} keywords - [${words.slice(0, 5).join(", ")}${words.length > 5 ? "..." : ""}]`,
                        );
                    } else {
                        Logger.debug(`  ${lang}: 0 keywords ⚠️ MISSING!`);
                        missingLanguages.push(lang);
                    }

                    // Warn if language has very few keywords
                    if (
                        words.length > 0 &&
                        words.length < expectedMinPerLanguage &&
                        coreKeywords.length > 0
                    ) {
                        Logger.warn(
                            `Language "${lang}" has only ${words.length} keywords (expected at least ${expectedMinPerLanguage} per core keyword)`,
                        );
                    }
                });

                // Warning if languages appear to be missing (based on heuristic detection)
                if (missingLanguages.length > 0) {
                    Logger.warn(
                        `⚠️ Language detection heuristic couldn't find ${missingLanguages.length} language(s): ${missingLanguages.join(", ")}`,
                    );
                    Logger.warn(
                        `This may indicate AI under-expansion. Check if keywords are actually present for all languages.`,
                    );
                    Logger.warn(
                        `Note: Detection is imperfect - some words without special characters may be miscategorized.`,
                    );
                    Logger.warn(
                        `Recommendation: If expansion count is low (${expandedKeywords.length} < ${coreKeywords.length * maxKeywordsPerCore}), AI may not understand language name "${missingLanguages.join(", ")}".`,
                    );
                }
            }

            Logger.debug("================================================");

            // Summary
            Logger.debug("Semantic expansion summary:", {
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

            // Log AI Understanding metadata if present
            if (parsed.aiUnderstanding) {
                Logger.debug("========== AI UNDERSTANDING ==========");
                Logger.debug(
                    "Detected language:",
                    parsed.aiUnderstanding.detectedLanguage || "unknown",
                );
                Logger.debug(
                    "Confidence:",
                    parsed.aiUnderstanding.confidence !== undefined
                        ? `${(parsed.aiUnderstanding.confidence * 100).toFixed(0)}%`
                        : "unknown",
                );
                Logger.debug(
                    "Natural language used:",
                    parsed.aiUnderstanding.naturalLanguageUsed || false,
                );
                if (
                    parsed.aiUnderstanding.correctedTypos &&
                    parsed.aiUnderstanding.correctedTypos.length > 0
                ) {
                    Logger.debug(
                        "Typos corrected:",
                        parsed.aiUnderstanding.correctedTypos,
                    );
                }
                if (parsed.aiUnderstanding.notes) {
                    Logger.debug("Notes:", parsed.aiUnderstanding.notes);
                }
                Logger.debug(
                    "================================================",
                );
            }

            // PART 1-3: Return complete three-part query result
            const result: ParsedQuery = {
                // PART 1: Task Content (Keywords)
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

                // AI Understanding (for UI display and fallback decisions)
                aiUnderstanding: parsed.aiUnderstanding || undefined,
            };

            Logger.debug("Query parser returning (three-part):", result);
            return result;
        } catch (error) {
            Logger.error("Query parsing error:", error);
            // Fallback: return query as keywords
            Logger.debug(
                `Query parser fallback: using entire query as keyword: "${query}"`,
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

        const providerConfig = getCurrentProviderConfig(settings);

        // OpenAI-compatible API (OpenAI and OpenRouter)
        const response = await requestUrl({
            url: providerConfig.apiEndpoint,
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                Authorization: `Bearer ${apiKey}`,
            },
            body: JSON.stringify({
                model: providerConfig.model,
                messages: messages,
                temperature: providerConfig.temperature, // User-configurable, recommended 0.1 for JSON parsing
                max_tokens: providerConfig.maxTokens, // User-configurable response length
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

        const providerConfig = getCurrentProviderConfig(settings);
        const endpoint =
            providerConfig.apiEndpoint ||
            "https://api.anthropic.com/v1/messages";

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
                model: providerConfig.model,
                messages: conversationMessages,
                system: systemMessage ? systemMessage.content : undefined,
                temperature: providerConfig.temperature, // User-configurable, recommended 0.1 for JSON parsing
                max_tokens: providerConfig.maxTokens, // User-configurable response length
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
        return getCurrentProviderConfig(settings).apiKey || "";
    }

    /**
     * Call Ollama API
     *
     * Ollama API format differs from OpenAI/OpenRouter:
     * - Parameters go inside 'options' object
     * - Uses 'num_predict' instead of 'max_tokens'
     * - Response has 'message' field directly (not 'choices')
     * - Requires consistent formatting with aiService.ts
     */
    private static async callOllama(
        messages: any[],
        settings: PluginSettings,
    ): Promise<string> {
        const providerConfig = getCurrentProviderConfig(settings);
        const endpoint =
            providerConfig.apiEndpoint || "http://localhost:11434/api/chat";

        try {
            const response = await requestUrl({
                url: endpoint,
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                },
                body: JSON.stringify({
                    model: providerConfig.model,
                    messages: messages,
                    stream: false, // Query parsing must NOT stream - needs complete JSON response
                    options: {
                        temperature: providerConfig.temperature, // User-configurable, recommended 0.1 for JSON parsing
                        num_predict: providerConfig.maxTokens, // User-configurable response length (Ollama parameter name)
                        num_ctx: providerConfig.contextWindow, // User-configurable context window (Ollama-specific)
                    },
                }),
            });

            if (response.status !== 200) {
                const errorMsg =
                    response.json?.error || response.text || "Unknown error";
                throw new Error(
                    `Ollama API error (${response.status}): ${errorMsg}. ` +
                        `Ensure Ollama is running and model '${providerConfig.model}' is available. ` +
                        `Try: ollama run ${providerConfig.model}`,
                );
            }

            const data = response.json;

            // Validate response structure
            if (!data || !data.message || !data.message.content) {
                throw new Error(
                    `Invalid Ollama response structure. Expected {message: {content: "..."}}, ` +
                        `got: ${JSON.stringify(data).substring(0, 200)}`,
                );
            }

            const responseContent = data.message.content.trim();

            if (responseContent.length === 0) {
                throw new Error(
                    "Ollama returned empty content. This may indicate the model failed to generate a response.",
                );
            }

            Logger.debug(
                `[Ollama Query Parser] Received ${responseContent.length} chars from ${providerConfig.model}`,
            );

            return responseContent;
        } catch (error) {
            // Enhanced error handling for common Ollama issues
            const errorMsg = error.message || String(error);

            if (
                errorMsg.includes("ECONNREFUSED") ||
                errorMsg.includes("fetch")
            ) {
                throw new Error(
                    `Cannot connect to Ollama at ${endpoint}. ` +
                        `Please ensure Ollama is running. Start it with: ollama serve`,
                );
            }

            if (errorMsg.includes("model") || errorMsg.includes("not found")) {
                throw new Error(
                    `Model '${providerConfig.model}' not found in Ollama. ` +
                        `Install it with: ollama pull ${providerConfig.model}`,
                );
            }

            // Re-throw with context
            throw new Error(`Ollama query parsing failed: ${errorMsg}`);
        }
    }
}
