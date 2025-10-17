# Three-Part Query Parsing System

**Date:** 2024-10-17  
**Status:** Implemented  
**Applies to:** Smart Search and Task Chat modes

## Overview

The three-part query parsing system is an advanced architecture that structures user queries into distinct components for more precise task filtering and semantic search. This system enhances the AI's ability to understand complex queries and leverages the DataView API for efficient filtering.

## Architecture

### Part 1: Task Content (Keywords)
**Purpose:** Match task text content using semantic search

- **Core Keywords:** Original keywords extracted from query before expansion
- **Expanded Keywords:** Semantic variations and translations across all configured languages
- **Expansion Formula:** `Total Keywords = Core Keywords × Max Expansions × Number of Languages`

**Example:**
```
Query: "Fix bug"
Core Keywords: ["fix", "bug"]
Expanded Keywords: ["fix", "修复", "repair", "解决", "solve", "处理", "bug", "错误", "error", "问题", "issue", "故障"]
```

### Part 2: Task Attributes (Structured Filters)
**Purpose:** Precise filtering using DataView API

Supported attributes:
- **Priority:** 1-4 (1=highest, 2=high, 3=medium, 4=low)
- **Due Date:** "today", "tomorrow", "overdue", "week", "next-week", "future", "any", or specific dates
- **Status:** "open", "completed", "inProgress", "cancelled"
- **Folder:** Exact or substring match
- **Tags:** Array of hashtags (without # symbol)

**Example:**
```
Query: "tasks with #work priority 1"
{
  "coreKeywords": [],
  "keywords": [],
  "tags": ["work"],
  "priority": 1
}
```

### Part 3: Executor/Environment Context (Future)
**Purpose:** Context-aware task recommendations

**Reserved for future implementation:**
- Time context (current time, time of day, day of week)
- Energy state (focus level, available time)
- User preferences (work style, preferred task types)
- Environmental factors (location, available resources)

**Potential interface:**
```typescript
{
  timeContext?: string;
  energyState?: string;
  userPreferences?: Record<string, any>;
}
```

## Semantic Expansion System

### Configuration

**Settings:**
- `enableSemanticExpansion` (boolean): Enable/disable expansion
- `maxKeywordExpansions` (number): Max variations per keyword per language (default: 5)
- `queryLanguages` (string[]): Languages for expansion (e.g., ["English", "中文"])

**Calculation:**
```
If expansion enabled:
  Total keywords per core = maxKeywordExpansions × number of languages
  
If expansion disabled:
  Total keywords per core = number of languages (translations only)

Example with 2 languages, max 5 expansions:
  Core keyword "develop"
  → Up to 10 expanded keywords (5 per language)
  → ["develop", "build", "create", "implement", "code", 
      "开发", "构建", "创建", "实现", "编程"]
```

### Expansion Process

1. **Extract Core Keywords**
   - Remove stop words (how, what, when, 如何, 什么, etc.)
   - Remove filter-related terms (priority, due, status, etc.)
   - Extract main concepts/nouns/verbs

2. **Generate Semantic Variations**
   - For each core keyword
   - Generate up to `maxKeywordExpansions` variations per language
   - Include translations in all configured languages
   - Prioritize synonyms, related terms, common expressions

3. **Filter and Deduplicate**
   - Remove stop words from expanded set
   - Deduplicate overlapping keywords (e.g., "如何" kept, "如" removed)
   - Log expansion metrics for debugging

### Benefits

1. **Cross-Language Search**
   - Write tasks in any language
   - Search in any language
   - Automatic matching across languages

2. **Semantic Recall**
   - Find tasks with related concepts
   - Example: Search "fix" → finds tasks with "repair", "solve", "debug"

3. **User Control**
   - Adjust expansion level based on needs
   - Toggle expansion on/off
   - Fine-tune per-language variations

4. **Cost Optimization**
   - Lower expansion = fewer keywords = lower token usage
   - Higher expansion = better recall = higher token usage
   - User can balance based on preferences

## Data Flow

```
User Query
    ↓
QueryParserService.parseQuery()
    ↓
[Simple Mode: Regex parsing]
[Smart/Chat Mode: AI parsing with expansion]
    ↓
ParsedQuery {
    // Part 1: Task Content
    coreKeywords: string[]
    keywords: string[] (expanded)
    
    // Part 2: Task Attributes
    priority?: number
    dueDate?: string
    status?: string
    folder?: string
    tags?: string[]
    
    // Part 3: Future
    // timeContext?: string
    // energyState?: string
    
    // Metadata
    expansionMetadata: {
        enabled: boolean
        maxExpansionsPerKeyword: number
        languagesUsed: string[]
        coreKeywordsCount: number
        totalKeywords: number
    }
}
    ↓
TaskSearchService.applyCompoundFilters()
    ↓
[Filter by Part 2 attributes using DataView API]
[Search by Part 1 keywords for semantic matching]
    ↓
Filtered & Scored Tasks
    ↓
[Smart Search: Direct results]
[Task Chat: AI analysis]
    ↓
Final Results
```

## Implementation Details

### Files Modified

1. **settings.ts**
   - Added `maxKeywordExpansions: number`
   - Added `enableSemanticExpansion: boolean`

2. **queryParserService.ts**
   - Updated `ParsedQuery` interface with three-part structure
   - Enhanced `parseWithAI()` to respect expansion settings
   - Added expansion metadata tracking
   - Updated AI prompt with expansion instructions

3. **settingsTab.ts**
   - Added UI controls for semantic expansion
   - Added "Semantic expansion" section with toggle and slider
   - Integrated with existing settings UI

### ParsedQuery Interface

```typescript
export interface ParsedQuery {
    // PART 1: Task Content (Keywords & Semantic Search)
    keywords?: string[]; // Expanded keywords
    coreKeywords?: string[]; // Original keywords before expansion
    
    // PART 2: Task Attributes (Structured Filters)
    priority?: number;
    dueDate?: string;
    status?: string;
    folder?: string;
    tags?: string[];
    
    // PART 3: Executor/Environment Context (Future - Reserved)
    // timeContext?: string;
    // energyState?: string;
    // userPreferences?: Record<string, any>;
    
    // Metadata
    originalQuery?: string;
    expansionMetadata?: {
        enabled: boolean;
        maxExpansionsPerKeyword: number;
        languagesUsed: string[];
        totalKeywords: number;
        coreKeywordsCount: number;
    };
}
```

## Usage Examples

### Example 1: Basic Search with Expansion

**Query:** "如何开发 Task Chat"

**Part 1 (Task Content):**
```json
{
  "coreKeywords": ["开发", "Task", "Chat"],
  "keywords": ["开发", "develop", "build", "create", "implement", 
               "Task", "Chat"]
}
```

**Part 2 (Task Attributes):**
```json
{
  "tags": []
}
```

**Result:** Finds tasks in any language containing development-related terms about Task Chat

### Example 2: Complex Query with Filters

**Query:** "Fix bug #urgent priority 1 due today"

**Part 1 (Task Content):**
```json
{
  "coreKeywords": ["fix", "bug"],
  "keywords": ["fix", "修复", "repair", "solve", "处理",
               "bug", "错误", "error", "问题", "issue"]
}
```

**Part 2 (Task Attributes):**
```json
{
  "tags": ["urgent"],
  "priority": 1,
  "dueDate": "today"
}
```

**Result:** Finds high-priority tasks with #urgent tag, due today, about fixing bugs

### Example 3: Attribute-Only Filter

**Query:** "tasks with #work priority 1"

**Part 1 (Task Content):**
```json
{
  "coreKeywords": [],
  "keywords": []
}
```

**Part 2 (Task Attributes):**
```json
{
  "tags": ["work"],
  "priority": 1
}
```

**Result:** Finds all high-priority tasks with #work tag (no keyword filtering)

## Performance Considerations

### Token Usage

**Without Expansion:**
- Query parsing: ~200 tokens
- Keyword count: ~2-3 per query

**With Expansion (5 per language × 2 languages):**
- Query parsing: ~200-300 tokens
- Keyword count: ~10-20 per query

**Impact:**
- Minimal increase in parsing cost
- Improved recall reduces need for multiple queries
- User can adjust `maxKeywordExpansions` to balance cost/recall

### Filtering Performance

**Part 2 (Attributes):**
- DataView API: O(n) filtering
- Very efficient for structured filters

**Part 1 (Keywords):**
- Substring matching: O(n × m) where m = keyword count
- More keywords = more thorough search
- Deduplicated before scoring to avoid double-counting

### Memory Usage

**Typical query:**
- Core keywords: 2-4
- Expanded keywords: 10-40
- Memory footprint: < 1KB per query
- Negligible impact on plugin performance

## Future Enhancements

### Part 3: Executor/Environment Context

**Planned features:**
1. **Time Context**
   - Current time of day (morning, afternoon, evening)
   - Day of week (weekday vs weekend)
   - Available time slots

2. **Energy State**
   - Focus level (high, medium, low)
   - Cognitive load preference (complex vs simple tasks)

3. **User Preferences**
   - Preferred task types
   - Work style (batch vs serial)
   - Context switching tolerance

**Implementation approach:**
- Add interface to capture user state
- Integrate with task recommendation logic
- Provide defaults with user overrides
- Log state for learning user patterns

### API Extensions

**Potential external API:**
```typescript
interface ContextProvider {
  getTimeContext(): TimeContext;
  getEnergyState(): EnergyState;
  getUserPreferences(): UserPreferences;
}
```

**Integration points:**
- Calendar API for time availability
- Activity tracking for energy state
- User feedback for preference learning

## Testing

### Test Cases

1. **Expansion Disabled**
   - Verify only translations, no semantic variations
   - Check keyword count = core count × language count

2. **Expansion Enabled**
   - Verify semantic variations generated
   - Check keyword count ≤ core count × max × language count
   - Validate no duplicates

3. **Part 2 Filters**
   - Test each attribute independently
   - Test compound filters (multiple attributes)
   - Verify DataView API integration

4. **Metadata Tracking**
   - Verify expansion metadata populated
   - Check logging output
   - Validate ratios and counts

### Console Logging

Monitor these logs for debugging:
```
[Task Chat] Semantic expansion: {
  core: 2,
  expanded: 12,
  ratio: 6,
  enabled: true
}

[Task Chat] Keywords after stop word filtering: 15 → 12
[Task Chat] Removed stop words: [how, to, the]
[Task Chat] Query parser returning (three-part): {...}
```

## Best Practices

### For Users

1. **Start with Default Settings**
   - 5 expansions per language is balanced
   - Adjust based on recall needs

2. **Language Configuration**
   - Add all languages you write tasks in
   - More languages = better cross-language matching

3. **Expansion vs Cost**
   - Disable expansion for simple searches
   - Enable for complex semantic searches
   - Monitor token usage in settings

### For Developers

1. **Respect User Settings**
   - Always check `enableSemanticExpansion`
   - Use `maxKeywordExpansions` in prompts
   - Log expansion metrics for debugging

2. **Maintain Backward Compatibility**
   - Handle queries without expansion
   - Support legacy ParsedQuery format
   - Provide sensible defaults

3. **Test Across Languages**
   - Verify expansion in all configured languages
   - Check stop word filtering per language
   - Validate deduplication logic

## Troubleshooting

### Issue: Too Many Keywords

**Symptom:** Query returns irrelevant results

**Solution:**
- Reduce `maxKeywordExpansions`
- Increase `relevanceThreshold`
- Add more specific Part 2 filters

### Issue: Too Few Results

**Symptom:** No tasks found for valid query

**Solution:**
- Increase `maxKeywordExpansions`
- Decrease `relevanceThreshold`
- Check stop word filtering
- Verify keyword extraction

### Issue: High Token Usage

**Symptom:** Token costs higher than expected

**Solution:**
- Reduce `maxKeywordExpansions`
- Disable expansion for simple queries
- Use Simple Search mode for basic queries
- Configure fewer languages

## Conclusion

The three-part query parsing system provides a robust foundation for advanced task search and filtering. Part 1 (Task Content) and Part 2 (Task Attributes) are fully implemented and working. Part 3 (Executor/Environment Context) is reserved for future enhancements.

The semantic expansion system gives users fine-grained control over the balance between recall and cost, with sensible defaults that work well for most use cases.

## References

- Implementation: `src/services/queryParserService.ts`
- Settings: `src/settings.ts`
- UI: `src/settingsTab.ts`
- Related: `docs/dev/KEYWORD_DEDUPLICATION_IMPROVEMENT_2025-10-17.md`
- Related: `docs/dev/MULTI_CRITERIA_SORTING_IMPLEMENTATION.md`
