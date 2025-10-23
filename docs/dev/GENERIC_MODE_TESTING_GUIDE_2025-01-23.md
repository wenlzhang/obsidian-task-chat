# Generic Question Mode - Testing Guide

## Quick Test Checklist ✅

### UI Verification

**Settings Tab:**
- [ ] Open Settings → See "Generic question detection" section
- [ ] Default mode dropdown shows: 🤖 Auto | 🔍 Generic
- [ ] Current value shows correctly
- [ ] Threshold slider: 50-90%, step 5%, default 70%
- [ ] Info box displays with links

**Chat Interface:**
- [ ] See "Generic:" dropdown next to Chat Mode
- [ ] Options: 🤖 Auto | 🔍 Generic
- [ ] Current value matches settings
- [ ] Dropdown is interactive

---

### Behavior Tests

#### Test 1: Auto Mode - Vague Query

```
Setup:
- Mode: Auto
- Threshold: 70%

Query: "What should I do today?"

Expected Console:
[Task Chat] 🔍 VAGUE QUERY DETECTED
[Task Chat] Detection method: Heuristic-based
[Task Chat] Heuristic analysis: 5 words, 80% generic (threshold: 70%)

Expected Result:
✅ isVague = true
✅ All tasks shown
✅ Time "today" as context
```

#### Test 2: Generic Mode - Force Vague

```
Setup:
- Mode: Generic (forced)

Query: "Deploy API today"

Expected Console:
[Task Chat] 🔍 Generic Mode: Forcing generic handling
[Task Chat] Detection method: Generic Mode (forced)

Expected Result:
✅ isVague = true (forced)
✅ ALL tasks shown (broad)
✅ Time "today" as context (never filter!)
```

#### Test 3: Auto Mode - Specific Query

```
Setup:
- Mode: Auto
- Threshold: 70%

Query: "Fix authentication bug"

Expected Console:
(No vague detection log)

Expected Result:
✅ isVague = false
✅ Tasks matching keywords
✅ Normal filtering
```

#### Test 4: Threshold Adjustment

```
Setup:
- Mode: Auto
- Change threshold: 70% → 85%

Query: "What's next to do?"

Analysis:
- Words: "what", "next", "to", "do"
- Generic: "what", "to", "do" (3/4 = 75%)
- Threshold: 85%

Expected Result:
✅ 75% < 85% → NOT vague
✅ Normal keyword matching
```

#### Test 5: Session Reset

```
Actions:
1. Change dropdown: Auto → Generic
2. Verify: currentGenericMode = "generic"
3. Click "Sessions" → Select different session

Expected Result:
✅ currentGenericMode resets to defaultGenericMode
✅ Dropdown shows default value
```

#### Test 6: Clear Chat Reset

```
Actions:
1. Change dropdown: Auto → Generic
2. Verify: currentGenericMode = "generic"
3. Click "Clear"

Expected Result:
✅ currentGenericMode resets to defaultGenericMode
✅ Dropdown shows default value
```

#### Test 7: Settings Change Sync

```
Actions:
1. Settings Tab: Change default to Generic
2. Return to Chat

Expected Result:
✅ defaultGenericMode = "generic"
✅ currentGenericMode = "generic" (synced)
✅ Dropdown shows Generic
```

---

### Mode-Specific Tests

#### Simple Search Mode

```
Query: "What should I do?"

Expected Console:
[Simple Search] 🔍 Vague query detected: 5 words, 100% generic (threshold: 70%)

Expected Result:
✅ Heuristic detection
✅ No AI cost
✅ isVague flag set
```

#### Smart Search Mode

```
Query: "今天可以做什么？"

Expected Console:
[Task Chat] 🔍 VAGUE QUERY DETECTED
[Task Chat] Detection method: AI-based
[Task Chat] Time context detected: "today" (context, not filter)

Expected Result:
✅ AI detection (primary)
✅ timeContext = "today"
✅ dueDate = null
```

#### Task Chat Mode

```
Query: "What's urgent?"

Expected Console:
[Task Chat] 🔍 VAGUE QUERY DETECTED
[Task Chat] Detection method: AI-based
[Task Chat] Strategy: Will use property filters only

Expected Result:
✅ AI detection
✅ Property filters applied (priority)
✅ Keyword matching skipped
✅ AI provides recommendations
```

---

### Edge Cases

#### Empty Query

```
Query: ""

Expected Result:
✅ No detection (empty)
✅ Return all tasks or error
```

#### All Stop Words

```
Query: "the a an"

Expected Result:
✅ 100% generic → Vague
✅ Filtered keywords empty
✅ Broad results
```

#### Mixed Language

```
Query: "今天 fix the bug"

Expected Result:
✅ Detection works
✅ Mixed keywords extracted
✅ Semantic expansion across languages
```

#### Property + Generic

```
Query: "What's priority 1?"

Expected Result:
✅ isVague = true (generic question)
✅ priority = 1 (property extracted)
✅ Strategy: Filter by P1, skip keyword matching
```

---

### Console Log Verification

**Expected Patterns:**

**Generic Mode:**
```
[Task Chat] 🔍 Generic Mode: Forcing generic handling (user override)
```

**Auto Mode - AI:**
```
[Task Chat] Detection method: AI-based
[Task Chat] AI reasoning: <reason>
```

**Auto Mode - Heuristic:**
```
[Task Chat] Detection method: Heuristic-based
[Task Chat] Heuristic analysis: X words, Y% generic (threshold: Z%)
```

**Time Context:**
```
[Task Chat] Time context detected: "today" (context, not filter)
```

---

### Performance Tests

#### No Regression

```
Test: Same queries as before implementation

Expected:
✅ Default behavior unchanged (Auto mode, 70% threshold)
✅ No slowdown
✅ Same results as before
```

#### Mode Switch Speed

```
Test: Rapidly change dropdown 10 times

Expected:
✅ Instant updates
✅ Settings save correctly
✅ No UI lag
```

---

### Integration Tests

#### With Semantic Expansion

```
Mode: Auto (specific query)
Query: "deploy backend"

Expected:
✅ isVague = false
✅ Semantic expansion works
✅ Keywords: ["deploy", "部署", "utveckla", ...]
```

#### With Property Filters

```
Mode: Generic (forced)
Query: "priority 1 due today"

Expected:
✅ isVague = true (forced)
✅ priority = 1 extracted
✅ dueDate = null (context in Generic mode!)
✅ timeContext = "today"
```

#### With Stop Words

```
Mode: Auto
Query: "What should I do with the tasks?"

Expected:
✅ RAW keywords include stop words for detection
✅ FILTERED keywords exclude stop words for matching
✅ Detection: 5/8 = 62% → NOT vague (< 70%)
```

---

### Error Cases

#### Invalid Threshold

```
Test: Manually set threshold to 1.5 in data.json

Expected:
✅ Fallback to default (0.7)
✅ No crash
```

#### Invalid Mode

```
Test: Manually set mode to "invalid" in data.json

Expected:
✅ Fallback to "auto"
✅ No crash
```

---

## Testing Commands

### Build and Test

```bash
# Build plugin
npm run build

# Check for errors
npm run check

# Run tests (if available)
npm test
```

### Manual Testing

1. **Install plugin** in Obsidian
2. **Open Settings** → Task Chat
3. **Verify UI** components
4. **Test each scenario** above
5. **Check console logs** (Ctrl+Shift+I)
6. **Verify behavior** matches expected

---

## Success Criteria

### Must Pass

- [ ] All UI components visible
- [ ] Dropdown changes save to settings
- [ ] Auto mode detects correctly
- [ ] Generic mode forces correctly
- [ ] Threshold adjustment works
- [ ] Session reset works
- [ ] Console logs accurate

### Should Pass

- [ ] All 3 modes work (Simple/Smart/Chat)
- [ ] Time context vs filter distinction
- [ ] Mixed queries handled
- [ ] Edge cases handled
- [ ] No performance regression

### Nice to Have

- [ ] Smooth UI transitions
- [ ] Helpful console messages
- [ ] Clear user feedback
- [ ] Good default behavior

---

## Troubleshooting

### Issue: Dropdown doesn't appear

**Check:**
- Settings file has new fields
- Chat view renders dropdown
- CSS styles loaded

### Issue: Detection not working

**Check:**
- Console logs for detection method
- Settings values correct
- isVague flag propagated

### Issue: Threshold not applying

**Check:**
- Settings saved correctly
- Value passed to isVagueQuery()
- Console shows correct threshold

### Issue: Reset not working

**Check:**
- Session switch logic executes
- Settings sync correctly
- Dropdown updates UI

---

## Quick Test Script

Copy this to console for quick test:

```javascript
// Test settings
const settings = app.plugins.plugins['obsidian-task-chat'].settings;
console.log('Default mode:', settings.defaultGenericMode);
console.log('Current mode:', settings.currentGenericMode);
console.log('Threshold:', settings.vagueQueryThreshold);

// Test detection
const StopWords = app.plugins.plugins['obsidian-task-chat'].StopWords;
const ratio = StopWords.calculateVaguenessRatio(['what', 'should', 'do']);
console.log('Vagueness ratio:', ratio);
console.log('Is vague (70%):', ratio >= 0.7);
```

---

## Report Template

```
## Test Report

**Date:** [DATE]
**Tester:** [NAME]
**Build:** [VERSION]

### UI Tests
- [ ] Settings UI: PASS/FAIL
- [ ] Chat UI: PASS/FAIL

### Behavior Tests
- [ ] Auto mode: PASS/FAIL
- [ ] Generic mode: PASS/FAIL
- [ ] Threshold: PASS/FAIL
- [ ] Reset: PASS/FAIL

### Mode Tests
- [ ] Simple Search: PASS/FAIL
- [ ] Smart Search: PASS/FAIL
- [ ] Task Chat: PASS/FAIL

### Issues Found
1. [Issue description]
2. [Issue description]

### Notes
[Additional observations]
```

---

**All tests documented! Ready for comprehensive testing.** 🧪
