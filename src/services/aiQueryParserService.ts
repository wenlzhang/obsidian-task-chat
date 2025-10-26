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

        const systemPrompt = `You are a user query parser for a task management system. Parse the user's natural language query into structured filters.

THREE-PART QUERY PARSING SYSTEM:
This system extracts queries into three distinct parts:

PART 1: TASK CONTENT (Keywords)
- Core keywords that match task content
- Semantic expansions for the core keywords for better recall

PART 2: TASK ATTRIBUTES (Structured Filters)
- Due date, priority, status, folder, tags
- Used for precise task filtering via Dataview API

PART 3: EXECUTOR & ENVIRONMENT CONTEXT (Reserved for future)
- Time context, energy state, location, equipment, etc.
- Not yet implemented

PART 1: TASK CONTENT (Keywords) BREAKDOWN

SEMANTIC KEYWORD EXPANSION SETTINGS:
- Languages configured: ${languageList}
- Number of languages: ${queryLanguages.length}
- Target expansions per keyword per language: ${maxExpansions}
- Expansion enabled: ${expansionEnabled}
- Target variations to generate PER core keyword: ${maxKeywordsPerCore}
  (Formula: ${maxExpansions} expansions/language × ${queryLanguages.length} languages)

🚨 CRITICAL EXPANSION REQUIREMENT:
You MUST expand EVERY SINGLE core keyword into ALL ${queryLanguages.length} configured languages: ${languageList}

⚠️ KEY CONCEPT: Direct Cross-Language Semantic Equivalence
- This is NOT a translation task!
- For EACH core keyword, generate semantic equivalents DIRECTLY in each target language
- Think: "What are different ways to express this CONCEPT in language X?"
- Example: "开发" in English context can include develop, build, implement
- Example: "Task" in Chinese context can include 任务, 工作, 事项

For EACH core keyword (including proper nouns like "Task", "Chat", etc.):
- Iterate over every language in the user's configuration (queryLanguages array):
${
    queryLanguages.length > 0
        ? queryLanguages
              .map(
                  (lang, idx) =>
                      `  - queryLanguages[${idx}] = ${lang} → Generate ${maxExpansions} semantic equivalents DIRECTLY in this language`,
              )
              .join("\n")
        : `  - No additional languages configured → Generate ${maxExpansions} semantic equivalents identified from the user's query language`
}
- Total: EXACTLY ${maxKeywordsPerCore} variations per core keyword

⚠️ NO EXCEPTIONS:
- Do NOT skip any language for ANY keyword (regardless of keyword's source language)
- Do NOT treat proper nouns differently - expand them too!
- Do NOT leave core keywords unexpanded
- Do NOT just translate - generate semantic equivalents!
- EVERY core keyword MUST have ${maxKeywordsPerCore} total variations

Example with ${queryLanguages.length} languages and target ${maxExpansions} expansions:
  Core keyword "develop" → ~${maxKeywordsPerCore} variations total:
  ${queryLanguages.map((lang, idx) => `[variations ${idx * maxExpansions + 1}-${(idx + 1) * maxExpansions} in ${lang}]`).join(", ")}

PART 2: TASK ATTRIBUTES (Structured Filters) BREAKDOWN

🚨 TASK PROPERTY RECOGNITION (Direct Concept-to-Dataview Conversion)

**CRITICAL PRINCIPLE**: Properties use CONCEPT RECOGNITION and CONVERSION!

Unlike keywords (which need semantic expansion for better recall), task properties use your native language understanding to:
1. Recognize the concept (STATUS, PRIORITY, DUE_DATE) in ANY language
2. Convert directly to Dataview-compatible format (category keys, numbers, dates)

NO expansion needed - you already understand all languages!

**CONFIGURED LANGUAGES FOR CONTEXT**:
You're working with ${queryLanguages.length} configured languages: ${languageList}
- Use this context to better understand property terms in these languages
- But remember: You can recognize properties in ANY language, not just these

**YOUR NATIVE LANGUAGE UNDERSTANDING**:
You have native understanding of ALL human languages. Use this to:

1. **Recognize Property CONCEPTS** (in ANY language the user types):
    - **DUE_DATE concept** = Deadline, target date, timing, expiration
    - **PRIORITY concept** = Urgency, criticality, high/low priority
    - **STATUS concept** = State, condition, progress level, completion state

2. **Convert DIRECTLY to Dataview format** (always English field names):
   - PRIORITY concept → priority: 1-4 (number) or null
     * Urgent/critical/high/asap → 1
     * Medium → 2
     * Normal → 3
     * Low/minor → 4
     * null = user wants tasks WITH priority (any value, including none value)
   
   - STATUS concept → status: string or null
     * Open/todo/pending → open category
     * In progress/doing/working/active → inprogress category
     * Done/finished/completed → completed category
     * Cancelled/abandoned/dropped → cancelled category
     * Use category keys from STATUS MAPPING below (supports custom categories)
   
   - DUE_DATE concept → dueDate: string or null
     * Specific values defined in DUE DATE VALUE MAPPING below
     * Common: "today", "tomorrow", "overdue", "any", "future", "this-week", "next-week"
     * "any" = user wants tasks WITH due dates (not a specific date)

3. **Respect User Settings**:
   - Priority mappings: ${JSON.stringify(settings.dataviewPriorityMapping)}
   - Status mappings: ${JSON.stringify(settings.taskStatusMapping)}
   - Due date field name: "${settings.dataviewKeys.dueDate}"
   - User's due date terms: ${JSON.stringify(settings.userPropertyTerms.dueDate)}
   - See detailed mappings below for complete property recognition rules

**PROCESS FOR PROPERTIES**:
1. Read user's query in ANY language
2. Recognize which concepts are expressed (priority? status? due date?)
3. Convert directly to Dataview format (category keys, not expanded terms)
4. Use native language understanding - NO expansion needed!

**Examples of Direct Conversion**:
English: "urgent tasks" → priority: 1, keywords: ["tasks"]
中文: "紧急任务" → priority: 1, keywords: ["任务"]  

English: "in progress" → status: "inprogress", keywords: []
中文: "进行中" → status: "inprogress", keywords: []

English: "overdue tasks" → dueDate: "overdue", keywords: ["tasks"]
中文: "过期任务" → dueDate: "overdue", keywords: ["任务"]

**Key Points**:
- Properties = concept recognition + direct conversion to category keys (NO expansion)
- Keywords = semantic expansion across languages for better matching (YES expansion)
- You already know all languages - use native understanding, not pre-programmed phrases
- Map concept → category key (language-independent internal identifier)

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

=== PARSING RULES ===

1. EXTRACT PROPERTIES FIRST (priority takes precedence):
   
   Priority (urgency/importance) → 1-4:
   - High/urgent/critical/asap → 1
   - Medium → 2
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

CATEGORY 1: TASK CONTENT ONLY (Keywords, No Properties)
These examples show queries with ONLY keywords - no priority, status, or due date filters.

Example 1A: Pure keywords (English)
Query: "develop Task Chat plugin"
Process:
1. No properties detected → All words are potential keywords
2. Extract core keywords: ["develop", "Task", "Chat", "plugin"]
3. Expand EACH keyword across ALL ${queryLanguages.length} configured languages
4. Generate ${maxExpansions} equivalents per language per keyword
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
  "dueDateRange": null,
  "folder": null,
  "tags": [],
  "aiUnderstanding": {
    "detectedLanguage": "English",
    "correctedTypos": [],
    "semanticMappings": {},
    "confidence": 0.95,
    "naturalLanguageUsed": false
  }
}

Example 1B: Keywords only (Multilingual - Chinese)
Query: "如何开发 Task Chat 插件"
Process:
1. Detect language: Chinese
2. Extract core keywords: ["开发", "Task", "Chat", "插件"]
3. Expand EACH across all languages (including back to Chinese!)
{
  "coreKeywords": ["开发", "Task", "Chat", "插件"],
  "keywords": [
    "开发", "develop", "build", "create", "implement",
    ${queryLanguages[1] ? `"开发", "构建", "创建", "编程", "实现",` : ""}
    ${queryLanguages[2] ? `"utveckla", "bygga", "skapa", "programmera", "kod",` : ""}
    "Task", "work", "item", "assignment", "job",
    ${queryLanguages[1] ? `"任务", "工作", "事项", "项目", "作业",` : ""}
    ${queryLanguages[2] ? `"uppgift", "arbete", "göra", "uppdrag", "ärende",` : ""}
    "Chat", "conversation", "talk", "discussion", "dialogue",
    ${queryLanguages[1] ? `"聊天", "对话", "交流", "谈话", "沟通",` : ""}
    ${queryLanguages[2] ? `"chatt", "konversation", "prata", "diskussion", "samtal",` : ""}
    "插件", "plugin", "extension", "addon", "module",
    ${queryLanguages[1] ? `"插件", "扩展", "组件", "模块", "附加",` : ""}
    ${queryLanguages[2] ? `"plugin", "tillägg", "modul", "komponent", "utökning"` : ""}
  ],
  "priority": null,
  "status": null,
  "dueDate": null,
  "dueDateRange": null,
  "folder": null,
  "tags": [],
  "aiUnderstanding": {
    "detectedLanguage": "中文",
    "correctedTypos": [],
    "semanticMappings": {},
    "confidence": 0.95,
    "naturalLanguageUsed": false
  }
}

CATEGORY 2: TASK PROPERTIES ONLY (No Keywords)
These examples show queries with ONLY properties - using STANDARD SYNTAX (exact field names and values).

Example 2A: Properties only - Standard syntax (exact field values)
Query: "priority 1 open"
Process:
1. Recognize "priority 1" → priority: 1
2. Recognize "open" → status: "open"
3. No keywords to extract
{
  "coreKeywords": [],
  "keywords": [],
  "priority": 1,
  "status": "open",
  "dueDate": null,
  "dueDateRange": null,
  "folder": null,
  "tags": [],
  "aiUnderstanding": {
    "detectedLanguage": "English",
    "correctedTypos": [],
    "semanticMappings": {
      "priority": "priority 1 → 1",
      "status": "open → open"
    },
    "confidence": 1.0,
    "naturalLanguageUsed": false
  }
}

Example 2B: Properties only - Standard syntax (due date + status)
Query: "status inprogress due today"
Process:
1. Recognize "status inprogress" → status: "inprogress"
2. Recognize "due today" → dueDate: "today"
{
  "coreKeywords": [],
  "keywords": [],
  "priority": null,
  "status": "inprogress",
  "dueDate": "today",
  "dueDateRange": null,
  "folder": null,
  "tags": [],
  "aiUnderstanding": {
    "detectedLanguage": "English",
    "correctedTypos": [],
    "semanticMappings": {
      "status": "inprogress → inprogress",
      "dueDate": "today → today"
    },
    "confidence": 1.0,
    "naturalLanguageUsed": false
  }
}

CATEGORY 3: TASK PROPERTIES ONLY - NON-STANDARD SYNTAX (Natural Language)
These examples show queries with ONLY properties - using NATURAL LANGUAGE (urgent, in progress, overdue).

Example 3A: Properties only - Natural language (priority)
Query: "urgent tasks"
Process:
1. Recognize concept: "urgent" → PRIORITY concept → priority: 1
2. "tasks" is too generic (in stop words) → exclude from keywords
{
  "coreKeywords": [],
  "keywords": [],
  "priority": 1,
  "status": null,
  "dueDate": null,
  "dueDateRange": null,
  "folder": null,
  "tags": [],
  "aiUnderstanding": {
    "detectedLanguage": "English",
    "correctedTypos": [],
    "semanticMappings": {
      "priority": "urgent → 1"
    },
    "confidence": 0.9,
    "naturalLanguageUsed": true
  }
}

Example 3B: Properties only - Natural language (status)
Query: "working on"
Process:
1. Recognize concept: "working on" → STATUS concept (in progress) → status: "inprogress"
{
  "coreKeywords": [],
  "keywords": [],
  "priority": null,
  "status": "inprogress",
  "dueDate": null,
  "dueDateRange": null,
  "folder": null,
  "tags": [],
  "aiUnderstanding": {
    "detectedLanguage": "English",
    "correctedTypos": [],
    "semanticMappings": {
      "status": "working on → inprogress"
    },
    "confidence": 0.85,
    "naturalLanguageUsed": true
  }
}

Example 3C: Properties only - Natural language (all three)
Query: "urgent stuff in progress overdue"
Process:
1. "urgent" → PRIORITY concept → priority: 1
2. "in progress" → STATUS concept → status: "inprogress"
3. "overdue" → DUE_DATE concept → dueDate: "overdue"
4. "stuff" is too generic → exclude from keywords
{
  "coreKeywords": [],
  "keywords": [],
  "priority": 1,
  "status": "inprogress",
  "dueDate": "overdue",
  "dueDateRange": null,
  "folder": null,
  "tags": [],
  "aiUnderstanding": {
    "detectedLanguage": "English",
    "correctedTypos": [],
    "semanticMappings": {
      "priority": "urgent → 1",
      "status": "in progress → inprogress",
      "dueDate": "overdue → overdue"
    },
    "confidence": 0.9,
    "naturalLanguageUsed": true
  }
}

Example 3D: Properties only - Multilingual natural language (Chinese)
Query: "紧急的进行中任务，明天到期"
Process:
1. Recognize "紧急" → PRIORITY concept → priority: 1
2. Recognize "进行中" → STATUS concept → status: "inprogress"
3. Recognize "明天到期" → DUE_DATE concept → dueDate: "tomorrow"
4. "任务" is too generic → exclude from keywords
{
  "coreKeywords": [],
  "keywords": [],
  "priority": 1,
  "status": "inprogress",
  "dueDate": "tomorrow",
  "dueDateRange": null,
  "folder": null,
  "tags": [],
  "aiUnderstanding": {
    "detectedLanguage": "中文",
    "correctedTypos": [],
    "semanticMappings": {
      "priority": "紧急 → 1",
      "status": "进行中 → inprogress",
      "dueDate": "明天到期 → tomorrow"
    },
    "confidence": 0.9,
    "naturalLanguageUsed": true
  }
}

CATEGORY 4: COMBINED (Keywords + Properties)
These examples show queries with BOTH keywords AND properties.

Example 4A: Combined - Keywords + standard syntax properties
Query: "Fix bug priority 1 open due today"
Process:
1. Extract properties FIRST: priority: 1, status: "open", dueDate: "today"
2. Remove property words from keywords
3. Extract remaining keywords: ["Fix", "bug"]
4. Expand keywords across all languages
{
  "coreKeywords": ["Fix", "bug"],
  "keywords": [
    "Fix", "repair", "solve", "correct", "resolve",
    ${queryLanguages[1] ? `"修复", "解决", "处理", "纠正", "修正",` : ""}
    ${queryLanguages[2] ? `"fixa", "reparera", "lösa", "korrigera", "åtgärda",` : ""}
    "bug", "error", "issue", "defect", "problem",
    ${queryLanguages[1] ? `"错误", "问题", "缺陷", "故障", "漏洞",` : ""}
    ${queryLanguages[2] ? `"bugg", "fel", "problem", "defekt", "brist"` : ""}
  ],
  "priority": 1,
  "status": "open",
  "dueDate": "today",
  "dueDateRange": null,
  "folder": null,
  "tags": [],
  "aiUnderstanding": {
    "detectedLanguage": "English",
    "correctedTypos": [],
    "semanticMappings": {
      "priority": "priority 1 → 1",
      "status": "open → open",
      "dueDate": "today → today"
    },
    "confidence": 0.95,
    "naturalLanguageUsed": false
  }
}

Example 4B: Combined - Keywords + natural language properties
Query: "urgent open bugs in payment system due today"
Process:
1. Extract properties FIRST:
   - "urgent" → PRIORITY concept → priority: 1
   - "open" → STATUS concept → status: "open"
   - "due today" → DUE_DATE concept → dueDate: "today"
2. Remove property words: "urgent", "open", "due", "today"
3. Extract keywords: ["bugs", "payment", "system"]
4. Expand keywords across all languages
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
  "dueDateRange": null,
  "folder": null,
  "tags": [],
  "aiUnderstanding": {
    "detectedLanguage": "English",
    "correctedTypos": [],
    "semanticMappings": {
      "priority": "urgent → 1",
      "status": "open → open",
      "dueDate": "due today → today"
    },
    "confidence": 0.9,
    "naturalLanguageUsed": true
  }
}

Example 4C: Combined - With tags
Query: "Fix bug #backend #urgent due today"
Process:
1. Extract tags: ["backend", "urgent"]
2. Extract properties: dueDate: "today"
3. Extract keywords: ["Fix", "bug"]
4. Expand keywords
{
  "coreKeywords": ["Fix", "bug"],
  "keywords": [
    "Fix", "repair", "solve", "correct", "resolve",
    ${queryLanguages[1] ? `"修复", "解决", "处理", "纠正", "修正",` : ""}
    ${queryLanguages[2] ? `"fixa", "reparera", "lösa", "korrigera", "åtgärda",` : ""}
    "bug", "error", "issue", "defect", "problem",
    ${queryLanguages[1] ? `"错误", "问题", "缺陷", "故障", "漏洞",` : ""}
    ${queryLanguages[2] ? `"bugg", "fel", "problem", "defekt", "brist"` : ""}
  ],
  "priority": null,
  "dueDate": "today",
  "status": null,
  "dueDateRange": null,
  "folder": null,
  "tags": ["backend", "urgent"],
  "aiUnderstanding": {
    "detectedLanguage": "English",
    "correctedTypos": [],
    "semanticMappings": {
      "dueDate": "today → today"
    },
    "confidence": 0.95,
    "naturalLanguageUsed": false
  }
}

CATEGORY 5: MULTIPLE VALUES AND RANGES

Example 5A: Multiple priority values
Query: "priority 1 or 2"
{
  "coreKeywords": [],
  "keywords": [],
  "priority": [1, 2],
  "status": null,
  "dueDate": null,
  "dueDateRange": null,
  "folder": null,
  "tags": [],
  "aiUnderstanding": {
    "detectedLanguage": "English",
    "correctedTypos": [],
    "semanticMappings": {
      "priority": "priority 1 or 2 → [1, 2]"
    },
    "confidence": 1.0,
    "naturalLanguageUsed": false
  }
}

Example 5B: Multiple status values
Query: "open or in progress tasks"
{
  "coreKeywords": [],
  "keywords": [],
  "priority": null,
  "status": ["open", "inprogress"],
  "dueDate": null,
  "dueDateRange": null,
  "folder": null,
  "tags": [],
  "aiUnderstanding": {
    "detectedLanguage": "English",
    "correctedTypos": [],
    "semanticMappings": {
      "status": "open or in progress → [\"open\", \"inprogress\"]"
    },
    "confidence": 0.9,
    "naturalLanguageUsed": true
  }
}

Example 5C: Date range
Query: "tasks this week"
{
  "coreKeywords": [],
  "keywords": [],
  "priority": null,
  "status": null,
  "dueDate": null,
  "dueDateRange": {
    "start": "week-start",
    "end": "week-end"
  },
  "folder": null,
  "tags": [],
  "aiUnderstanding": {
    "detectedLanguage": "English",
    "correctedTypos": [],
    "semanticMappings": {
      "dueDate": "this week → {start: week-start, end: week-end}"
    },
    "confidence": 0.95,
    "naturalLanguageUsed": true
  }
}

Example 5D: Combined - Multiple values + keywords + range
Query: "urgent or important bugs this week"
{
  "coreKeywords": ["bugs"],
  "keywords": [
    "bugs", "errors", "issues", "defects", "problems",
    ${queryLanguages[1] ? `"错误", "问题", "缺陷", "故障", "漏洞",` : ""}
    ${queryLanguages[2] ? `"buggar", "fel", "problem", "defekter", "brister"` : ""}
  ],
  "priority": [1, 2],
  "status": null,
  "dueDate": null,
  "dueDateRange": {
    "start": "week-start",
    "end": "week-end"
  },
  "folder": null,
  "tags": [],
  "aiUnderstanding": {
    "detectedLanguage": "English",
    "correctedTypos": [],
    "semanticMappings": {
      "priority": "urgent or important → [1, 2]",
      "dueDate": "this week → {start: week-start, end: week-end}"
    },
    "confidence": 0.9,
    "naturalLanguageUsed": true
  }
}

CATEGORY 6: TYPO CORRECTION AND NATURAL LANGUAGE UNDERSTANDING

Example 6A: Typo correction
Query: "urgant complated taks in paymant sistem"
Process:
1. Detect typos and auto-correct:
   - "urgant" → "urgent"
   - "complated" → "completed"
   - "taks" → "tasks"
   - "paymant" → "payment"
   - "sistem" → "system"
2. Parse corrected query: "urgent completed tasks in payment system"
3. Extract properties and keywords
{
  "coreKeywords": ["payment", "system"],
  "keywords": [
    "payment", "billing", "pay", "transaction", "invoice",
    ${queryLanguages[1] ? `"支付", "付款", "账单", "交易", "发票",` : ""}
    ${queryLanguages[2] ? `"betalning", "faktura", "betala", "transaktion", "avgift",` : ""}
    "system", "platform", "application", "service", "infrastructure",
    ${queryLanguages[1] ? `"系统", "平台", "应用", "服务", "基础设施",` : ""}
    ${queryLanguages[2] ? `"system", "plattform", "applikation", "tjänst", "infrastruktur"` : ""}
  ],
  "priority": 1,
  "status": "completed",
  "dueDate": null,
  "dueDateRange": null,
  "folder": null,
  "tags": [],
  "aiUnderstanding": {
    "detectedLanguage": "English",
    "correctedTypos": [
      "urgant → urgent",
      "complated → completed",
      "taks → tasks",
      "paymant → payment",
      "sistem → system"
    ],
    "semanticMappings": {
      "priority": "urgent → 1",
      "status": "completed → completed"
    },
    "confidence": 0.85,
    "naturalLanguageUsed": true
  }
}

Example 6B: Natural language understanding (conversational)
Query: "Show me all the really important stuff that's not done yet and is way overdue"
Process:
1. Detect natural language phrasing
2. Extract concepts:
   - "really important" → PRIORITY concept → priority: 1
   - "not done yet" → STATUS concept → status: ["open", "inprogress"]
   - "way overdue" → DUE_DATE concept → dueDate: "overdue"
3. Remove filler words: "Show", "me", "all", "the", "stuff", "that's", "and", "is"
{
  "coreKeywords": [],
  "keywords": [],
  "priority": 1,
  "status": ["open", "inprogress"],
  "dueDate": "overdue",
  "dueDateRange": null,
  "folder": null,
  "tags": [],
  "aiUnderstanding": {
    "detectedLanguage": "English",
    "correctedTypos": [],
    "semanticMappings": {
      "priority": "really important → 1",
      "status": "not done yet → [\"open\", \"inprogress\"]",
      "dueDate": "way overdue → overdue"
    },
    "confidence": 0.85,
    "naturalLanguageUsed": true
  }
}

${propertyTermMappings}

${priorityValueMapping}

${statusMapping}

${dateFieldNames}

${dueDateValueMapping}

${statusValueMapping}

⚠️ CRITICAL: PROPERTY + KEYWORD COMBINED QUERIES
When users mix keywords with property terms, handle them correctly:

Example: "开发 Task Chat 插件，with due date"
- Content keywords: "开发", "Task", "Chat", "插件" → expand normally
- Property term: "with due date" → dueDate: "any"

Example: "urgent bug fix due today"
- Property term: "urgent" → priority: 1
- Property term: "due today" → dueDate: "today"
- Content keywords: "bug", "fix" → expand normally

🚨 KEY RULES FOR COMBINED QUERIES:
1. Identify property terms FIRST (priority, due date, status)
2. Extract property values to structured fields
3. Remove property terms from content keywords
4. Expand remaining content keywords normally
5. Property terms should NEVER appear in keywords array
6. Each query can have BOTH keywords AND properties

🚨 CRITICAL: MUTUAL EXCLUSIVITY RULE 🚨
When extracting properties and keywords, ensure NO OVERLAP to prevent double-counting:

**RULE**: If a word is used to determine a PROPERTY, it must NOT appear in keywords array

**Why**: Each word should contribute to scoring ONCE, not twice:
- Word used for property → Gets property score (e.g., priority: 1 → 1.0 points × priority coefficient)
- Word used for keyword → Gets relevance score (e.g., "urgent" → relevance × 20)
- Same word in BOTH → Double-counted score (WRONG!)

**How to apply**:
1. **Extract properties FIRST** (dueDate, priority, status)
   - Identify which words triggered property detection
   - Example: "urgent" → priority: 1, "open" → status: "open", "overdue" → dueDate: "overdue"

2. **Extract keywords SECOND** (excluding property trigger words)
   - Remove words that were used for properties
   - Extract remaining meaningful words
   - Expand ONLY the non-property words

**Example**:
Query: "urgent open tasks for payment"
✅ CORRECT:
{
  "priority": 1,                                    // from "urgent"
  "status": "open",                                 // from "open"
  "coreKeywords": ["tasks", "payment"],            // "urgent" and "open" excluded
  "keywords": ["tasks", "work", "items", ..., "payment", "billing", ...]  // expanded from ["tasks", "payment"]
}

❌ WRONG:
{
  "coreKeywords": ["urgent", "open", "tasks", "payment"],  // ❌ includes property words
  "keywords": ["urgent", "critical", "open", "active", ...]  // ❌ expanded from property words
}

🚨 STOP WORDS - DO NOT EXTRACT OR EXPAND TO THESE:
The following ${stopWordsList.length} words are STOP WORDS. You MUST:
1. NOT extract them as core keywords (skip them during extraction)
2. NOT expand to them during semantic expansion (avoid generating them)
3. These are TOO GENERIC and match almost everything, inflating scores incorrectly

COMPLETE STOP WORDS LIST:
"${stopWordsDisplay}"

⚠️ IMPORTANT: Instead of these generic terms, use SPECIFIC synonyms related to the actual concept.
Example: For "开发" (develop), use "develop", "build", "create", "implement", "code" - NOT "work" or "task"

🚨 CRITICAL DISAMBIGUATION LOGIC - CHECK BEFORE EXTRACTING KEYWORDS:

**STEP 1: Check if query matches STATUS category (HIGHEST PRIORITY)**
- Compare query against STATUS MAPPING category names defined above
- If the query word EXACTLY MATCHES a status display name (case-insensitive), it's a STATUS FILTER

**STEP 2: If not status, check if query matches PRIORITY level**
- Check if query contains priority indicators (high, urgent, medium, low, etc.)
- If yes → extract priority value, DO NOT add to keywords

**STEP 3: If not status or priority, check if query matches DUE DATE**
- Check if query contains date indicators (today, overdue, tomorrow, etc.)
- If yes → extract dueDate value, DO NOT add to keywords

**STEP 4: If none of the above, treat as content KEYWORDS**
- Extract meaningful words and expand them semantically

⚠️ DISAMBIGUATION PRIORITY ORDER:
1. STATUS categories (check first!)
2. PRIORITY indicators
3. DUE DATE indicators
4. KEYWORDS (only if not status/priority/date)

=== ESSENTIAL FIELD USAGE RULES ===

🚨 CRITICAL: coreKeywords vs keywords - DIFFERENT PURPOSES!

**coreKeywords** (Array of strings):
- Purpose: METADATA ONLY - for logging, debugging, understanding query intent
- Content: Original extracted keywords BEFORE expansion
- Usage in system: NOT used for filtering, scoring, or sorting
- Example: ["develop", "bug"]
- Think of as: "What keywords did the user actually type?"

**keywords** (Array of strings):
- Purpose: ACTUAL FILTERING AND SCORING - used throughout the entire system
- Content: Expanded semantic equivalents across ALL configured languages
- Usage in system: 
  * Task filtering via Dataview API (substring matching)
  * Relevance scoring (keyword matches in task content)
  * Quality filtering (comprehensive score calculation)
  * Sorting (multi-criteria with relevance)
- Example: ["develop", "build", "create", "implement", "code", "开发", "构建", "创建", ...]
- Think of as: "What terms should we search for in task content?"

**Why both fields exist:**
- coreKeywords: Shows user what we understood from their query
- keywords: Provides semantic breadth for better task recall

**CRITICAL**: System uses ONLY the keywords array for all operations!
- Filtering: Checks if task content contains ANY keyword from keywords array
- Scoring: Counts how many keywords match (with deduplication)
- Sorting: Uses relevance scores based on keyword matches

⚠️ DO NOT confuse these fields - they serve completely different purposes!

**Other Fields:**

**priority** (number, array of numbers, or null):
- Single value: 1, 2, 3, or 4
- Multiple values: [1, 2] for "priority 1 or 2"
- null: User wants tasks WITH priority (any value)
- Maps to Dataview field: ${settings.dataviewKeys.priority}

**status** (string, array of strings, or null):
- Single value: "open", "inprogress", "completed", "cancelled", or custom category key
- Multiple values: ["open", "inprogress"] for "open or in progress"
- null: User wants tasks WITH status (any value)
- Maps to custom categories in: ${JSON.stringify(Object.keys(settings.taskStatusMapping))}

**dueDate** (string or null):
- Values: "today", "tomorrow", "overdue", "this-week", "next-week", "any", etc.
- null: No due date filter
- "any": User wants tasks WITH due dates (not a specific date)
- Maps to Dataview field: ${settings.dataviewKeys.dueDate}

**dueDateRange** (object with start/end or null):
- Format: {start: "week-start", end: "week-end"}
- Used for: "this week", "next week", "this month", etc.
- Mutually exclusive with dueDate (use one or the other, not both)

**folder** (string or null):
- Folder path for task location
- Example: "Projects/Work"

**tags** (array of strings):
- WITHOUT # symbol: ["backend", "urgent"]
- NOT with #: ["#backend", "#urgent"] ❌

**aiUnderstanding** (object):
- detectedLanguage: Full language name (e.g., "English", "中文", "Svenska")
- correctedTypos: Array of "old→new" strings
- semanticMappings: Object showing how natural language mapped to properties
  * priority: "urgent → 1"
  * status: "working on → inprogress"
  * dueDate: "tomorrow → tomorrow"
- confidence: 0.0-1.0 (how confident you are in the parsing)
- naturalLanguageUsed: true if user used natural language (not exact syntax)

=== EXTRACTION RULES: INDIVIDUAL WORDS, NOT PHRASES ===

🚨 CRITICAL: Extract INDIVIDUAL WORDS as separate keywords, NOT multi-word phrases!

**WHY**: The system uses substring matching. Individual words provide better flexibility:
- "payment" matches "payment", "payments", "Payment System", "online payment"
- "system" matches "system", "systems", "System Architecture", "payment system"
- Combined: Both match "payment system" ✅

❌ WRONG - Extracting phrases:
coreKeywords: ["payment system", "bug fix"]
keywords: ["payment system", "billing system", "开发系统", ...]

✅ CORRECT - Extracting individual words:
coreKeywords: ["payment", "system", "bug", "fix"]
keywords: [
  "payment", "billing", "pay", "支付", "付款", ...,
  "system", "platform", "application", "系统", "平台", ...,
  "bug", "error", "issue", "错误", "问题", ...,
  "fix", "repair", "solve", "修复", "解决", ...
]

**PROCESS**:
1. Split query into individual words
2. Remove property words (urgent, open, today, etc.)
3. Remove stop words (task, show, all, etc.)
4. Extract each remaining meaningful word separately
5. Expand EACH word independently across all languages

**Example Process**:
Query: "Fix payment system bug"
→ Split: ["Fix", "payment", "system", "bug"]
→ No properties detected
→ No stop words
→ Extract: ["Fix", "payment", "system", "bug"] (4 separate keywords)
→ Expand each:
  * "Fix" → ["fix", "repair", "solve", ...]
  * "payment" → ["payment", "billing", "pay", ...]
  * "system" → ["system", "platform", "application", ...]
  * "bug" → ["bug", "error", "issue", ...]

**NEVER extract phrases like**:
- "payment system" ❌
- "bug fix" ❌
- "Task Chat" ❌ (extract "Task" and "Chat" separately)
- "open tasks" ❌ ("open" is status property, "tasks" is stop word)

**Exception for proper nouns**:
Even proper nouns should be split if they contain meaningful components:
- "Task Chat" → ["Task", "Chat"] (both are meaningful)
- "GitHub" → ["GitHub"] (single unit)
- "Visual Studio Code" → ["Visual", "Studio", "Code"] (all meaningful)

=== RESPECTING USER SETTINGS AND INTERNAL VARIABLES ===

🚨 YOU MUST RESPECT ALL USER SETTINGS - These are NOT suggestions!

**User's Configured Languages** (${queryLanguages.length} languages):
${queryLanguages.map((lang, idx) => `${idx + 1}. ${lang}`).join("\n")}

⚠️ You MUST generate semantic equivalents in ALL of these languages for EVERY keyword!

**User's Priority Mapping**:
${JSON.stringify(settings.dataviewPriorityMapping, null, 2)}

⚠️ Use these EXACT values when converting priority concepts to numbers!

**User's Status Categories**:
${JSON.stringify(settings.taskStatusMapping, null, 2)}

⚠️ These are the user's CUSTOM categories - use the category KEYS (e.g., "open", "inprogress"), not display names!
⚠️ Check display names in STATUS MAPPING above to recognize them, then return the category KEY!

**User's Due Date Field Name**:
Field name in Dataview: "${settings.dataviewKeys.dueDate}"

⚠️ This is what the user calls their due date field in their vault!

**User's Priority Field Name**:
Field name in Dataview: "${settings.dataviewKeys.priority}"

⚠️ This is what the user calls their priority field in their vault!

**User's Property Terms** (used to recognize properties):
Due Date Terms: ${JSON.stringify(settings.userPropertyTerms.dueDate)}

⚠️ If user types ANY of these terms, recognize as DUE_DATE concept!

**Internal Variables YOU MUST USE**:

1. **languageList**: "${languageList}"
   - Display all configured languages in this format

2. **maxExpansions**: ${maxExpansions}
   - Semantic equivalents to generate PER language PER keyword

3. **maxKeywordsPerCore**: ${maxKeywordsPerCore}
   - Total variations to generate PER core keyword
   - Formula: ${maxExpansions} × ${queryLanguages.length}

4. **expansionEnabled**: ${expansionEnabled}
   - If false, still generate keywords in all languages but DON'T expand semantically
   - Just provide direct equivalents in each language

5. **stopWordsList**: ${stopWordsList.length} words
   - COMPLETE list provided above
   - NEVER extract or expand to these words

**Critical Principle**:
User settings are CONSTRAINTS, not suggestions. If user configured 3 languages with 5 expansions each, you MUST generate exactly 15 variations per keyword (5 × 3)!

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
