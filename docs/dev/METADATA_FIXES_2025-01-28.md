# Metadata Display Fixes (2025-01-28)

## Issues Fixed

### 1. Duplicate Language Display ✅

**Problem:**
Metadata showed duplicate language information:
```
📊 Mode: Task Chat • OpenAI: gpt-4.1-mini (parser + analysis) • ~21,156 tokens (20,562 in, 594 out) • ~$0.0092 • Language: Chinese • Lang: Chinese
```

**Root Cause:**
- `MetadataService` includes verbose "Language: Chinese"
- `getAIUnderstandingSummary()` includes compact "Lang: Chinese"
- Both were being concatenated in metadata line

**Fix:**
Removed the verbose "Language:" from `MetadataService` in all cases (error and normal). 
Kept the compact "Lang:" from `getAIUnderstandingSummary()` for cleaner display.

**Files:**
- `src/services/metadataService.ts` - Removed all "Language:" entries (lines 40, 89, 136)
- `src/views/chatView.ts` - Kept "Lang:" in AI summary (lines 532-540)

**After:**
```
📊 Mode: Task Chat • OpenAI: gpt-4.1-mini (parser + analysis) • ~21,156 tokens (20,562 in, 594 out) • ~$0.0092 • Lang: Chinese
```

**Why "Lang:" instead of "Language:":**
- More compact (saves space in metadata bar)
- Consistent with other abbreviations
- Still clear and understandable

---

### 2. Partial Success Not Handled ✅

**Problem:**
When one operation succeeded but another failed (e.g., parsing succeeded but analysis failed), metadata was oversimplified showing only "Mode: Task Chat" even though there were actual costs and token usage.

**Key Insight:**
- If `tokenUsage` exists → At least ONE operation succeeded → Costs were incurred
- Should show FULL metadata (mode, provider, model, tokens, cost, language)
- Only simplify when BOTH operations failed (no tokenUsage AND status code error)

**Scenarios:**

**Task Chat Mode:**

| Parsing | Analysis | tokenUsage | Display |
|---------|----------|------------|---------|
| ✅ Success | ✅ Success | Yes | Full metadata (normal case) |
| ✅ Success | ❌ Failed | Yes | Full metadata (costs incurred) |
| ❌ Failed | ✅ Success | Yes | Full metadata (costs incurred) |
| ❌ Failed (status code) | ❌ Not executed | No | Simplified (Mode only) |

**Smart Search Mode:**

| Parsing | tokenUsage | Display |
|---------|------------|---------|
| ✅ Success | Yes | Full metadata |
| ❌ Failed (status code) | No | Simplified (Mode only) |

**Fix:**
Changed the condition in `MetadataService.formatMetadata()`:

**Before (WRONG):**
```typescript
// For API errors with status codes, ONLY show mode (simplified)
if (message.error?.statusCode) {
    return "📊 " + parts.join(" • ");
}
```

**After (CORRECT):**
```typescript
// For API errors with status codes AND no token usage, ONLY show mode (simplified)
// This means BOTH operations failed (parsing + analysis in Task Chat)
// If tokenUsage exists, at least one operation succeeded and incurred costs → show full metadata
if (message.error?.statusCode && !message.tokenUsage) {
    return "📊 " + parts.join(" • ");
}
```

**File:** `src/services/metadataService.ts` (lines 28-33)

**Examples:**

**Partial Success (Task Chat - Parsing succeeded, Analysis failed):**
```
📊 Mode: Task Chat • OpenAI: gpt-4o-mini (parser), claude-sonnet-4 (analysis failed) • 1,250 tokens (800 in, 450 out) • ~$0.02 • Language: English
```
User sees the costs and knows parsing succeeded.

**Both Failed (Task Chat - Status code 400):**
```
📊 Mode: Task Chat
```
Simplified because no operations succeeded, no costs incurred.

---

### 3. Warning Message Placement ✅

**Problem:**
Warning/error messages appeared in various places, making them easy to miss or interrupting the flow.

**Fix:**
Moved error rendering to appear IMMEDIATELY after the message header, BEFORE all content.
This ensures maximum visibility and user sees errors first.

**File:** `src/views/chatView.ts` (lines 744-748)

**Rendering Order:**

```
┌─────────────────────────────────────┐
│ Message Header (Role + Time)       │
├─────────────────────────────────────┤
│ ⚠️ Error/Warning Message           │  ← AT THE TOP (immediate visibility)
│ (If error exists)                  │
├─────────────────────────────────────┤
│ Message Content (Summary)          │
│ (Main AI response text)            │
├─────────────────────────────────────┤
│ Recommended Tasks                  │
│ 1. Task one...                     │
│ 2. Task two...                     │
├─────────────────────────────────────┤
│ Keyword Expansion Info             │
│ (If applicable)                    │
├─────────────────────────────────────┤
│ Metadata Bar                       │
│ 📊 Mode • Provider • Tokens • Cost │
└─────────────────────────────────────┘
```

**Benefits:**
- ✅ **Maximum visibility** - Error seen first, before any content
- ✅ **Immediate attention** - Users know something went wrong right away
- ✅ **Clear context** - Error appears before content it relates to
- ✅ **No interruption** - Content flows naturally after error
- ✅ **Better UX** - Users can decide whether to read further

---

## Summary

**Three issues fixed:**

1. ✅ **Duplicate language** - Removed verbose "Language:" from metadata, kept compact "Lang:" from AI summary
2. ✅ **Partial success metadata** - Show full metadata when costs incurred (tokenUsage exists)
3. ✅ **Warning placement** - Moved to TOP (after header, before all content) for maximum visibility

**Key Logic Change:**

```typescript
// OLD: Simplify if status code exists
if (message.error?.statusCode) { ... }

// NEW: Simplify ONLY if BOTH operations failed (no costs)
if (message.error?.statusCode && !message.tokenUsage) { ... }
```

**Philosophy:**

> If costs were incurred (tokenUsage exists), show full metadata.
> Users need to see what they're paying for, even if one operation failed.

**Files Modified:**
- `src/views/chatView.ts` - Restored compact "Lang:" in AI summary, moved error rendering to top
- `src/services/metadataService.ts` - Removed verbose "Language:", fixed partial success handling

**Impact:**
- ✅ Cleaner metadata display (no duplicates, more compact)
- ✅ More informative error cases (show costs when incurred)
- ✅ Better visual flow (errors at top for immediate visibility)
- ✅ User-friendly (see errors first, understand what succeeded vs failed)
