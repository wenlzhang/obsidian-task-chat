# Generic Question Mode UI & System Design - January 23, 2025

## User's Brilliant Idea

**Concept:** Add explicit UI control for generic question mode
- **Settings Tab:** Session default (all new queries)
- **Chat Interface:** Per-query toggle (override per query)
- **Two Modes:**
  - 🤖 **Auto Mode:** Detect automatically (threshold + AI)
  - 🔍 **Generic Mode:** Force generic handling
- **Threshold Control:** 50-90%, step 5%
- **Works for:** All three modes (Simple, Smart, Task Chat)

---

## 1. Settings Structure

### New Settings Fields

```typescript
export interface PluginSettings {
    // ... existing settings ...
    
    // Generic Question Detection (NEW)
    defaultGenericMode: "auto" | "generic"; // Session default
    currentGenericMode: "auto" | "generic"; // Current session (per-query override)
    vagueQueryThreshold: number; // 0.5-0.9, default: 0.7 (Auto mode only)
}

export const DEFAULT_SETTINGS: PluginSettings = {
    // ... existing defaults ...
    
    // Generic Question Detection
    defaultGenericMode: "auto", // Default: detect automatically
    currentGenericMode: "auto", // Resets to default on new session
    vagueQueryThreshold: 0.7, // 70% threshold for auto detection
};
```

---

## 2. Chat Interface UI Design

### Visual Layout

```
┌─────────────────────────────────────────────────────────┐
│  Task Chat                                          [X] │
├─────────────────────────────────────────────────────────┤
│                                                          │
│  Chat Mode: [Smart Search ▼]  Generic: [Auto ▼]        │
│                                                          │
│  Model: gpt-4o [▼]                                      │
│                                                          │
│  ┌────────────────────────────────────────────────┐    │
│  │ Type your query...                              │    │
│  └────────────────────────────────────────────────┘    │
│                                           [Send] [📎]   │
└─────────────────────────────────────────────────────────┘
```

### Dropdown Component

**Location:** Same row as Chat Mode selector (top)

**Options:**
```
Generic Question Mode
├─ 🤖 Auto (Detect automatically)
└─ 🔍 Generic (Force generic mode)
```

**Label:** "Generic:"

**Default:** Auto

**Behavior:**
- Persists during session
- Resets to `settings.defaultGenericMode` on new session
- Saves to `settings.currentGenericMode` on change

---

## 3. Settings Tab UI

### Section: Query Processing

```
┌─────────────────────────────────────────────────────────┐
│ Generic Question Detection                               │
│ ─────────────────────────────────────────────────────   │
│                                                          │
│ Default Mode: [Auto ▼]                                  │
│   ○ Auto - Detect automatically                         │
│      Uses threshold + AI to identify generic questions   │
│   ○ Generic - Always treat as generic                   │
│      Forces generic handling for all queries            │
│                                                          │
│ Detection Threshold (Auto Mode):  [70%] ━━━●━━━━        │
│   Range: 50-90% (step: 5%)                              │
│   Higher = Fewer queries classified as generic          │
│                                                          │
│ ℹ️ Override per-query using dropdown in chat interface  │
│                                                          │
│ 📖 Detailed explanation in README                       │
└─────────────────────────────────────────────────────────┘
```

### Dropdown Options

```typescript
new Setting(containerEl)
    .setName("Default generic question mode")
    .setDesc(
        "Choose how queries are interpreted by default:\n" +
        "• Auto: Detect automatically using threshold and AI\n" +
        "• Generic: Always treat queries as generic questions"
    )
    .addDropdown((dropdown) =>
        dropdown
            .addOption("auto", "Auto (Detect automatically)")
            .addOption("generic", "Generic (Force generic mode)")
            .setValue(this.plugin.settings.defaultGenericMode)
            .onChange(async (value: "auto" | "generic") => {
                this.plugin.settings.defaultGenericMode = value;
                this.plugin.settings.currentGenericMode = value; // Sync current
                await this.plugin.saveSettings();
            })
    );
```

### Threshold Slider

```typescript
new Setting(containerEl)
    .setName("Detection threshold (Auto Mode)")
    .setDesc(
        "Percentage of generic words to classify query as generic. " +
        "Range: 50-90%. Higher = fewer queries classified as generic. " +
        "Only applies in Auto mode."
    )
    .addSlider((slider) =>
        slider
            .setLimits(50, 90, 5) // 50-90%, step 5%
            .setValue(this.plugin.settings.vagueQueryThreshold * 100)
            .setDynamicTooltip()
            .onChange(async (value) => {
                this.plugin.settings.vagueQueryThreshold = value / 100;
                await this.plugin.saveSettings();
            })
    );
```

---

## 4. Mode Behavior Matrix

### Auto Mode (Default)

**Detection Process:**

1. **Simple Search Mode:**
   - Heuristic only (keyword-based 70% threshold)
   - Fast, no AI cost

2. **Smart Search Mode:**
   - AI detection (primary) → `isVague` field
   - Heuristic (fallback) → 70% threshold
   - AI takes priority if provided

3. **Task Chat Mode:**
   - Same as Smart Search for detection
   - AI uses `isVague` flag for response generation

**Threshold Applied:**
- Uses `settings.vagueQueryThreshold` (default: 0.7)
- Configurable: 50-90%

**Example Flow (Auto Mode):**
```
Query: "What should I do today?"

Simple Search:
  → Heuristic: 75% generic → isVague: true
  
Smart Search:
  → AI: isVague: true (primary)
  → Heuristic: 75% generic (fallback, not used)
  → Result: isVague: true
  
Task Chat:
  → AI: isVague: true
  → AI uses flag for response generation
```

---

### Generic Mode (Force Generic)

**Detection Process:**

1. **Simple Search Mode:**
   - Skip detection
   - Force `isVague: true`

2. **Smart Search Mode:**
   - Still call AI (for keywords/properties)
   - Override AI's `isVague` field
   - Force `isVague: true`

3. **Task Chat Mode:**
   - Same as Smart Search
   - AI receives `isVague: true`
   - AI knows user wants generic handling

**Threshold:**
- NOT applied (forced mode)
- Threshold ignored

**Example Flow (Generic Mode):**
```
Query: "Deploy API today"

All modes:
  → Force isVague: true
  → Skip keyword matching (vague handling)
  → Properties still extracted (priority, dueDate, etc.)
  → Time as context, not filter
  → Result: Broad results, AI analyzes
```

---

## 5. Workflow Integration

### Detection Logic (All Modes)

```typescript
// Check current mode
const genericMode = settings.currentGenericMode;

if (genericMode === "generic") {
    // Force generic handling
    isVague = true;
    console.log("[Generic Mode] Forced generic handling");
} else {
    // Auto mode: Detect automatically
    if (chatMode === "simple") {
        // Heuristic detection
        const vaguenessRatio = StopWords.calculateVaguenessRatio(rawKeywords);
        isVague = vaguenessRatio >= settings.vagueQueryThreshold;
    } else {
        // AI + heuristic
        const aiDetectedVague = parsed.isVague; // From AI
        const heuristicVague = StopWords.calculateVaguenessRatio(rawKeywords) >= settings.vagueQueryThreshold;
        isVague = aiDetectedVague !== undefined ? aiDetectedVague : heuristicVague;
    }
}
```

### Processing Differences

#### **Auto Mode + Vague Query:**
```
1. Detect vague (threshold + AI)
2. Extract properties
3. Time → context (if vague)
4. Skip keyword matching (if vague + properties)
5. Return broad results or filter by properties
```

#### **Generic Mode (Forced):**
```
1. Force isVague: true
2. Extract properties
3. Time → ALWAYS context (never filter!)
4. ALWAYS skip keyword matching
5. ALWAYS return broad results
6. AI ALWAYS provides recommendations
```

---

## 6. Time Handling Per Mode

### Auto Mode

**Time = Context:**
- Vague query: "今天可以做什么？" → timeContext: "today"

**Time = Filter:**
- Specific query: "Deploy API today" → dueDate: "today"

### Generic Mode

**Time = ALWAYS Context:**
- ANY query with time: "Deploy API today" → timeContext: "today"
- Never creates dueDate filter in Generic Mode
- AI uses timeContext for prioritization

**Rationale:**
User selected Generic Mode → Wants generic handling → Expects broad results

---

## 7. UI State Management

### Session Lifecycle

```
1. New Session Start:
   → currentGenericMode = settings.defaultGenericMode

2. User Changes Dropdown:
   → currentGenericMode = selected value
   → Persists for session

3. New Session (reload/reopen):
   → currentGenericMode = settings.defaultGenericMode (reset)

4. User Changes Default in Settings:
   → defaultGenericMode = new value
   → currentGenericMode = new value (sync)
   → Affects all future sessions
```

### Synchronization

**Chat Modal ← Settings:**
- On modal open: Read `settings.currentGenericMode`
- Populate dropdown with current value

**Chat Modal → Settings:**
- On dropdown change: Update `settings.currentGenericMode`
- Save settings immediately

**Settings Tab ← Chat Modal:**
- Settings UI shows `defaultGenericMode` (not current)
- Displays info: "Current session: Auto" (read-only)

---

## 8. Console Logging

### Auto Mode Logs

```
[Task Chat] Generic mode: Auto (threshold: 70%)
[Task Chat] Query analysis: 4 keywords, 75% generic
[Task Chat] Detection: isVague = true (AI-based)
[Task Chat] Strategy: Skip keyword matching, use properties
```

### Generic Mode Logs

```
[Task Chat] Generic mode: Generic (forced)
[Task Chat] Forcing generic handling (skip detection)
[Task Chat] Time context: "today" (never filter in Generic mode)
[Task Chat] Strategy: Return all tasks, AI provides recommendations
```

---

## 9. Benefits

### For All Users

**Explicit Control:**
- ✅ No guessing what system will do
- ✅ Choose interpretation method
- ✅ Override per query when needed

**Flexibility:**
- ✅ Default for most queries (Auto)
- ✅ Force generic for exploration
- ✅ Quick toggle, no settings diving

### For Power Users

**Predictable Behavior:**
- ✅ Know exactly what will happen
- ✅ Test different modes easily
- ✅ Fine-tune threshold

**Experimentation:**
- ✅ Compare Auto vs Generic
- ✅ See how detection works
- ✅ Optimize for their workflow

### For Specific Use Cases

**Exploration Mode (Generic):**
- User wants to see everything
- Brainstorming session
- Discovery, not filtering

**Precision Mode (Auto):**
- User wants relevant results
- Specific task lookup
- Efficiency, not breadth

---

## 10. README Documentation

### Section: Generic Question Detection

```markdown
## Generic Question Detection

The system can detect whether your query is a **generic question** 
(e.g., "What should I do?") or a **specific search** (e.g., "Fix authentication bug").

### Detection Modes

#### 🤖 Auto Mode (Default)

Automatically detects generic questions using:
- **Threshold:** Percentage of generic words (default: 70%)
- **AI Analysis:** Semantic understanding (Smart Search & Task Chat)
- **Heuristic:** Keyword-based detection (Simple Search)

**Example:**
- "What should I do?" → Generic (75% generic words)
- "Fix authentication bug" → Specific (0% generic words)

**When to use:**
- Most queries
- Want smart detection
- Trust system to choose

#### 🔍 Generic Mode (Force)

Forces all queries to be treated as generic questions.

**Behavior:**
- Skips keyword matching
- Time = context (never filter)
- Returns broad results
- AI provides recommendations

**When to use:**
- Exploration/brainstorming
- Want to see everything
- Override specific detection

### Configuration

**Per-Query (Chat Interface):**
Use dropdown at top of chat:
- Select "Auto" or "Generic"
- Persists during session
- Resets on new session

**Session Default (Settings Tab):**
Settings → Query Processing → Generic Question Detection
- Set default mode
- Adjust threshold (50-90%)
- Applies to all new sessions

### Examples

#### Auto Mode with Threshold 70%

**Generic (detected):**
- "What should I do today?" → 75% generic → Vague
- "今天可以做什么？" → 80% generic → Vague
- "What's urgent?" → 100% generic → Vague

**Specific (detected):**
- "Fix authentication bug" → 0% generic → Specific
- "Deploy API today" → 33% generic → Specific
- "今天 API 项目应该做什么？" → 50% generic → Specific

#### Generic Mode (forced)

**All queries treated as generic:**
- "Fix authentication bug" → Forced vague → Broad results
- "Deploy API today" → Forced vague + timeContext
- Any query → Generic handling

### Time Context Handling

**Auto Mode:**
- Generic query + time: "今天可以做什么？" → timeContext: "today"
- Specific query + time: "Deploy API today" → dueDate: "today"

**Generic Mode:**
- ANY query + time → ALWAYS timeContext (never filter)
- "Deploy API today" → timeContext: "today"

### Threshold Tuning

**Higher threshold (80-90%):**
- Fewer queries classified as generic
- More specific matching
- Better for precision

**Lower threshold (50-60%):**
- More queries classified as generic
- Broader results
- Better for exploration

**Default (70%):**
- Balanced for most users
- Good accuracy
- Works well multilingual

### Mode Comparison

| Aspect | Auto Mode | Generic Mode |
|--------|-----------|--------------|
| **Detection** | Threshold + AI | Forced |
| **Keyword matching** | Conditional | Never |
| **Time handling** | Context vs filter | Always context |
| **Results** | Relevant | Broad |
| **Use case** | Daily use | Exploration |
```

---

## 11. Implementation Files

### Files to Modify

1. **settings.ts** (+10 lines)
   - Add 3 new settings fields
   - Add to defaults

2. **TaskChatModal.tsx** or main.ts (+80 lines)
   - Add Generic Mode dropdown
   - Sync with settings
   - Handle per-query changes

3. **settingsTab.ts** (+60 lines)
   - Add Generic Mode section
   - Dropdown for default mode
   - Slider for threshold

4. **aiQueryParserService.ts** (+30 lines)
   - Check `currentGenericMode`
   - Force `isVague` if Generic mode
   - Pass `vagueQueryThreshold` to detection

5. **taskSearchService.ts** (+20 lines)
   - Check `currentGenericMode` in Simple mode
   - Force `isVague` if Generic mode

6. **aiService.ts** (+15 lines)
   - Log current mode
   - Handle Generic mode specifics

7. **README.md** (+150 lines)
   - Complete Generic Mode section
   - Examples and configuration
   - Mode comparison table

---

## 12. Testing Scenarios

### Scenario 1: Auto Mode → Generic Query

```
Settings:
- defaultGenericMode: "auto"
- vagueQueryThreshold: 0.7

Chat:
- Generic dropdown: "Auto"
- Query: "What should I do today?"

Expected:
✅ Detects as vague (75% > 70%)
✅ timeContext: "today"
✅ Skip keyword matching
✅ Return all tasks
```

### Scenario 2: Generic Mode → Specific Query

```
Settings:
- defaultGenericMode: "auto"
- currentGenericMode: "generic" (user changed)

Chat:
- Generic dropdown: "Generic"
- Query: "Deploy API today"

Expected:
✅ Force isVague: true
✅ timeContext: "today" (NOT dueDate!)
✅ Skip keyword matching
✅ Return all tasks
✅ AI provides recommendations
```

### Scenario 3: Auto Mode → Mixed Query

```
Settings:
- defaultGenericMode: "auto"
- vagueQueryThreshold: 0.7

Chat:
- Generic dropdown: "Auto"
- Query: "今天 API 项目应该做什么？"

Expected:
✅ Detects as specific (50% < 70%)
✅ Keywords: ["API", "项目"]
✅ timeContext: "today"
✅ Semantic expansion YES
✅ Filter by expanded keywords
```

### Scenario 4: New Session Reset

```
Session 1:
- User changes dropdown to "Generic"
- currentGenericMode: "generic"

Close/Reopen:

Session 2:
- currentGenericMode resets to "auto" (default)
- Dropdown shows "Auto"
- User must re-select if wants Generic
```

---

## 13. Summary

**Complete System:**
- ✅ Two-level control (Settings + Chat)
- ✅ Two modes (Auto, Generic)
- ✅ Threshold configuration (50-90%)
- ✅ Works all modes (Simple, Smart, Chat)
- ✅ Session persistence
- ✅ Comprehensive logging
- ✅ Full documentation

**User Benefits:**
- ✅ Explicit control over interpretation
- ✅ Per-query override flexibility
- ✅ Predictable behavior
- ✅ Easy experimentation

**Implementation:**
- ~265 lines of code
- ~150 lines of documentation
- ~10 files modified
- Zero breaking changes

**Ready for implementation!** 🚀
