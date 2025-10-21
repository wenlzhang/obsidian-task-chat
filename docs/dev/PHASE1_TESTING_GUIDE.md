# Phase 1 Testing Guide - AI Natural Language Understanding

**Date**: 2025-01-21  
**Status**: Ready for Testing  
**Build**: 278.2kb

---

## 🎯 **What We're Testing**

Phase 1 implements AI-enhanced natural language understanding with:
- ✅ Natural language queries (not just syntax)
- ✅ Automatic typo correction
- ✅ Multilingual support (user-configured languages)
- ✅ Property recognition (status, priority, due date)

---

## 📋 **Prerequisites**

Before testing, ensure:

1. ✅ **Plugin Installed**
   - Task Chat plugin installed in Obsidian
   - Latest build (278.2kb) loaded

2. ✅ **AI Provider Configured**
   - Settings → AI Provider Settings
   - API key entered (OpenAI, Anthropic, OpenRouter, or Ollama)
   - Model selected (e.g., gpt-4o-mini, claude-3-5-sonnet)
   - Temperature: 0.7 (recommended)

3. ✅ **Query Languages Configured**
   - Settings → Query Languages
   - At least 1 language configured
   - Example: `["English", "中文", "Svenska"]`
   - Note: Use English language names (not native names)

4. ✅ **Semantic Expansion Enabled**
   - Settings → Enable Semantic Expansion
   - Must be ON for AI parsing to work

5. ✅ **Mode Selection**
   - Must use **Smart Search** or **Task Chat** mode
   - Simple Search does NOT use AI parsing
   - Check mode dropdown at top of chat interface

---

## 🧪 **Testing Process**

### **Step 1: Basic Setup Verification**

1. Open Obsidian
2. Open Task Chat panel
3. Verify mode is **Smart Search** or **Task Chat**
4. Open Developer Console (Ctrl+Shift+I / Cmd+Option+I)
5. Look for startup logs

**Expected Console Output:**
```
[Task Chat] Plugin loaded
[Task Chat] AI Provider: openai (or anthropic/openrouter/ollama)
[Task Chat] Query Languages: English, 中文, Svenska
[Task Chat] Semantic Expansion: enabled
```

---

### **Step 2: Test Natural Language Understanding**

#### **Test 2.1: Simple Status Query**

**Query**: `show me open tasks`

**Expected Behavior:**
- AI parses "open" as status filter
- Returns tasks with open status
- Console shows parsed query with `status: "open"`

**Verification:**
```javascript
// Check console for:
[Query Parser] Parsed query: {
  "keywords": ["tasks"],
  "status": "open",
  "aiUnderstanding": {
    "naturalLanguageUsed": true,
    ...
  }
}
```

**Pass Criteria:**
- ✅ Query understood correctly
- ✅ Open tasks displayed
- ✅ Status filter applied
- ✅ aiUnderstanding metadata present

---

#### **Test 2.2: Priority Recognition**

**Query**: `urgent tasks`

**Expected Behavior:**
- AI recognizes "urgent" as priority 1
- Returns high-priority tasks
- Console shows `priority: 1`

**Verification:**
```javascript
[Query Parser] Parsed query: {
  "keywords": ["tasks"],
  "priority": 1,
  "aiUnderstanding": {
    "semanticMappings": {
      "priority": "urgent → 1"
    }
  }
}
```

**Pass Criteria:**
- ✅ "urgent" mapped to priority 1
- ✅ High-priority tasks shown
- ✅ Semantic mapping logged

---

#### **Test 2.3: Combined Properties**

**Query**: `show me urgent open tasks that are overdue`

**Expected Behavior:**
- Multiple properties recognized:
  * "urgent" → priority 1
  * "open" → status "open"
  * "overdue" → dueDate "overdue"
- Returns tasks matching ALL criteria

**Verification:**
```javascript
[Query Parser] Parsed query: {
  "keywords": ["tasks"],
  "priority": 1,
  "status": "open",
  "dueDate": "overdue",
  "aiUnderstanding": {
    "semanticMappings": {
      "priority": "urgent → 1",
      "status": "open → open",
      "dueDate": "overdue → overdue"
    }
  }
}
```

**Pass Criteria:**
- ✅ All 3 properties recognized
- ✅ Tasks filtered by all criteria
- ✅ Correct semantic mappings

---

#### **Test 2.4: Natural Language Status**

**Query**: `tasks I'm working on`

**Expected Behavior:**
- "working on" → status "inprogress"
- Returns in-progress tasks

**Verification:**
```javascript
[Query Parser] Parsed query: {
  "keywords": ["tasks"],
  "status": "inprogress",
  "aiUnderstanding": {
    "semanticMappings": {
      "status": "working on → inprogress"
    }
  }
}
```

**Pass Criteria:**
- ✅ Natural language understood
- ✅ Mapped to correct status
- ✅ In-progress tasks shown

---

### **Step 3: Test Typo Correction**

#### **Test 3.1: Single Typo**

**Query**: `urgant tasks`

**Expected Behavior:**
- "urgant" corrected to "urgent"
- Priority 1 filter applied
- Typo correction logged

**Verification:**
```javascript
[Query Parser] Parsed query: {
  "keywords": ["tasks"],
  "priority": 1,
  "aiUnderstanding": {
    "correctedTypos": ["urgant→urgent"],
    "semanticMappings": {
      "priority": "urgent → 1"
    }
  }
}
```

**Pass Criteria:**
- ✅ Typo corrected automatically
- ✅ Query parsed correctly
- ✅ Correction logged in aiUnderstanding

---

#### **Test 3.2: Multiple Typos**

**Query**: `urgant complated taks in paymant system`

**Expected Behavior:**
- All typos corrected:
  * urgant → urgent
  * complated → completed
  * taks → tasks
  * paymant → payment
- Properties and keywords extracted correctly

**Verification:**
```javascript
[Query Parser] Parsed query: {
  "keywords": ["tasks", "payment", "system"],
  "priority": 1,
  "status": "completed",
  "aiUnderstanding": {
    "correctedTypos": [
      "urgant→urgent",
      "complated→completed",
      "taks→tasks",
      "paymant→payment"
    ]
  }
}
```

**Pass Criteria:**
- ✅ All 4 typos corrected
- ✅ Priority and status extracted
- ✅ Keywords correct
- ✅ All corrections logged

---

### **Step 4: Test Multilingual Support**

#### **Test 4.1: Chinese Query**

**Query**: `紧急任务`

**Expected Behavior:**
- Language detected as Chinese (zh)
- "紧急" → priority 1
- Returns urgent tasks

**Verification:**
```javascript
[Query Parser] Parsed query: {
  "keywords": ["任务"],
  "priority": 1,
  "aiUnderstanding": {
    "detectedLanguage": "zh",
    "semanticMappings": {
      "priority": "紧急 → 1"
    }
  }
}
```

**Pass Criteria:**
- ✅ Chinese query understood
- ✅ Language detected
- ✅ Property mapped correctly

---

#### **Test 4.2: Complex Multilingual Query**

**Query**: `明天到期的紧急未完成任务`

**Expected Behavior:**
- Multiple properties in Chinese:
  * "明天" → dueDate tomorrow
  * "紧急" → priority 1
  * "未完成" → status "open"

**Verification:**
```javascript
[Query Parser] Parsed query: {
  "keywords": ["任务"],
  "priority": 1,
  "status": "open",
  "dueDate": "tomorrow", // or specific date
  "aiUnderstanding": {
    "detectedLanguage": "zh"
  }
}
```

**Pass Criteria:**
- ✅ All properties recognized in Chinese
- ✅ Correct mappings
- ✅ Tasks filtered correctly

---

#### **Test 4.3: Swedish Query**

**Query**: `pågående arbete`

**Expected Behavior:**
- "pågående" → status "inprogress"
- Returns in-progress tasks

**Verification:**
```javascript
[Query Parser] Parsed query: {
  "keywords": ["arbete"],
  "status": "inprogress",
  "aiUnderstanding": {
    "detectedLanguage": "sv"
  }
}
```

**Pass Criteria:**
- ✅ Swedish understood
- ✅ Status mapped correctly
- ✅ Language detected

---

### **Step 5: Test Property Recognition Variations**

#### **Test 5.1: Status Variations**

Test these queries and verify status mapping:

| Query | Expected Status |
|-------|----------------|
| "open tasks" | "open" |
| "things I'm working on" | "inprogress" |
| "finished items" | "completed" |
| "blocked tasks" | "?" |
| "cancelled work" | "cancelled" |

---

#### **Test 5.2: Priority Variations**

Test these queries and verify priority mapping:

| Query | Expected Priority |
|-------|------------------|
| "urgent tasks" | 1 |
| "critical work" | 1 |
| "high priority items" | 1 or 2 |
| "medium priority" | 2 or 3 |
| "low priority tasks" | 3 or 4 |

---

#### **Test 5.3: Due Date Variations**

Test these queries and verify due date:

| Query | Expected Due Date |
|-------|------------------|
| "tasks due today" | today's date |
| "due tomorrow" | tomorrow's date |
| "overdue tasks" | "overdue" |
| "tasks without deadline" | "no date" |

---

### **Step 6: Test Dynamic Language Generation**

#### **Test 6.1: Verify Your Languages**

1. Go to Settings → Query Languages
2. Note your configured languages
3. Test a query in each language
4. Verify AI understands ALL your languages

**Example** (if you have `["English", "中文", "Svenska"]`):
- Test in English: `urgent tasks` ✅
- Test in Chinese: `紧急任务` ✅
- Test in Swedish: `brådskande uppgifter` ✅

---

#### **Test 6.2: Add a New Language**

1. Add a new language to settings (e.g., "German")
2. Save settings
3. Restart plugin or reload Obsidian
4. Test query in new language: `dringende Aufgaben`
5. Verify AI understands the new language

**Expected**: AI should generate German examples in prompt and understand German queries!

---

## ✅ **Success Checklist**

### **Natural Language Understanding**
- [ ] Simple status queries work ("open tasks")
- [ ] Priority recognition works ("urgent tasks")
- [ ] Combined properties work ("urgent open overdue")
- [ ] Natural language status works ("working on")
- [ ] Semantic mappings logged in aiUnderstanding

### **Typo Correction**
- [ ] Single typos corrected ("urgant" → "urgent")
- [ ] Multiple typos corrected (4+ corrections)
- [ ] Corrections logged in aiUnderstanding.correctedTypos
- [ ] Query still parsed correctly after correction

### **Multilingual Support**
- [ ] Chinese queries work
- [ ] Swedish queries work  
- [ ] Other configured languages work
- [ ] Language detected in aiUnderstanding
- [ ] Properties recognized across languages

### **Property Recognition**
- [ ] Status variations recognized (6+ variations)
- [ ] Priority variations recognized (5+ variations)
- [ ] Due date variations recognized (4+ variations)
- [ ] Semantic mappings correct

### **Dynamic Language Generation**
- [ ] AI adapts to settings.queryLanguages
- [ ] New languages work when added
- [ ] No hardcoded language limitations
- [ ] Falls back gracefully for unknown languages

### **Interface & Metadata**
- [ ] ParsedQuery has aiUnderstanding field
- [ ] detectedLanguage populated
- [ ] correctedTypos array populated
- [ ] semanticMappings object populated
- [ ] confidence score present (0-1)
- [ ] naturalLanguageUsed boolean set

---

## 🐛 **Troubleshooting**

### **Issue: AI Not Parsing Query**

**Symptoms**: Query returns no results or wrong results

**Solutions**:
1. Check mode: Must be Smart Search or Task Chat (not Simple Search)
2. Verify API key is valid
3. Check console for errors
4. Verify semantic expansion is enabled
5. Test with exact syntax first: `s:open & p1`

---

### **Issue: Language Not Recognized**

**Symptoms**: Query in non-English not understood

**Solutions**:
1. Check settings.queryLanguages array
2. Use English language names: "Chinese" not "中文"
3. Spelling matters: "Swedish" not "Svenska"
4. Reload plugin after changing languages
5. Test with English first to verify AI is working

---

### **Issue: Typos Not Corrected**

**Symptoms**: Typo remains, query fails

**Solutions**:
1. Verify AI provider is responding
2. Check console for parsing errors
3. Test with obvious typo: "urgant"
4. Verify prompt includes typo correction section
5. Check temperature setting (0.7 recommended)

---

### **Issue: Properties Not Recognized**

**Symptoms**: Natural language doesn't map to properties

**Solutions**:
1. Verify query is natural enough ("urgent" not "u r g e n t")
2. Check console for semantic mappings
3. Test with explicit syntax: `p:1` instead of "urgent"
4. Verify property mappings in prompt
5. Check AI model (some models better than others)

---

### **Issue: No aiUnderstanding Metadata**

**Symptoms**: Parsed query missing aiUnderstanding field

**Solutions**:
1. Verify you're using Smart Search or Task Chat (not Simple)
2. Check that AI parsing is enabled
3. Verify build version (278.2kb or later)
4. Look for console errors during parsing
5. Test with a fresh reload

---

## 📊 **Expected Results**

After successful testing, you should see:

✅ **21/21 test cases passing**
- 5 natural language tests
- 5 multilingual tests
- 5 typo correction tests
- 6 property recognition tests

✅ **Console logs show:**
- Parsed queries with all fields
- aiUnderstanding metadata present
- Semantic mappings logged
- Language detected
- Typos corrected

✅ **User experience:**
- Can type naturally instead of syntax
- Typos automatically corrected
- Works in any configured language
- Properties recognized from natural language
- Queries feel intuitive and forgiving

---

## 🚀 **Next Steps**

After Phase 1 testing complete:

1. **Document Results**
   - Note any issues or failures
   - Record accuracy percentages
   - Log any unexpected behavior

2. **Proceed to Phase 2**
   - Implement settings UI
   - Add enable/disable toggles
   - Add confidence threshold slider

3. **Proceed to Phase 3**
   - Add AI understanding display (Task Chat)
   - Show typo corrections to user
   - Display confidence indicator

4. **Proceed to Phase 4**
   - Comprehensive testing
   - Performance optimization
   - Documentation finalization

---

## 📚 **References**

- **Implementation Plan**: `docs/dev/AI_NLU_IMPLEMENTATION_PHASES.md`
- **Test Cases**: `docs/dev/unified-query-system/test-scripts/ai-nlu-test-cases.md`
- **Test Script**: `docs/dev/unified-query-system/test-scripts/phase1-nlu-test.js`
- **README**: Section "🤖 AI-Enhanced Natural Language Queries"

---

**Happy Testing! 🎉**

Report any issues or unexpected behavior for investigation.
