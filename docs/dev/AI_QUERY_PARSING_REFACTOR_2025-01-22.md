# AI Query Parsing Refactor (2025-01-22)

## User's Critical Insight

**The Core Problem**: Semantic expansion is misapplied to task properties (priority, due date, status), creating unnecessary complexity and confusion.

## Current Implementation Issues

### Issue #1: Semantic Expansion Applied to Properties

**Current approach** (lines 363-456 in queryParserService.ts):
```
🚨 CRITICAL: SEMANTIC EXPANSION FOR PROPERTY TERMS (NEW!)

Just like keywords, you MUST also understand and recognize PROPERTY TERMS 
across ALL languages using semantic expansion!

Example for PRIORITY concept across ${languageList}:
- Base terms provided in Layer 1 (user-configured) + Layer 2 (internal mappings)
- You expand further into ALL languages:
  1. English: priority, important, urgent, critical, high, essential, vital, key, crucial, top
  2. 中文: 优先级, 重要, 紧急, 关键, 高优先级, 必要, 至关重要, 关键, 重要, 顶级
(Total: ~20 priority-related terms across all languages)
```

**Why this is wrong:**
- ❌ Properties don't need expansion - they need **direct conversion**
- ❌ Confuses AI with conflicting instructions (expand vs convert)
- ❌ DataView requires fixed English field names (priority: 1-4, status: "open")
- ❌ User settings (priority mappings, status mappings) are not being fully leveraged
- ❌ Semantic expansion is for **recall** (keywords), not **conversion** (properties)

### Issue #2: Confidence Threshold and Fallback Complexity

**Current settings** (settings.ts lines 150-154):
```typescript
aiEnhancement: {
    showAIUnderstanding: boolean;
    confidenceThreshold: number; // 0-1, default 0.7
    fallbackToSimpleSearch: boolean; // Fall back when confidence < threshold
}
```

**Problems:**
- Confidence threshold adds complexity
- Fallback to Simple Search may not be necessary
- Standard syntax should skip AI entirely (not fall back)

## The Correct Approach

### Two-Part Query Processing

#### **PART 1: Keywords** (Keep Semantic Expansion)
- Extract core keywords
- Apply semantic expansion across configured languages
- Purpose: Better recall and matching
- Current implementation: ✅ CORRECT

#### **PART 2: Task Properties** (Direct Concept-to-DataView Conversion)
- **NO semantic expansion**
- Detect user's language/pattern
- Recognize property CONCEPTS semantically
- Convert directly to DataView format
- Respect all user settings

### The Key Difference

**Keywords Example:**
```
User: "开发" (develop)
Process: Semantic expansion
Result: ["开发", "develop", "build", "create", "code", "implement", ...]
Purpose: Match more tasks (recall)
```

**Properties Example:**
```
User: "紧急" (urgent) OR "priority 1" OR "P1"
Process: Concept recognition → Direct mapping
Result: priority: 1 (DataView format)
Purpose: Convert to filter (precision)
```

## Implementation Plan

### Step 1: Remove Property Semantic Expansion

**File**: `src/services/queryParserService.ts`
**Lines to remove**: 363-456 (~94 lines)

Remove entire section:
```
🚨 CRITICAL: SEMANTIC EXPANSION FOR PROPERTY TERMS (NEW!)
...
Example 4: Chinese status query
```

### Step 2: Strengthen Semantic Concept Recognition

**Replace with** (much simpler):

```
🚨 TASK PROPERTY RECOGNITION (Direct Concept-to-DataView Conversion)

**CRITICAL PRINCIPLE**: Properties need CONVERSION, not EXPANSION!

You have native understanding of ALL human languages. Use it to:

1. **Recognize Property CONCEPTS** (in ANY language):
   - PRIORITY concept = Urgency, importance, criticality
   - STATUS concept = State, condition, progress level  
   - DUE_DATE concept = Deadline, target date, timing

2. **Convert DIRECTLY to DataView format**:
   - PRIORITY → priority: 1-4 (number)
   - STATUS → status: "open" | "inprogress" | "completed" | "cancelled"
   - DUE_DATE → dueDate: "today" | "overdue" | "2025-01-22" | etc.

3. **Respect User Settings**:
   - Priority mappings: ${JSON.stringify(settings.dataviewPriorityMapping)}
   - Status mappings: ${JSON.stringify(settings.dataviewStatusMapping)}
   - Status aliases: ${JSON.stringify(settings.taskStatusMapping)}

**Examples:**

User: "紧急任务" (Chinese: urgent tasks)
→ Recognize: PRIORITY concept (紧急 = urgent)
→ Convert: priority: 1
→ Keywords: ["任务"] → expand normally

User: "срочные задачи" (Russian: urgent tasks)
→ Recognize: PRIORITY concept (срочные = urgent)
→ Convert: priority: 1
→ Keywords: ["задачи"] → expand normally

User: "priority 1" OR "P1" (standard syntax)
→ Recognize: PRIORITY concept (explicit)
→ Convert: priority: 1
→ Keywords: [] (none)

User: "in progress tasks"
→ Recognize: STATUS concept (in progress)
→ Convert: status: "inprogress"
→ Keywords: ["tasks"] → expand normally
```

### Step 3: Enhanced Standard Syntax Detection

**File**: `src/services/queryParserService.ts`
**Method**: `trySimpleParse()`

**Current**: Basic detection for very simple queries only
**Enhanced**: Detect ALL standard syntax patterns (priority, status, dates)

```typescript
/**
 * Try to parse simple queries without AI
 * Handles standard syntax: P1, P2, s:x, s:open, overdue, today, etc.
 * Returns ParsedQuery if successful, null if AI is needed
 */
private static trySimpleParse(query: string): ParsedQuery | null {
    const lowerQuery = query.trim().toLowerCase();
    
    // Priority patterns: P1, P2, P3, P4, priority 1, priority:1
    const priorityMatch = query.match(/\b[pP]([1-4])\b|priority[:\s]+([1-4])/);
    if (priorityMatch) {
        const priority = parseInt(priorityMatch[1] || priorityMatch[2]);
        return { priority, originalQuery: query };
    }
    
    // Status patterns: s:x, s:open, status:open
    const statusMatch = query.match(/\bs:([^\s&|]+)|status:([^\s&|]+)/i);
    if (statusMatch) {
        const statusValue = (statusMatch[1] || statusMatch[2]).trim();
        return { status: statusValue, originalQuery: query };
    }
    
    // Date patterns: overdue, today, tomorrow, due:today
    if (/\b(overdue|past\s*due)\b/i.test(query)) {
        return { dueDate: "overdue", originalQuery: query };
    }
    if (/\btoday\b|due:today/i.test(query)) {
        return { dueDate: "today", originalQuery: query };
    }
    if (/\btomorrow\b|due:tomorrow/i.test(query)) {
        return { dueDate: "tomorrow", originalQuery: query };
    }
    
    // Combined patterns: "P1 overdue", "s:open today"
    // Parse each component and combine
    
    return null; // Needs AI for natural language
}
```

### Step 4: Simplify AI Enhancement Settings

**File**: `src/settings.ts`
**Current**:
```typescript
aiEnhancement: {
    showAIUnderstanding: boolean;
    confidenceThreshold: number;
    fallbackToSimpleSearch: boolean;
}
```

**Proposed** (simpler):
```typescript
aiEnhancement: {
    showAIUnderstanding: boolean; // Keep - useful for transparency
    // Remove confidenceThreshold - not needed
    // Remove fallbackToSimpleSearch - standard syntax skips AI anyway
}
```

**Alternative** (if we want to keep some form of confidence):
```typescript
aiEnhancement: {
    showAIUnderstanding: boolean;
    showConfidenceWarning: boolean; // Show warning if confidence < 0.7 (no fallback, just info)
}
```

### Step 5: Update Settings UI

**File**: `src/settingsTab.ts`

Remove or simplify confidence threshold and fallback settings.

Add clear explanation:
```
"Smart Search and Task Chat modes use AI to:
1. Expand keywords semantically (better recall)
2. Recognize properties in any language (better UX)

Standard syntax (P1, s:open, overdue) skips AI entirely."
```

## Benefits of This Approach

### 1. Conceptual Clarity

**Before** (confusing):
- Keywords: Expand ✅
- Properties: Expand ❌ (but we were doing it)
- Result: Mixed signals, unclear purpose

**After** (clear):
- Keywords: Expand (for recall)
- Properties: Convert (for precision)
- Result: Each part has clear purpose

### 2. Simpler Prompts

**Before**: ~500 lines of expansion examples for properties
**After**: ~100 lines of concept recognition guidance

### 3. Better Performance

**Before**: AI generates 60+ expansions for properties (wasteful)
**After**: AI recognizes concept, maps to code (efficient)

### 4. Respects User Settings

**Before**: Property expansions ignored user mappings
**After**: Direct reference to user-configured mappings

### 5. Natural for Users

Users can:
- Type standard syntax → Fast (no AI)
- Type natural language → Smart (AI converts)
- Mix languages → Works (concept recognition)

## Migration Plan

### Phase 1: Core Changes (queryParserService.ts)
1. Remove property semantic expansion section (lines 363-456)
2. Replace with direct concept-to-DataView conversion guidance
3. Enhance trySimpleParse() for better standard syntax detection

### Phase 2: Settings Simplification
1. Simplify aiEnhancement settings
2. Update settings UI with clearer explanations
3. Update default settings

### Phase 3: Testing
1. Test standard syntax (P1, s:open, overdue)
2. Test natural language (English, Chinese, Swedish, Russian, etc.)
3. Test mixed language queries
4. Test combined queries (keywords + properties)

### Phase 4: Documentation
1. Update README with new approach
2. Document the two-part system clearly
3. Provide examples for users

## Expected Behavior After Refactor

### Example 1: Standard Syntax (Skip AI)
```
Input: "P1 overdue s:open"
Parse: trySimpleParse() → {priority: 1, dueDate: "overdue", status: "open"}
AI: Not called ✅
```

### Example 2: Natural Language (English)
```
Input: "urgent open tasks that are overdue"
Parse: AI recognizes concepts
Result: {
  priority: 1,           // urgent → 1
  status: "open",        // open → "open"
  dueDate: "overdue",    // overdue → "overdue"
  keywords: ["tasks"]    // expanded normally
}
AI: Called once ✅
```

### Example 3: Natural Language (Chinese)
```
Input: "紧急未完成任务已过期"
Parse: AI recognizes concepts
Result: {
  priority: 1,           // 紧急 → 1
  status: "open",        // 未完成 → "open"
  dueDate: "overdue",    // 已过期 → "overdue"
  keywords: ["任务"]     // expanded normally
}
AI: Called once ✅
```

### Example 4: Mixed Keywords + Properties
```
Input: "Fix payment bug priority 1"
Parse: Standard syntax + keywords
Result: {
  priority: 1,                    // P1 detected
  keywords: ["Fix", "payment", "bug"]  // expanded
}
AI: Called once ✅
```

### Example 5: Pure Keywords (No Properties)
```
Input: "开发插件功能"
Parse: AI extracts and expands keywords
Result: {
  keywords: ["开发", "develop", "build", ..., "插件", "plugin", ...]
}
AI: Called once ✅
```

## Summary

**The Refactor**:
- ✅ Remove semantic expansion from properties
- ✅ Keep semantic expansion for keywords
- ✅ Add direct concept-to-DataView conversion for properties
- ✅ Enhance standard syntax detection (skip AI when possible)
- ✅ Simplify AI enhancement settings
- ✅ Clear separation of concerns

**The Result**:
- Faster parsing (less AI work)
- Clearer prompts (simpler instructions)
- Better UX (standard syntax + natural language)
- Respects user settings (priority/status mappings)
- Conceptually sound (expansion for recall, conversion for precision)

**Status**: Ready for implementation
