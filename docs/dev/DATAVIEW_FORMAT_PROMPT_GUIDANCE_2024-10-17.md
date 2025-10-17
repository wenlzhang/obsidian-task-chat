# DataView Format Prompt Guidance - Enhanced AI Understanding

**Date:** 2024-10-17  
**Issue:** AI might try to parse raw DataView syntax from task text instead of using extracted metadata

---

## Problem Identified

### User's Concern:
> "Task properties in DataView format have strict formats - brackets with keys, emoji shorthands with dates. Should we provide more specific guidelines in the prompt? Can we use existing DataView API functions?"

### The Issue:

**Task text might contain:**
```markdown
- [ ] Implement feature [p::1] [due::2025-10-20] 🗓️2025-10-20 ⏫
```

**AI might see and try to parse:**
- Inline fields: `[p::1]`, `[due::2025-10-20]`
- Emoji shorthands: `🗓️2025-10-20`
- Priority emojis: `⏫`

**But we already extract these using DataView API and show as:**
```
Status: Open | Priority: 1 | Due: 2025-10-20
```

**Problem:** AI might try to manually parse raw syntax from text instead of trusting the clean extracted metadata!

---

## Solution: Enhanced Prompt Guidance

### What We Already Do (DataView API):

Our system uses `dataviewService.ts` functions:
- `getFieldValue()` - Checks ALL DataView storage locations
- `extractEmojiShorthand()` - Extracts emoji dates (🗓️, ✅, ➕, 🛫, ⏳)
- `extractInlineField()` - Extracts `[key::value]` syntax
- `mapPriority()` - Maps user's priority values
- `formatDate()` - Formats dates consistently

✅ **We handle all DataView formats correctly using the API!**

---

### What We Added to Prompt:

**New Section in `buildMetadataGuidance()`:**

```
⚠️ DATAVIEW FORMAT IN TASK TEXT (DO NOT PARSE MANUALLY):
Task text may contain raw DataView field syntax that has ALREADY been extracted:
- Inline fields: [p::1], [due::2025-10-20]
- Emoji shorthands: 🗓️2025-10-20 (due), ✅2025-10-15 (completed), ➕2025-10-10 (created)
- Priority emojis: ⏫ (high), 🔼 (medium), 🔽 (low)

→ These are ALREADY extracted and displayed in structured metadata!
→ Do NOT parse these from text - they're shown as clean fields below the task
→ If you see [due::2025-10-20] in text AND "Due: 2025-10-20" in metadata, use the metadata!
→ The system uses DataView API to extract these - trust the structured fields, not raw text
```

**Field-Specific Warnings:**

For each field, we now explicitly warn about raw DataView syntax:

```
- **Priority**: 
  → Ignore [p::X] or ⏫/🔼/🔽 in text
  
- **Due date**:
  → Ignore [due::DATE] or 🗓️DATE in text
  
- **Created date**:
  → Ignore [created::DATE] or ➕DATE in text
  
- **Completed date**:
  → Ignore [completed::DATE] or ✅DATE in text
```

---

## DataView Formats Explained

### 1. Inline Field Syntax

**Format:** `[key::value]`

**Examples:**
```markdown
[p::1]                  # Priority 1
[due::2025-10-20]       # Due date
[priority::high]        # Priority (text value)
[created::2025-10-15]   # Created date
```

**Our Handling:**
- Extracted by `extractInlineField()` in dataviewService
- Matched against user's configured field names
- Displayed as clean metadata

---

### 2. Emoji Shorthands (DataView Standard)

**Format:** `emoji DATE`

**Examples:**
```markdown
🗓️2025-10-20  # Due date (calendar emoji)
✅2025-10-15  # Completion date (checkmark)
➕2025-10-10  # Created date (plus sign)
🛫2025-10-18  # Start date (plane taking off)
⏳2025-10-22  # Scheduled date (hourglass)
```

**DataView Field Names (FIXED):**
- 🗓️ → `due`
- ✅ → `completion` (NOT "completed"!)
- ➕ → `created`
- 🛫 → `start`
- ⏳ → `scheduled`

**Our Handling:**
- Extracted by `extractEmojiShorthand()` in dataviewService
- Maps to DataView's standard field names
- Also checks user's configured field names
- Displayed as clean metadata

---

### 3. Priority Emojis (Tasks Plugin Format)

**Format:** Standalone emoji in text

**Examples:**
```markdown
⏫  # High priority
🔼  # Medium priority
🔽  # Low priority
⏬  # Lower priority
```

**Our Handling:**
- Detected as fallback in `processDataviewTask()`
- Maps to numeric priorities (1, 2, 3)
- Used when no inline field found
- Displayed using user's priority labels

---

## User Settings Integration

### Dynamic Field Names in Prompt

The prompt now uses user's actual configured field names:

```typescript
// Shows user's actual field names in warnings
`[${settings.dataviewKeys.priority}::X]`      // e.g., [p::1]
`[${settings.dataviewKeys.dueDate}::DATE]`    // e.g., [due::2025-10-20]
`[${settings.dataviewKeys.createdDate}::DATE]` // e.g., [created::2025-10-15]
```

**Example:** If user configured `dueDate: "deadline"`, prompt shows:
```
→ Ignore [deadline::DATE] or 🗓️DATE in text
```

---

## Architecture: Why This Works

### Separation of Concerns:

```
┌─────────────────────────────────────────────┐
│ 1. DataView API (dataviewService.ts)       │
│    - Extracts from ALL DataView locations  │
│    - Handles inline fields, emojis, etc.   │
│    - Returns clean Task objects            │
└──────────────┬──────────────────────────────┘
               │
               ↓
┌─────────────────────────────────────────────┐
│ 2. Task Context (aiService.ts)             │
│    - Builds clean metadata from Task       │
│    - Shows: "Status: X | Priority: Y"      │
│    - No raw DataView syntax                │
└──────────────┬──────────────────────────────┘
               │
               ↓
┌─────────────────────────────────────────────┐
│ 3. AI Analysis                              │
│    - Sees only clean metadata              │
│    - Warned not to parse raw syntax        │
│    - Trusts structured fields              │
└─────────────────────────────────────────────┘
```

### Why AI Shouldn't Parse Manually:

1. **Already Done:** DataView API did it correctly
2. **User Settings:** Uses configured field names and mappings
3. **Edge Cases:** DataView API handles all edge cases
4. **Consistency:** Same parsing logic everywhere
5. **Maintenance:** Changes in one place (dataviewService)

---

## Example Scenarios

### Scenario 1: Task with Inline Fields

**Raw Task Text:**
```markdown
- [ ] Implement feature [p::high] [due::2025-10-20]
```

**What AI Sees:**
```
[TASK_1] Implement feature [p::high] [due::2025-10-20]
  Status: Open | Priority: high | Due: 2025-10-20
```

**AI Knows:**
- ✅ Use "Priority: high" from metadata
- ❌ Don't try to parse `[p::high]` from text
- ✅ Use "Due: 2025-10-20" from metadata
- ❌ Don't try to parse `[due::2025-10-20]` from text

---

### Scenario 2: Task with Emoji Shorthands

**Raw Task Text:**
```markdown
- [ ] Fix bug 🗓️2025-10-18 ⏫
```

**What AI Sees:**
```
[TASK_1] Fix bug 🗓️2025-10-18 ⏫
  Status: Open | Priority: 1 | Due: 2025-10-18
```

**AI Knows:**
- ✅ Use "Priority: 1" from metadata
- ❌ Don't try to interpret ⏫ as priority
- ✅ Use "Due: 2025-10-18" from metadata
- ❌ Don't try to parse 🗓️2025-10-18 from text

---

### Scenario 3: Mixed Formats

**Raw Task Text:**
```markdown
- [ ] Review code [created::2025-10-10] 🗓️2025-10-20 [p::1] ⏫
```

**What AI Sees:**
```
[TASK_1] Review code [created::2025-10-10] 🗓️2025-10-20 [p::1] ⏫
  Status: Open | Priority: 1 | Due: 2025-10-20 | Created: 2025-10-10
```

**AI Knows:**
- ✅ All properties already in clean metadata
- ❌ Don't parse ANY DataView syntax from text
- ✅ Trust the structured fields
- The raw syntax in text is for vault storage only

---

## Benefits

### For Users:
✅ **Consistent Interpretation:** AI always uses correct metadata  
✅ **No Confusion:** Clear what's metadata vs. text content  
✅ **Respects Settings:** Uses user's configured field names  
✅ **Reliable:** DataView API handles all edge cases  

### For Developers:
✅ **Centralized Logic:** All DataView parsing in dataviewService  
✅ **Maintainable:** Change once, works everywhere  
✅ **Type-Safe:** Task objects have proper types  
✅ **Testable:** Can test DataView parsing separately  

### For AI:
✅ **Clear Instructions:** Knows to use metadata, not text  
✅ **Explicit Warnings:** Told exactly what to ignore  
✅ **User-Specific:** Shows actual configured field names  
✅ **Consistent Format:** Always sees same clean structure  

---

## Files Modified

### promptBuilderService.ts
**Function:** `buildMetadataGuidance(settings: PluginSettings)`

**What It Does:**
- Gets user's configured field names
- Builds warnings about DataView syntax
- Shows emoji shorthand examples
- Warns about priority emojis
- Makes warnings specific to user's config

**Used By:** `aiService.ts` in `buildMessages()`

---

## Testing Recommendations

### Test Case 1: Inline Fields
**Task:** `- [ ] Test [p::high] [due::2025-10-20]`

**Expected:**
- AI sees clean metadata
- AI doesn't mention `[p::high]` or `[due::2025-10-20]`
- AI uses "Priority: high" and "Due: 2025-10-20"

### Test Case 2: Emoji Shorthands
**Task:** `- [ ] Test 🗓️2025-10-20 ⏫`

**Expected:**
- AI sees clean metadata
- AI doesn't mention 🗓️ or ⏫
- AI uses structured priority and due date

### Test Case 3: Custom Field Names
**User Config:** `dueDate: "deadline"`  
**Task:** `- [ ] Test [deadline::2025-10-20]`

**Expected:**
- Prompt shows warning about `[deadline::DATE]`
- AI recognizes it as due date field
- Uses clean metadata correctly

---

## Summary

**What We Did:**
1. ✅ Enhanced prompt to explain DataView formats
2. ✅ Added explicit warnings about raw syntax
3. ✅ Used user's actual configured field names
4. ✅ Explained what DataView API already does
5. ✅ Centralized in PromptBuilderService

**What We're Leveraging:**
- ✅ DataView API (getFieldValue, extractEmojiShorthand, etc.)
- ✅ User settings (field names, priority mappings)
- ✅ Existing extraction logic (dataviewService.ts)
- ✅ Clean Task objects with proper types

**Result:**
AI now understands that raw DataView syntax in text is already extracted and shown as clean metadata. It trusts the structured fields and doesn't try to manually parse DataView formats.

**Build:** ✅ 132.4KB - Successful  
**Status:** ✅ COMPLETE - AI properly guided to use DataView API-extracted metadata!
