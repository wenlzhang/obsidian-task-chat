# Testing Guide for Bug Fixes - 2025-01-24

## What Was Fixed

### Bug #1: Query Type Misdetection
**Problem:** Query "What should I do today?" was detected as "empty" instead of "properties-only"
**Fix:** Added `extractedDueDateRange` check to `detectQueryType()`
**Impact:** Properties-only queries now get proper quality filtering

### Bug #2: Completed Tasks in Vague Queries
**Problem:** 29 out of 30 tasks shown were completed for "What should I do today?"
**Fix:** Added default status filter to exclude completed/cancelled tasks for vague queries
**Impact:** Vague queries now return only actionable (incomplete) tasks

---

## Test Scenarios

### ✅ Test 1: Simple Search - Generic Mode
**Query:** `What should I do today?`

**Settings:**
- Mode: Simple Search
- Query Mode: Generic (force generic handling)

**Expected Results:**
```
Console logs should show:
✅ [Simple Search] 🔍 Generic Mode: Forcing generic handling
✅ [Simple Search] Vague query - Converted dueDate "today" to range
✅ [Task Chat] Vague query detected - defaulting to incomplete tasks only
✅ [Task Chat] Query type: properties-only (keywords: false, properties: true)
✅ [Task Chat] After filtering: X tasks found (X << 880)

UI should show:
✅ Only incomplete tasks (no [x] completed tasks)
✅ Only tasks due today or overdue
✅ Reasonable count (10-50 tasks, not 880)
```

**Pass Criteria:**
- ✅ No completed tasks shown
- ✅ All tasks are due today or overdue
- ✅ Result count is reasonable (not 880)

---

### ✅ Test 2: Simple Search - Auto Mode
**Query:** `What should I do today?`

**Settings:**
- Mode: Simple Search
- Query Mode: Auto (heuristic detection)

**Expected Results:**
```
Console logs should show:
✅ [Simple Search] 🔍 Vague query detected: 5 words, 80% generic
✅ [Simple Search] Vague query - Converted dueDate "today" to range
✅ [Task Chat] Vague query detected - defaulting to incomplete tasks only
✅ [Task Chat] Query type: properties-only
✅ Tasks properly filtered and scored

UI should show:
✅ Only incomplete tasks
✅ Only tasks due today or overdue
✅ Reasonable count (10-50 tasks)
```

**Pass Criteria:**
- ✅ Vague query auto-detected (80% generic words)
- ✅ No completed tasks shown
- ✅ "today" converted to date range

---

### ✅ Test 3: Smart Search - AI Parsing
**Query:** `What should I do today?`

**Settings:**
- Mode: Smart Search
- AI Parsing: Enabled

**Expected Results:**
```
Console logs should show:
✅ [Task Chat] Mode: Smart Search (AI parsing)
✅ [Task Chat] AI query parser parsed: {dueDate: null, timeContext: "today", ...}
✅ [Smart/Chat] Vague query - Converted dueDate "today" to range
✅ [Task Chat] Vague query detected - defaulting to incomplete tasks only
✅ [Task Chat] Query type: properties-only (keywords: false, properties: true)
✅ [Task Chat] Using comprehensive scoring
✅ Quality filter applied: X → Y tasks

UI should show:
✅ Only incomplete tasks
✅ Only tasks due today or overdue
✅ Tasks properly scored and ranked
✅ Reasonable count after quality filtering
```

**Pass Criteria:**
- ✅ AI parsing works
- ✅ Query type correctly detected as "properties-only"
- ✅ Quality filtering applied (not skipped)
- ✅ No completed tasks shown

---

### ✅ Test 4: Explicit Status Override
**Query:** `Show completed tasks today`

**Settings:**
- Mode: Any

**Expected Results:**
```
Console logs should show:
✅ Explicit status detected: "completed"
✅ NO default status filter applied (user explicitly requested completed)
✅ Query type: properties-only or mixed

UI should show:
✅ Only completed tasks
✅ Default status filter NOT applied (respects user's explicit request)
```

**Pass Criteria:**
- ✅ Completed tasks ARE shown (user explicitly requested them)
- ✅ Default filter not applied when status explicitly specified

---

### ✅ Test 5: Non-Vague Query
**Query:** `Fix bug in payment system`

**Settings:**
- Mode: Any

**Expected Results:**
```
Console logs should show:
✅ NOT detected as vague (meaningful keywords)
✅ No default status filter applied (not vague)
✅ Query type: keywords-only or mixed
✅ All task statuses included

UI should show:
✅ Tasks matching "bug" and "payment" and "system"
✅ Both completed and incomplete tasks shown
✅ Sorted by relevance
```

**Pass Criteria:**
- ✅ Not treated as vague query
- ✅ Keyword matching works
- ✅ All statuses included (not just incomplete)

---

## Verification Checklist

### Before Testing
- [ ] Plugin rebuilt successfully (`npm run build`)
- [ ] Build output: `build/main.js  304.2kb`
- [ ] No compilation errors
- [ ] Obsidian restarted with new plugin version

### During Testing
- [ ] Open Developer Console (Cmd+Option+I on Mac)
- [ ] Filter console to show only `[Task Chat]` logs
- [ ] Clear console before each test
- [ ] Copy full console output for each test

### Test Results

**Test 1: Simple/Generic** ⬜ Pass / ⬜ Fail
- Completed tasks shown? ⬜ Yes (❌) / ⬜ No (✅)
- Task count reasonable? ⬜ Yes (✅) / ⬜ No (❌)
- Query type correct? ⬜ Yes (✅) / ⬜ No (❌)

**Test 2: Simple/Auto** ⬜ Pass / ⬜ Fail
- Vague detection worked? ⬜ Yes (✅) / ⬜ No (❌)
- Completed tasks shown? ⬜ Yes (❌) / ⬜ No (✅)
- Date range conversion? ⬜ Yes (✅) / ⬜ No (❌)

**Test 3: Smart Search** ⬜ Pass / ⬜ Fail
- AI parsing worked? ⬜ Yes (✅) / ⬜ No (❌)
- Query type correct? ⬜ Yes (✅) / ⬜ No (❌)
- Quality filtering applied? ⬜ Yes (✅) / ⬜ No (❌)
- Completed tasks shown? ⬜ Yes (❌) / ⬜ No (✅)

**Test 4: Explicit Status** ⬜ Pass / ⬜ Fail
- Completed tasks shown? ⬜ Yes (✅) / ⬜ No (❌)
- Default filter skipped? ⬜ Yes (✅) / ⬜ No (❌)

**Test 5: Non-Vague** ⬜ Pass / ⬜ Fail
- Not treated as vague? ⬜ Yes (✅) / ⬜ No (❌)
- All statuses included? ⬜ Yes (✅) / ⬜ No (❌)
- Keyword matching worked? ⬜ Yes (✅) / ⬜ No (❌)

---

## Common Issues & Troubleshooting

### Issue: Still seeing 880 tasks
**Possible causes:**
1. Plugin not reloaded (restart Obsidian)
2. Cache not cleared (try "Refresh tasks" button)
3. DataView still indexing (wait 30 seconds)

**Solution:**
1. Reload plugin or restart Obsidian
2. Check console for `[Task Chat] Query type:` - should be "properties-only" not "empty"

### Issue: Still seeing completed tasks
**Possible causes:**
1. Not a vague query (has meaningful keywords)
2. Explicit status specified (user override)
3. Query mode set incorrectly

**Solution:**
1. Check console for `[Task Chat] Vague query detected`
2. Check console for `defaulting to incomplete tasks only`
3. If neither appears, query is not vague or has explicit status

### Issue: Quality filtering not applied
**Possible causes:**
1. Query type still "empty" (detectQueryType bug not fixed)
2. DataView filtering failed
3. No tasks match filters

**Solution:**
1. Check console for `[Task Chat] Query type:` - should NOT be "empty"
2. Check console for `[Task Chat] After filtering: X tasks found`
3. Check console for `[Task Chat] Using comprehensive scoring`

---

## Expected Console Output Examples

### Good Output (Bug Fixed)
```
[Task Chat] Mode: Simple Search (regex parsing)
[Task Chat] Keywords after stop word filtering: 4 → 0
[Simple Search] 🔍 Generic Mode: Forcing generic handling
[Simple Search] Vague query - Converted dueDate "today" to range: Tasks due today + overdue
[Task Chat] Vague query detected - defaulting to incomplete tasks only (excluding completed & cancelled)
[Task Chat] Task-level filtering complete: 42 tasks matched
[Task Chat] After filtering: 42 tasks found
[Task Chat] Query type: properties-only (keywords: false, properties: true)
[Task Chat] Sort order: [relevance, dueDate, priority, status]
[Task Chat] Result delivery: Direct (Simple Search mode, 42 results)
```

### Bad Output (Bug Still Present)
```
[Task Chat] Mode: Simple Search (regex parsing)
[Task Chat] Keywords after stop word filtering: 4 → 0
[Simple Search] 🔍 Generic Mode: Forcing generic handling
[Simple Search] Vague query - Converted dueDate "today" to range: Tasks due today + overdue
[Task Chat] Task-level filtering complete: 880 tasks matched  ← ❌ NOT filtered by status
[Task Chat] After filtering: 880 tasks found
[Task Chat] Query type: empty (keywords: false, properties: false)  ← ❌ WRONG! Should be "properties-only"
[Task Chat] Sort order: [relevance, dueDate, priority, status]
[Task Chat] Result delivery: Direct (Simple Search mode, 880 results)  ← ❌ Too many!
```

---

## Success Criteria

**All Tests Pass If:**
1. ✅ Vague queries return only incomplete tasks (no completed shown)
2. ✅ Query type correctly detected as "properties-only" (not "empty")
3. ✅ Quality filtering applied (task count reduced from 880 to ~10-50)
4. ✅ Date range conversion works ("today" → today + overdue)
5. ✅ Explicit status queries still work (can request completed if needed)
6. ✅ Non-vague queries unchanged (all statuses included)

**Critical Issues If:**
1. ❌ Still seeing 880 tasks
2. ❌ Still seeing 29/30 completed tasks
3. ❌ Query type still "empty"
4. ❌ Quality filtering not applied

---

## Next Steps After Testing

### If All Tests Pass ✅
1. Mark fixes as verified
2. Update changelog
3. Consider release
4. Monitor user feedback

### If Tests Fail ❌
1. Document which tests failed
2. Copy full console output
3. Check if plugin reloaded properly
4. Report specific failure cases
5. Review fix implementation

---

**Happy Testing!** 🧪
