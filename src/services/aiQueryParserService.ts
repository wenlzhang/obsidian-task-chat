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

1️⃣ PART 1: TASK CONTENT (Keywords) BREAKDOWN

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
- Example: "开发" in English context = develop, build, implement
- Example: "Task" in Chinese context = 任务, 工作, 事项

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

2️⃣ PART 2: TASK ATTRIBUTES (Structured Filters) BREAKDOWN

🚨 2.1 TASK PROPERTY RECOGNITION (Direct Concept-to-Dataview Conversion)

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
    - **DUE_DATE concept** = Deadline, target date, timing, expiration, etc.
    - **PRIORITY concept** = Urgency, criticality, high/low priority, etc.
    - **STATUS concept** = State, condition, progress level, completion state, etc.

2. **Convert DIRECTLY to Dataview format** (always English field names):
   - PRIORITY concept → priority: 1-4 (number) or null
     * Urgent/critical/high/asap → 1
     * Medium → 2
     * Normal → 3
     * Low/minor → 4
     * null = user wants tasks WITH priority (any value, including none value)
   
   - STATUS concept → status: string or null
     * Open/todo/pending → "${TaskPropertyService.STATUS_CATEGORY.open}"
     * In progress/doing/working/active → "${TaskPropertyService.STATUS_CATEGORY.inProgress}"
     * Done/finished/completed → "${TaskPropertyService.STATUS_CATEGORY.completed}"
     * Cancelled/abandoned/dropped → "${TaskPropertyService.STATUS_CATEGORY.cancelled}"
     * Use category keys from STATUS MAPPING below (supports custom categories)
   
   - DUE_DATE concept → dueDate: string or null
     * Specific values defined in DUE DATE VALUE MAPPING below
     * Common: "${TaskPropertyService.DUE_DATE_KEYWORDS.today}", "${TaskPropertyService.DUE_DATE_KEYWORDS.tomorrow}", "${TaskPropertyService.DUE_DATE_KEYWORDS.overdue}", "${TaskPropertyService.DUE_DATE_KEYWORDS.any}", "${TaskPropertyService.DUE_DATE_KEYWORDS.future}", "${TaskPropertyService.DUE_DATE_KEYWORDS.week}", "${TaskPropertyService.DUE_DATE_KEYWORDS.nextWeek}"
     * "${TaskPropertyService.DUE_DATE_KEYWORDS.any}" = user wants tasks WITH due dates (not a specific date)

3. **Respect User Settings**:
   - Priority mappings: ${JSON.stringify(settings.dataviewPriorityMapping)}
   - Status mappings: ${JSON.stringify(settings.dataviewStatusMapping)}
   - Due date field name: "${settings.dataviewKeys.dueDate}"
   - User's due date terms: ${JSON.stringify(settings.userPropertyTerms.dueDate)}
   - See detailed mappings below (PRIORITY VALUE MAPPING, STATUS MAPPING, DUE DATE VALUE MAPPING)
   - These provide complete property recognition rules and normalization values

**PROCESS FOR PROPERTIES**:
1. Read user's query in ANY language
2. Recognize which concepts are expressed (priority? status? due date?)
3. Convert directly to Dataview format (category keys, not expanded terms)
4. Use native language understanding - NO expansion needed!

**Examples of Direct Conversion**:

English: "urgent tasks" → priority: 1, keywords: []
中文: "紧急任务" → priority: 1, keywords: []

English: "in progress" → status: "inprogress", keywords: []
中文: "进行中" → status: "inprogress", keywords: []
Svenska: "pågående" → status: "inprogress", keywords: []

English: "overdue tasks" → dueDate: "overdue", keywords: []
中文: "过期任务" → dueDate: "overdue", keywords: []

**Key Points**:
- Properties = concept recognition + direct conversion to category keys (NO expansion)
- Keywords = semantic expansion across languages for better matching (YES expansion)
- You already know all languages - use native understanding, not pre-programmed phrases
- Map concept → category key (language-independent internal identifier)

${propertyTermMappings}

${priorityValueMapping}

${statusMapping}

${dateFieldNames}

${dueDateValueMapping}

${statusValueMapping}

⚠️ 2.2 CRITICAL: PROPERTY + KEYWORD COMBINED QUERIES

When users mix keywords with property terms, handle them correctly:

Example 1: "开发 Task Chat 插件，with due date"
- Content keywords: "开发", "Task", "Chat", "插件" → expand normally
- Property term: "with due date" → dueDate: "any"
- Result:
  {
    "coreKeywords": ["开发", "Task", "Chat", "插件"],
    "keywords": [<expanded versions in ${languageList}>],
    "dueDate": "any"
  }

Example 2: "urgent bug fix due today"
- Property term: "urgent" → priority: 1
- Property term: "due today" → dueDate: "today"
- Content keywords: "bug", "fix" → expand normally
- Result:
  {
    "coreKeywords": ["bug", "fix"],
    "keywords": [<expanded versions in ${languageList}>],
    "priority": 1,
    "dueDate": "today"
  }

Example 3: "高优先级的开发任务，next week"
- Property term: "高优先级" → priority: 1
- Property term: "next week" → dueDate: "next-week"
- Property term: "任务" → not keywords, just descriptive
- Content keywords: "开发" → expand normally
- Result:
  {
    "coreKeywords": ["开发"],
    "keywords": [<expanded versions in ${languageList}>],
    "priority": 1,
    "dueDate": "next-week"
  }

Example 4: "open bug reports"
- Property term: "open" → status: "open"
- Content keywords: "bug", "reports" → expand normally
- Result:
  {
    "coreKeywords": ["bug", "reports"],
    "keywords": [<expanded versions in ${languageList}>],
    "status": "open"
  }

Example 5: "已完成的任务 due last week"
- Property term: "已完成" → status: "completed"
- Property term: "last week" → dueDate: "overdue" (past due)
- Property term: "任务" → not keywords, just descriptive
- Result:
  {
    "coreKeywords": [],
    "keywords": [<expanded versions in ${languageList}>],
    "status": "completed",
    "dueDate": "overdue"
  }

Example 6: "pågående high priority tasks"
- Property term: "pågående" → status: "inProgress"
- Property term: "high priority" → priority: 1
- Property term: "tasks" → not keywords, just descriptive
- Result:
  {
    "coreKeywords": [],
    "keywords": [<expanded versions in ${languageList}>],
    "status": "inProgress",
    "priority": 1
  }

🚨 KEY RULES FOR COMBINED QUERIES:
1. Identify property terms FIRST (priority, due date, status)
2. Extract property values to structured fields
3. Remove property terms from content keywords
4. Expand remaining content keywords normally
5. Property terms should NEVER appear in keywords array
6. Each query can have BOTH keywords AND properties

🚨 MULTI-VALUE PROPERTIES & DATE RANGES (NEW!)

The system now supports multi-value properties and date ranges for more flexible filtering:

**MULTI-VALUE PRIORITY:**
Users can specify multiple priority levels to search across:

Examples:
- "priority 1 2 3 tasks" → priority: [1, 2, 3] (array for multi-value)
- "high or medium priority" → priority: [1, 2] (array)
- "priority 1" → priority: 1 (single number)
- "priority tasks" → priority: null (any priority)

Rules:
- If user specifies multiple numeric priorities, return as array: [1, 2, 3]
- If user says "1 or 2" or "1 2", return as array: [1, 2]
- If user specifies one priority, return as single number: 1
- If user just wants tasks WITH priority (no specific value), return null

**MULTI-VALUE STATUS:**
Users can specify multiple statuses to search across:

Examples:
- "open or in progress tasks" → status: ["open", "inProgress"] (array for multi-value)
- "completed or cancelled" → status: ["completed", "cancelled"] (array)
- "done tasks" → status: "completed" (single string)
- "active tasks" → status: ["open", "inProgress"] (interpret "active" as multiple statuses)

Rules:
- If user specifies multiple statuses, return as array
- If user says "or", return as array
- If user specifies one status, return as single string
- Use ONLY the status category keys defined in the STATUS MAPPING section above (supports custom categories)

**RELATIVE DATE SUPPORT:**
Users can specify dates relative to today:

Examples:
- "due in 5 days" → dueDate: "+5d" (5 days from now)
- "due in 2 weeks" → dueDate: "+2w" (2 weeks from now)
- "due in 1 month" → dueDate: "+1m" (1 month from now)
- "due today" → dueDate: "today" (existing format)
- "overdue" → dueDate: "overdue" (existing format)

Relative date format:
- "+Nd" = N days from now (e.g., "+5d" = 5 days)
- "+Nw" = N weeks from now (e.g., "+2w" = 2 weeks)
- "+Nm" = N months from now (e.g., "+1m" = 1 month)

**DATE RANGE SUPPORT:**
Users can specify date ranges:

Examples:
- "due this week" → dueDateRange: {start: "week-start", end: "week-end"}
- "due next week" → dueDateRange: {start: "next-week-start", end: "next-week-end"}
- "due this month" → dueDateRange: {start: "month-start", end: "month-end"}
- "due between Monday and Friday" → dueDateRange: {start: "YYYY-MM-DD", end: "YYYY-MM-DD"}

Rules:
- If user specifies a range, use dueDateRange with start and end
- If user specifies a single date/relative date, use dueDate
- Do NOT use both dueDate and dueDateRange in same query

**MULTI-VALUE + RANGE COMBINED EXAMPLES:**

Example 1: "priority 1 2 tasks due this week"
Result:
{
  "coreKeywords": ["tasks"],
  "keywords": [<expanded>],
  "priority": [1, 2],
  "dueDateRange": {"start": "week-start", "end": "week-end"}
}

Example 2: "open or in progress high priority tasks"
Result:
{
  "coreKeywords": ["tasks"],
  "keywords": [<expanded>],
  "status": ["open", "inProgress"],
  "priority": 1
}

Example 3: "completed or cancelled tasks from last month"
Result:
{
  "coreKeywords": ["tasks"],
  "keywords": [<expanded>],
  "status": ["completed", "cancelled"],
  "dueDateRange": {"start": "last-month-start", "end": "last-month-end"}
}

🚨 NATURAL LANGUAGE UNDERSTANDING & TYPO CORRECTION 🚨

You are a multilingual query understanding AI with **native understanding** of ALL human languages.

**YOUR CAPABILITIES:**
1. ✅ Understand natural language in ANY language (not just pre-configured phrases)
2. ✅ Automatically correct typos in ANY language
3. ✅ Recognize task property CONCEPTS semantically
4. ✅ Map concepts to structured filters (for Dataview API)
5. ✅ Work with languages configured by user: ${languageList}

**CORE PRINCIPLE - SEMANTIC CONCEPT RECOGNITION:**

Instead of matching pre-programmed phrases, use your native language understanding to recognize these CONCEPTS:

**1. PRIORITY CONCEPT** = Urgency, importance, criticality, high/low importance
   - Any phrase expressing urgency/importance in ANY language
   - Examples across languages you know:
     * English: urgent, critical, asap, high priority, important, can wait, low priority
     * Chinese: 紧急, 重要, 优先, 关键, 不急
     * Spanish: urgente, crítico, importante, puede esperar
     * Russian: срочный, важный, критический
     * Arabic: عاجل, مهم, حرج
     * Japanese: 緊急, 重要, 優先
     * ANY other language - use your training!

**2. STATUS CONCEPT** = State, condition, progress, completion level
   - Any phrase describing task state in ANY language
   - Examples across languages you know:
     * English: open, in progress, working on, completed, done, finished, cancelled, blocked
     * Chinese: 打开, 进行中, 完成, 取消, 阻塞
     * Spanish: abierto, en progreso, completado, cancelado
     * Russian: открыто, в процессе, завершено
     * Arabic: مفتوح, قيد التقدم, مكتمل
     * Japanese: オープン, 進行中, 完了
     * ANY other language - use your training!

**3. DUE_DATE CONCEPT** = Deadline, target date, expiration, time limit
   - Any phrase about timing/deadlines in ANY language
   - Examples across languages you know:
     * English: due today, deadline tomorrow, overdue, no deadline, expires
     * Chinese: 今天到期, 明天截止, 过期, 没有截止日期
     * Spanish: vence hoy, fecha límite, vencido
     * Russian: срок сегодня, просрочен
     * Arabic: موعد اليوم, متأخر
     * Japanese: 期限今日, 期限切れ
     * ANY other language - use your training!

**HOW TO USE SEMANTIC UNDERSTANDING:**

When you see a query in ANY language:

1. **Recognize the CONCEPT** (not the exact phrase):
   - User says "срочные задачи" (Russian) → Recognize PRIORITY concept (urgent)
   - User says "مهام مفتوحة" (Arabic) → Recognize STATUS concept (open)
   - User says "期限今日" (Japanese) → Recognize DUE_DATE concept (today)

2. **Map to internal codes** (for Dataview API compatibility):
   - PRIORITY concept → priority number (1-4):
     * Urgent/critical/high → 1
     * Important/medium → 2
     * Normal → 3
     * Low/minor → 4
   
   - STATUS concept → status code:
     * Open/todo/pending → "${TaskPropertyService.STATUS_CATEGORY.open}"
     * In progress/doing/working on → "${TaskPropertyService.STATUS_CATEGORY.inProgress}"
     * Done/finished/completed → "${TaskPropertyService.STATUS_CATEGORY.completed}"
     * Cancelled/abandoned → "${TaskPropertyService.STATUS_CATEGORY.cancelled}"
   
   - DUE_DATE concept → date string:
     * Today → today's date
     * Tomorrow → tomorrow's date
     * Overdue/late → "${TaskPropertyService.DUE_DATE_KEYWORDS.overdue}"
     * No deadline → "no date" (special keyword)

3. **Be language-agnostic**:
   - Don't rely on pre-programmed translations
   - Use your training to understand the MEANING
   - Work with languages beyond examples (French, Italian, Portuguese, Korean, Hindi, etc.)
   - Map meaning → internal code (same for all languages)

**EXAMPLES OF SEMANTIC CONCEPT RECOGNITION:**

User query in Russian: "срочные задачи которые просрочены"
→ Recognize: PRIORITY (срочные = urgent) + DUE_DATE (просрочены = overdue)
→ Map: priority: 1, dueDate: "overdue"

User query in Arabic: "مهام مفتوحة ذات أولوية عالية"
→ Recognize: STATUS (مفتوحة = open) + PRIORITY (أولوية عالية = high priority)
→ Map: status: "open", priority: 1

User query in Japanese: "進行中の重要なタスク"
→ Recognize: STATUS (進行中 = in progress) + PRIORITY (重要 = important)
→ Map: status: "inprogress", priority: 1

User query in French: "tâches urgentes non terminées"
→ Recognize: PRIORITY (urgentes = urgent) + STATUS (non terminées = not completed/open)
→ Map: priority: 1, status: "open"

User query in Korean: "긴급한 미완료 작업"
→ Recognize: PRIORITY (긴급한 = urgent) + STATUS (미완료 = incomplete/open)
→ Map: priority: 1, status: "open"

**YOUR TASK:**
- Use your native understanding of human languages
- Recognize property CONCEPTS semantically
- Don't rely on pre-programmed phrase matching
- Map concepts to internal codes for Dataview API
- Work with ANY language user configured: ${languageList}
- Even work with languages NOT in the configured list if user queries in them!

**TYPO CORRECTION:**

Automatically correct common misspellings before parsing. Users make typos - fix them!

Common typo patterns:
- Missing letters: "priorty" → "priority", "taks" → "task"
- Extra letters: "openn" → "open", "taskks" → "tasks"
- Transpositions: "tasl" → "task", "priortiy" → "priority"
- Wrong letters: "complated" → "completed", "urgant" → "urgent"
- Phonetic: "kritical" → "critical", "importent" → "important"

Typo examples to handle:
- "urgant taks" → "urgent tasks"
- "complated items" → "completed items"
- "priorty 1" → "priority 1"
- "overdu work" → "overdue work"
- "tommorow" → "tomorrow"
- "critcal bugs" → "critical bugs"
- "paymant system" → "payment system"
- "opne projects" → "open projects"

**Process:**
1. Read user's query
2. Correct any typos automatically
3. Understand natural language (map to properties)
4. Extract keywords and property filters
5. Expand keywords semantically
6. Return structured JSON

**Examples of Natural Language Parsing:**

English: "show me urgent open tasks that are overdue"
→ Understand: priority:1 (urgent), status:"open", dueDate:"overdue"
→ Extract: priority: 1, status: "open", dueDate: "overdue", keywords: ["show", "me", "tasks"]

中文: "明天到期的紧急未完成任务"
→ Understand: dueDate:"tomorrow", priority:1 (urgent), status:"open" (incomplete)
→ Extract: dueDate: tomorrow's date, priority: 1, status: "open", keywords: ["任务"]

Swedish: "brådskande ofullständiga uppgifter förfallna imorgon"
→ Understand: priority:1 (urgent), status:"open" (incomplete), dueDate:"tomorrow"
→ Extract: priority: 1, status: "open", dueDate: tomorrow's date, keywords: ["uppgifter"]

With typos: "urgant complated taks in paymant system"
→ Correct: "urgent completed tasks in payment system"
→ Understand: priority:1 (urgent), status:"completed"
→ Extract: priority: 1, status: "completed", keywords: ["tasks", "payment", "system"]

🔧 TYPO CORRECTION (Always Active):
Before parsing, automatically correct common spelling errors in the query.
Examples:
- "urgant" → "urgent"
- "taks" → "tasks"
- "complated" → "completed"
- "priorit" → "priority"
- "importent" → "important"

If you correct any typos, record them in the aiUnderstanding.correctedTypos array.

Extract ALL filters from the query and return ONLY a JSON object with this EXACT structure:
{
  "coreKeywords": [<array of ORIGINAL extracted keywords BEFORE expansion>],
  "keywords": [<array of EXPANDED search terms with semantic equivalents across all languages>],
  "priority": <number or array of numbers or null>,
  "dueDate": <string or null>,
  "dueDateRange": <{start: string, end: string} or null>,
  "status": <string or array of strings or null>,
  "folder": <string or null>,
  "tags": [<hashtags from query, WITHOUT the # symbol>],
  "aiUnderstanding": {
    "detectedLanguage": <string, full language name detected (e.g., "English", "Chinese", "Swedish")>,
    "correctedTypos": [<array of corrections, e.g., "urgant→urgent", "taks→tasks">],
    "semanticMappings": {
      "priority": <string or null, how natural language mapped to priority, e.g., "urgent → 1">,
      "status": <string or null, how natural language mapped to status, e.g., "working on → inprogress">,
      "dueDate": <string or null, how natural language mapped to due date, e.g., "tomorrow → 2025-01-23">
    },
    "confidence": <number 0-1, how confident you are in the parsing>,
    "naturalLanguageUsed": <boolean, true if user used natural language vs exact syntax>
  }
}

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

**Examples**:

Example 1: "urgent open tasks for payment"
✅ CORRECT:
{
  "priority": 1,                                    // from "urgent"
  "status": "open",                                 // from "open"
  "coreKeywords": ["tasks", "payment"],            // "urgent" and "open" excluded
  "keywords": ["tasks", "work", "items", ..., "payment", "billing", ...]  // expanded from ["tasks", "payment"]
}

❌ WRONG:
{
  "priority": 1,
  "status": "open",
  "coreKeywords": ["urgent", "open", "tasks", "payment"],  // ❌ includes property words
  "keywords": ["urgent", "critical", "open", "active", ...]  // ❌ expanded from property words
}

Example 2: "completed tasks in payment system"
✅ CORRECT:
{
  "status": "completed",                            // from "completed"
  "coreKeywords": ["tasks", "payment", "system"],  // "completed" excluded
  "keywords": ["tasks", "work", ..., "payment", "billing", ..., "system", "application", ...]
}

Example 3: "priority 1 overdue"
✅ CORRECT:
{
  "priority": 1,                                    // from explicit "priority 1"
  "dueDate": "overdue",                            // from "overdue"
  "coreKeywords": [],                              // no content keywords (all words were properties)
  "keywords": []                                    // empty - no keywords to expand
}

Example 4: "fix urgent bug"
✅ CORRECT:
{
  "priority": 1,                                    // from "urgent"
  "coreKeywords": ["fix", "bug"],                  // "urgent" excluded
  "keywords": ["fix", "repair", "solve", ..., "bug", "error", "issue", ...]
}

**SEMANTIC PROPERTY CONCEPT RECOGNITION**:

Instead of matching specific trigger words, recognize property CONCEPTS in ANY language.

**USER'S CONFIGURED LANGUAGES**: ${languageList}

**IMPORTANT**: The following comprehensive mappings include:
- User-configured terms from settings
- Base multilingual terms (English, 中文, Svenska, etc.)
- All custom status categories defined by user

Use these as REFERENCE for semantic understanding, but recognize concepts in ANY language:

---

**1. PRIORITY CONCEPT** (Urgency, Criticality)

${priorityValueMapping}

**How to use**:
- Recognize urgency/criticality concepts in ANY language (not just listed terms)
- Map to standard Dataview priority values: 1, 2, 3, or 4
- User's terms above are examples - use semantic understanding for unlisted phrases

---

**2. STATUS CONCEPT** (Status, Condition, Progress)

${statusMapping}

**How to use**:
- Recognize task status concepts in ANY language (not just listed terms)
- Map to exact status category keys shown above (respects user's custom categories)
- User's categories above are COMPLETE - these are the ONLY valid status values

---

**3. DUE_DATE CONCEPT** (Deadline, Target Date, Time)

${dueDateValueMapping}

**How to use**:
- Recognize timing/deadline concepts in ANY language (not just listed terms)
- Map to standard Dataview date values shown above
- User's terms above are examples - use semantic understanding for unlisted phrases

**KEY PRINCIPLES**:

1. **Language-Independent Recognition**: Leverage your native multilingual training
   - Don't match word lists - UNDERSTAND concepts
   - Works in 100+ languages automatically
   - Not limited to user's configured languages

2. **User's Language Context**: User configured these languages: ${languageList}
   - These guide your understanding of query context
   - But you can recognize concepts in ANY language

3. **Standard Dataview Mapping**: Always map to Dataview's standard values
   - priority: 1, 2, 3, or 4 (numbers)
   - status: "open", "inprogress", "completed", "cancelled", etc. (lowercase, no spaces)
   - dueDate: "overdue", "today", "tomorrow", etc. (lowercase)

4. **Mutual Exclusivity**: If a word triggers property detection, exclude it from keywords
   - Property concept recognized → Extract property, exclude from keywords
   - Not a property concept → Include in keywords for expansion

**Remember**: A word either contributes to property score OR relevance score, NEVER both!

🚨 CRITICAL JSON FORMAT RULES:
- JSON does NOT support comments (no // or /* */)
- Do NOT add explanatory text inside JSON arrays
- Do NOT use arrows (←) or other symbols in JSON
- Return PURE, VALID JSON only - parseable by JSON.parse()
- Any comments or explanations WILL cause parsing errors!

⚠️ CRITICAL FIELD USAGE RULES:
1. "coreKeywords" field: ORIGINAL keywords extracted from query (BEFORE expansion)
   - Extract main concepts/nouns/verbs from the query
   - Remove stop words and filter-related terms
   - These are the BASE keywords before semantic expansion
   - Example: "How to develop plugin" → ["develop", "plugin"]

2. "keywords" field: FULLY EXPANDED keywords with ALL semantic equivalents
   - This should contain ALL semantic equivalents for ALL core keywords combined
   - For EVERY SINGLE core keyword (no exceptions!), you MUST generate:
     * ${maxExpansions} semantic equivalents DIRECTLY in ${queryLanguages[0] || "first language"}
     * ${maxExpansions} semantic equivalents DIRECTLY in ${queryLanguages[1] || "second language"}
     ${queryLanguages[2] ? `* ${maxExpansions} semantic equivalents DIRECTLY in ${queryLanguages[2]}` : ""}
   - Total per core keyword: EXACTLY ${maxKeywordsPerCore} variations
   
   🚨 IMPORTANT: Direct Cross-Language Generation
   - Do NOT translate! Generate semantic equivalents DIRECTLY in each language
   - Think: "How would a native speaker express this concept in language X?"
   - For Chinese keyword "开发": What English terms express 'development/building'?
   - For English keyword "Task": What Chinese terms express 'task/work item'?
   - Include: synonyms, related terms, alternative phrases, context-appropriate variants
   
   🚨 MANDATORY RULE: 
   - EVERY core keyword needs ${maxKeywordsPerCore} total variations
   - Proper nouns (like "Task", "Chat") MUST also be expanded
   - Generate equivalents in ALL ${queryLanguages.length} languages (not just non-source languages)
   - If you have 4 core keywords, you MUST return ~${maxKeywordsPerCore * 4} total keywords
   
   Example for ONE core keyword "develop" with languages [${languageList}]:
   
   INSTRUCTION: Generate EXACTLY ${maxExpansions} variations in EACH of the ${queryLanguages.length} languages:
   - ${queryLanguages[0] || "Language 1"}: ${maxExpansions} variations (develop, build, create, code, implement)
   ${queryLanguages[1] ? `- ${queryLanguages[1]}: ${maxExpansions} variations (开发, 构建, 创建, 编程, 实现)` : ""}
   ${queryLanguages[2] ? `- ${queryLanguages[2]}: ${maxExpansions} variations (utveckla, bygga, skapa, koda, implementera)` : ""}
   Total: ${maxKeywordsPerCore} keywords
   
   Return as VALID JSON:
   [
     "develop", "build", "create", "code", "implement",
     ${queryLanguages[1] ? `"开发", "构建", "创建", "编程", "实现",` : ""}
     ${queryLanguages[2] ? `"utveckla", "bygga", "skapa", "koda", "implementera"` : ""}
   ]
   
   Example for TWO core keywords "fix" + "bug" with ${queryLanguages.length} languages:
   
   INSTRUCTION: For EACH core keyword, generate ${maxExpansions} variations × ${queryLanguages.length} languages
   - "fix": ${maxExpansions} in ${queryLanguages[0] || "lang1"}${queryLanguages[1] ? `, ${maxExpansions} in ${queryLanguages[1]}` : ""}${queryLanguages[2] ? `, ${maxExpansions} in ${queryLanguages[2]}` : ""}
   - "bug": ${maxExpansions} in ${queryLanguages[0] || "lang1"}${queryLanguages[1] ? `, ${maxExpansions} in ${queryLanguages[1]}` : ""}${queryLanguages[2] ? `, ${maxExpansions} in ${queryLanguages[2]}` : ""}
   
   Return this as VALID JSON (NO comments, NO arrows, NO explanations in the array!):
   [
     "fix", "repair", "solve", "correct", "debug",
     ${queryLanguages[1] ? `"修复", "解决", "处理", "纠正", "调试",` : ""}
     ${queryLanguages[2] ? `"fixa", "reparera", "lösa", "korrigera", "felsöka",` : ""}
     "bug", "error", "issue", "defect", "fault",
     ${queryLanguages[1] ? `"错误", "问题", "缺陷", "故障", "漏洞",` : ""}
     ${queryLanguages[2] ? `"bugg", "fel", "problem", "defekt", "brist"` : ""}
   ]
   
   - Do NOT skip any configured language!
   - Do NOT include hashtags in keywords
   
3. "tags" field: Extract hashtags/tags from query (e.g., #work → ["work"])
   - ONLY extract tags that are explicitly marked with # in the query
   - Remove the # symbol when adding to the array
   - If no hashtags in query, leave empty []
   
4. Return ONLY valid JSON, no reasoning text, no <think> tags, just pure JSON

KEYWORD EXTRACTION & EXPANSION EXAMPLES:

Example 1: Mixed-language query - Direct cross-language semantic equivalence
  Query: "如何开发 Task Chat"
  
  THINKING PROCESS (for you to understand, not include in output):
  - "开发" is Chinese → Generate English/Swedish equivalents for "development/building"
  - "Task" is English → Generate Chinese/Swedish equivalents for "task/work item"
  - "Chat" is English → Generate Chinese/Swedish equivalents for "chat/conversation"
  
  INSTRUCTION for EACH keyword:
  - "开发": Think "What are ${maxExpansions} ways to express 'development' in each language?"
    * English: develop, build, create, implement, code
    * 中文: 开发, 构建, 创建, 编程, 制作
    * Swedish: utveckla, bygga, skapa, programmera, implementera
    
  - "Task": Think "What are ${maxExpansions} ways to express 'task/work' in each language?"
    * English: task, work, item, assignment, job
    * 中文: 任务, 工作, 事项, 项目, 作业
    * Swedish: uppgift, arbete, göra, uppdrag, ärende
    
  - "Chat": Think "What are ${maxExpansions} ways to express 'chat/conversation' in each language?"
    * English: chat, conversation, talk, discussion, dialogue
    * 中文: 聊天, 对话, 交流, 谈话, 沟通
    * Swedish: chatt, konversation, prata, diskussion, samtal
  
  {
    "coreKeywords": ["开发", "Task", "Chat"],
    "keywords": [
      "开发", "develop", "build", "create", "implement",
      ${queryLanguages[1] ? `"开发", "构建", "创建", "编程", "制作",` : ""}
      ${queryLanguages[2] ? `"utveckla", "bygga", "skapa", "programmera", "implementera",` : ""}
      "task", "work", "item", "assignment", "job",
      ${queryLanguages[1] ? `"任务", "工作", "事项", "项目", "作业",` : ""}
      ${queryLanguages[2] ? `"uppgift", "arbete", "göra", "uppdrag", "ärende",` : ""}
      "chat", "conversation", "talk", "discussion", "dialogue",
      ${queryLanguages[1] ? `"聊天", "对话", "交流", "谈话", "沟通",` : ""}
      ${queryLanguages[2] ? `"chatt", "konversation", "prata", "diskussion", "samtal"` : ""}
    ],
    "tags": []
  }
  
  Total: 3 keywords × ${maxKeywordsPerCore} = ${3 * maxKeywordsPerCore} total variations

Example 2: English query - Generate semantic equivalents in ALL languages
  Query: "Fix bug"
  
  THINKING PROCESS:
  - "fix" is English → What are semantic equivalents in English/Chinese/Swedish?
  - "bug" is English → What are semantic equivalents in English/Chinese/Swedish?
  
  INSTRUCTION:
  - "fix": Think "How to express 'fixing/repairing' concept in each language?"
    * English context: fix, repair, solve, correct, resolve
    * Chinese context: 修复, 解决, 修正, 处理, 纠正
    * Swedish context: fixa, reparera, lösa, korrigera, åtgärda
    
  - "bug": Think "How to express 'bug/error' concept in each language?"
    * English context: bug, error, issue, defect, problem
    * Chinese context: 错误, 问题, 缺陷, 故障, 漏洞
    * Swedish context: bugg, fel, problem, defekt, felaktighet
  
  {
    "coreKeywords": ["fix", "bug"],
    "keywords": [
      "fix", "repair", "solve", "correct", "debug",
      ${queryLanguages[1] ? `"修复", "解决", "处理", "纠正", "调试",` : ""}
      ${queryLanguages[2] ? `"fixa", "reparera", "lösa", "korrigera", "felsöka",` : ""}
      "bug", "error", "issue", "defect", "fault",
      ${queryLanguages[1] ? `"错误", "问题", "缺陷", "故障", "漏洞",` : ""}
      ${queryLanguages[2] ? `"bugg", "fel", "problem", "defekt", "brist"` : ""}
    ],
    "tags": []
  }
  
⚠️ Notice: ALL keywords for ALL ${queryLanguages.length} languages - NO comments in JSON!

🚨 PROPERTY EXPANSION EXAMPLES (NEW!):

Example 3: Chinese priority query - Property term semantic expansion
  Query: "包含优先级的任务" (tasks containing priority)
  
  THINKING PROCESS:
  - "优先级" is Chinese for "priority" → Recognize as PRIORITY property concept
  - User asks for "tasks containing priority" → wants tasks WITH priority field
  - Extract property: priority: null (any tasks with priority)
  - Extract content keywords: ["包含", "任务"] → expand these normally
  
  {
    "coreKeywords": ["包含", "任务"],
    "keywords": [
      "包含", "include", "contain", "involve", "comprise",
      ${queryLanguages[1] ? `"包含", "包括", "含有", "涉及", "包含在内",` : ""}
      ${queryLanguages[2] ? `"innehålla", "inkludera", "ha", "omfatta", "beröra",` : ""}
      "任务", "task", "work", "item", "assignment",
      ${queryLanguages[1] ? `"任务", "工作", "事项", "项目", "作业",` : ""}
      ${queryLanguages[2] ? `"uppgift", "arbete", "göra", "uppdrag", "ärende"` : ""}
    ],
    "priority": null,
    "dueDate": null,
    "status": null,
    "tags": []
  }
  
  Result: System will filter for tasks WITH priority field, then match keywords "包含" and "任务"

Example 4: Swedish due date query - Property term semantic expansion
  Query: "uppgifter med förfallodatum" (tasks with due date)
  
  THINKING PROCESS:
  - "förfallodatum" is Swedish for "due date" → Recognize as DUE DATE property concept
  - User asks for "tasks with due date" → wants tasks WITH due dates
  - Extract property: dueDate: "any" (tasks that have due dates)
  - Extract content keywords: ["uppgifter"] → expand normally
  
  {
    "coreKeywords": ["uppgifter"],
    "keywords": [
      "uppgifter", "task", "tasks", "work", "items",
      ${queryLanguages[1] ? `"任务", "工作", "事项", "项目", "作业",` : ""}
      ${queryLanguages[2] ? `"uppgifter", "arbeten", "göromål", "uppdrag", "ärenden"` : ""}
    ],
    "priority": null,
    "dueDate": "any",
    "status": null,
    "tags": []
  }
  
  Result: System will filter for tasks WITH due dates, then match keyword "uppgifter"

Example 5: Mixed language with specific priority - Property value extraction
  Query: "high priority 任务 due today"
  
  THINKING PROCESS:
  - "high priority" → Recognize as PRIORITY concept with specific value (high = 1)
  - "due today" → Recognize as DUE DATE concept with specific value (today)
  - "任务" → Content keyword, expand normally
  
  {
    "coreKeywords": ["任务"],
    "keywords": [
      "任务", "task", "tasks", "work", "item",
      ${queryLanguages[1] ? `"任务", "工作", "事项", "项目", "作业",` : ""}
      ${queryLanguages[2] ? `"uppgift", "arbete", "göra", "uppdrag", "ärende"` : ""}
    ],
    "priority": 1,
    "dueDate": "today",
    "status": null,
    "tags": []
  }
  
  Result: System will filter for P1 tasks due today, then match keyword "任务"

Example 6: Multiple properties in Chinese
  Query: "高优先级的过期任务" (high priority overdue tasks)
  
  THINKING PROCESS:
  - "高优先级" (high priority) → priority: 1
  - "过期" (overdue) → dueDate: "overdue"
  - "任务" → Content keyword
  
  {
    "coreKeywords": ["任务"],
    "keywords": [
      "任务", "task", "tasks", "work", "item",
      ${queryLanguages[1] ? `"任务", "工作", "事项", "项目", "作业",` : ""}
      ${queryLanguages[2] ? `"uppgift", "arbete", "göra", "uppdrag", "ärende"` : ""}
    ],
    "priority": 1,
    "dueDate": "overdue",
    "status": null,
    "tags": []
  }
  
  Result: System will filter for P1 overdue tasks, then match keyword "任务"

Example 7: Property + hashtags + keywords
  Query: "Fix urgent bug #backend due today"
  
  THINKING PROCESS:
  - "urgent" → Recognize as priority indicator (high = 1)
  - "due today" → dueDate: "today"
  - "#backend" → tag
  - "Fix", "bug" → Content keywords
  
  {
    "coreKeywords": ["fix", "bug"],
    "keywords": [
      "fix", "repair", "solve", "correct", "debug",
      ${queryLanguages[1] ? `"修复", "解决", "处理", "纠正", "调试",` : ""}
      ${queryLanguages[2] ? `"fixa", "reparera", "lösa", "korrigera", "felsöka",` : ""}
      "bug", "error", "issue", "defect", "fault",
      ${queryLanguages[1] ? `"错误", "问题", "缺陷", "故障", "漏洞",` : ""}
      ${queryLanguages[2] ? `"bugg", "fel", "problem", "defekt", "brist"` : ""}
    ],
    "priority": 1,
    "dueDate": "today",
    "status": null,
    "tags": ["backend"]
  }

Example 8: Properties only with tag
  Query: "tasks with #work priority 1"
  
  THINKING PROCESS:
  - Property term: "priority 1" → priority: 1
  - "#work" → tag
  - "tasks" is stop word → remove
  - No content keywords
  
  {
    "coreKeywords": [],
    "keywords": [],
    "priority": 1,
    "dueDate": null,
    "status": null,
    "tags": ["work"]
  }

Example 9: Keywords with tags
  Query: "Fix bug #urgent #backend"
  
  THINKING PROCESS:
  - "urgent" in tag context → just tag, not property (because of #)
  - Content keywords: "Fix", "bug" → expand normally
  - Tags: "#urgent", "#backend"
  
  {
    "coreKeywords": ["fix", "bug"],
    "keywords": [
      "fix", "repair", "solve", "correct", "debug",
      ${queryLanguages[1] ? `"修复", "解决", "处理", "纠正", "调试",` : ""}
      ${queryLanguages[2] ? `"fixa", "reparera", "lösa", "korrigera", "felsöka",` : ""}
      "bug", "error", "issue", "defect", "fault",
      ${queryLanguages[1] ? `"错误", "问题", "缺陷", "故障", "漏洞",` : ""}
      ${queryLanguages[2] ? `"bugg", "fel", "problem", "defekt", "brist"` : ""}
    ],
    "priority": null,
    "dueDate": null,
    "status": null,
    "tags": ["urgent", "backend"]
  }

CRITICAL RULES:
- Extract INDIVIDUAL words, not phrases (e.g., "Obsidian AI plugin" → ["Obsidian", "AI", "plugin"] NOT ["Obsidian AI plugin"])
- Always include proper nouns exactly as written (e.g., "Obsidian", "AI", "Task", "Chat")
- For each meaningful keyword, generate semantic equivalents in ALL configured languages
- Keywords should be 1-2 words maximum, prefer single words for better substring matching
- This enables queries in ANY language to match tasks in ANY other configured language
- Remove filter-related words (priority, due date, status) from keywords

🚨 CRITICAL DISAMBIGUATION LOGIC - CHECK BEFORE EXTRACTING KEYWORDS:

**STEP 1: Check if query matches STATUS category (HIGHEST PRIORITY)**
- Compare query against STATUS MAPPING category names defined above
- If the query word EXACTLY MATCHES a status display name (case-insensitive), it's a STATUS FILTER
- Examples based on your STATUS MAPPING:
  ${Object.entries(settings.taskStatusMapping)
      .slice(0, 4)
      .map(([key, config]) => {
          const displayLower = config.displayName.toLowerCase();
          return `  * Query: "${displayLower}" → CHECK: Does "${displayLower}" match status "${config.displayName}"? YES → status: "${key}", keywords: []`;
      })
      .join("\n")}

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

⚠️ REAL EXAMPLE WALKTHROUGH:
Query: "important"
Step 1: Check STATUS MAPPING → Is "important" a status category? 
  ${Object.keys(settings.taskStatusMapping).includes("important") ? '→ YES! "important" is a status category' : '→ NO, "important" is not a status category'}
  ${Object.keys(settings.taskStatusMapping).includes("important") ? `→ Result: status: "important", keywords: []` : `→ Continue to Step 2`}
Step 2: ${Object.keys(settings.taskStatusMapping).includes("important") ? "(Skipped - already matched as status)" : 'Check PRIORITY → Is "important" a priority indicator?'}
  ${Object.keys(settings.taskStatusMapping).includes("important") ? "" : "→ Could be, but check if it's a status category FIRST (Step 1)"}

🚨 STOP WORDS - DO NOT EXTRACT OR EXPAND TO THESE:
The following ${stopWordsList.length} words are STOP WORDS. You MUST:
1. NOT extract them as core keywords (skip them during extraction)
2. NOT expand to them during semantic expansion (avoid generating them)
3. These are TOO GENERIC and match almost everything, inflating scores incorrectly

COMPLETE STOP WORDS LIST:
"${stopWordsDisplay}"

⚠️ IMPORTANT: Instead of these generic terms, use SPECIFIC synonyms related to the actual concept.
Example: For "开发" (develop), use "develop", "build", "create", "implement", "code" - NOT "work" or "task"

- Tags and keywords serve DIFFERENT purposes - don't mix them!

🚨🚨🚨 CRITICAL FINAL INSTRUCTION 🚨🚨🚨
YOU MUST RETURN **ONLY** VALID JSON. NO EXPLANATIONS. NO MARKDOWN. NO ANALYSIS.

❌ DO NOT return:
- Markdown headings (##, ###)
- Explanatory text before or after JSON
- Dependency trees, syntax analysis, or linguistic breakdowns
- Any text that is not parseable JSON

✅ CORRECT output format:
{
  "coreKeywords": [<array of ORIGINAL extracted keywords BEFORE expansion>],
  "keywords": [<array of EXPANDED search terms with semantic equivalents across all languages>],
  "priority": <number or array of numbers or null>,
  "dueDate": <string or null>,
  "dueDateRange": <{start: string, end: string} or null>,
  "status": <string or array of strings or null>,
  "folder": <string or null>,
  "tags": [<hashtags from query, WITHOUT the # symbol>],
  "aiUnderstanding": {
    "detectedLanguage": <string, full language name detected (e.g., "English", "Chinese", "Swedish")>,
    "correctedTypos": [<array of corrections, e.g., "urgant→urgent", "taks→tasks">],
    "semanticMappings": {
      "priority": <string or null, how natural language mapped to priority, e.g., "urgent → 1">,
      "status": <string or null, how natural language mapped to status, e.g., "working on → inprogress">,
      "dueDate": <string or null, how natural language mapped to due date, e.g., "tomorrow → 2025-01-23">
    },
    "confidence": <number 0-1, how confident you are in the parsing>,
    "naturalLanguageUsed": <boolean, true if user used natural language vs exact syntax>
  }
}

⚠️ If you return ANYTHING other than pure JSON, the system will FAIL.
⚠️ Start your response with { and end with }
⚠️ NO markdown code blocks (no \`\`\`json), just raw JSON`;

        const messages = [
            {
                role: "system",
                content: systemPrompt,
            },
            {
                role: "user",
                content: `Parse this query: "${query}"

CRITICAL: Return ONLY valid JSON. No markdown, no explanations, no code blocks. Start with { and end with }.`,
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
