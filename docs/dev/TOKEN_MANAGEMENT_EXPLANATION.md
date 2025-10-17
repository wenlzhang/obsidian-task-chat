# Token Management in Task Chat

**Date:** 2024-10-17  
**Purpose:** Comprehensive explanation of input/output tokens and how Task Chat manages them

---

## Understanding Tokens

### What are Tokens?

**Tokens** are the basic units that AI models process. Think of them as "pieces of text":
- 1 token ≈ 4 characters in English
- 1 token ≈ 1-2 characters in Chinese
- 100 tokens ≈ 75 words in English

**Examples:**
- `"Hello, world!"` ≈ 3 tokens
- `"Task management"` ≈ 2 tokens
- `"开发插件"` ≈ 4-6 tokens

---

## Input vs Output Tokens

### Input Tokens (What You Send)

**Definition:** Tokens in the request sent to the AI

**Includes:**
- System prompt
- Chat history
- Your query
- Task context
- All instructions

**Example:**
```
System: "You are a task assistant..." (50 tokens)
History: Previous messages (200 tokens)
Query: "Show me urgent tasks" (5 tokens)
Tasks: [Task 1, Task 2, ...] (500 tokens)
────────────────────────────────────────
Total INPUT: 755 tokens
```

**Who controls it:** You (via message length, task count, history)

---

### Output Tokens (What AI Returns)

**Definition:** Tokens in the AI's response

**Includes:**
- AI's analysis
- Recommendations
- Explanations
- JSON responses

**Example:**
```
AI response: "Here are your urgent tasks:
1. Task X - Due today
2. Task Y - Priority high
..." (300 tokens)
────────────────────────────────────
Total OUTPUT: 300 tokens
```

**Who controls it:** `max_tokens` parameter!

---

## The `max_tokens` Parameter

### What It Does

**`max_tokens` = Maximum OUTPUT tokens the AI can generate**

**Important:**
- ✅ Controls response length (output)
- ❌ Does NOT control input length
- ✅ Prevents runaway token usage
- ✅ Ensures responses fit your needs

### Why It Matters

**Too Low:**
- Response truncated mid-sentence ❌
- Incomplete JSON ❌
- Poor user experience ❌

**Too High:**
- Higher cost 💰
- Slower responses 🐌
- Unnecessary verbosity 📝

**Just Right:**
- Complete responses ✅
- Optimal cost ✅
- Good speed ✅

---

## Task Chat's Token Usage

### Three AI Calls

Task Chat makes AI calls in different contexts:

#### 1. **Query Parsing** (Smart Search & Task Chat modes)

**Purpose:** Extract keywords and filters from user query

**Input tokens:** ~100-200
- User query
- Parsing instructions
- Language settings
- Examples

**Output tokens:** ~500-800 (with semantic expansion)
- Core keywords array
- Expanded keywords array (60+ keywords)
- Filters (priority, due date, etc.)
- Structured JSON

**Why output needs 1000:**
- With 3 languages × 5 expansions = 15 per keyword
- 4 keywords × 15 = 60 keywords
- JSON structure + keywords = ~600 tokens
- Buffer for safety = 1000 total

**Old setting:** 200 ❌ (caused truncation)
**New setting:** 1000 ✅ (works perfectly)

---

#### 2. **Task Chat Analysis** (Task Chat mode only)

**Purpose:** Analyze tasks and provide recommendations

**Input tokens:** ~1000-2000
- System prompt
- Query
- Task context (up to 30 tasks)
- Instructions

**Output tokens:** ~500-1500
- Analysis
- Recommendations
- Explanations
- Task IDs

**Current setting:** 1000

**Considerations:**
- More = better explanations
- Less = more concise
- 1000 = good balance

---

#### 3. **Connection Testing** (Settings page)

**Purpose:** Verify API key works

**Input tokens:** ~20
- Model name
- Simple test message

**Output tokens:** ~10
- "test" or similar response

**Current setting:** 10 (perfect)

---

## Why 200 Worked Before

**Good question!** Here's why:

### Old System (Before Semantic Expansion Fix)

**Keywords generated:** 10-20 total
- Query: "fix bug"
- Keywords: ["fix", "repair", "bug", "error", ...] ≈ 10-15 keywords

**JSON response size:**
```json
{
  "coreKeywords": ["fix", "bug"],
  "keywords": ["fix", "repair", "solve", "bug", "error", "issue", "defect"]
}
```
**Tokens:** ~100-150 ✅ (fits in 200)

### New System (With Semantic Expansion)

**Keywords generated:** 60 total
- Query: "开发 plugin för Task Chat"
- Keywords: 4 core × 15 expansions = 60 keywords

**JSON response size:**
```json
{
  "coreKeywords": ["开发", "plugin", "Task", "Chat"],
  "keywords": [
    "开发", "develop", "build", "create", "implement",
    "开发", "构建", "创建", "编程", "制作",
    "utveckla", "bygga", "skapa", "programmera", "implementera",
    "plugin", "add-on", "extension", "module", "component",
    "插件", "附加组件", "扩展", "模块", "部件",
    "plugin", "tillägg", "utvidgning", "modul", "komponent",
    "Task", "task", "work", "item", "assignment",
    "任务", "工作", "事项", "项目", "作业",
    "uppgift", "arbete", "göra", "uppdrag", "ärende",
    "Chat", "chat", "conversation", "talk", "discussion",
    "聊天", "对话", "交流", "谈话", "沟通",
    "chatt", "konversation", "prata", "diskussion", "samtal"
  ]
}
```
**Tokens:** ~600 ❌ (exceeds 200!)

**Result:** Response truncated → JSON parse error → System broken

---

## Hardcoded vs User-Configurable

### Current State

**Hardcoded (Not configurable):**
- Query parsing: `max_tokens: 1000`
- Task Chat analysis: `max_tokens: 1000`  
- Temperature: `0.1` (query parsing)

**Already Configurable:**
- Temperature: `settings.temperature` (Task Chat analysis)

### Why Some Are Hardcoded

**Query Parsing:**
- **Needs consistency** - Must return valid JSON
- **Predictable output** - Always same structure
- **Technical requirement** - 1000 needed for 60 keywords
- **Not user-facing** - Internal operation

**Temperature 0.1 for parsing:**
- **Deterministic** - Same query → same keywords
- **Reliable** - No creative variations
- **JSON safety** - Consistent format

**Analogy:** Like compiler settings - users don't need to configure

### What SHOULD Be Configurable

**Task Chat Analysis:**
- **max_tokens** - Users want different response lengths
  - Short answers (300)
  - Medium (1000)
  - Detailed (2000)
- **temperature** - Already configurable! ✅
  - Consistent (0.1)
  - Balanced (0.5)
  - Creative (1.0)

---

## Proposed Settings Structure

### Add to PluginSettings

```typescript
// AI Response Settings
maxTokensChat: number; // Max tokens for Task Chat analysis responses (300-4000)
maxTokensQueryParser: number; // Max tokens for query parsing (fixed at 1000, not user-configurable)
```

### Defaults

```typescript
maxTokensChat: 1500, // Good balance for most users
maxTokensQueryParser: 1000, // Technical requirement, kept constant
```

### Settings UI

```typescript
new Setting(containerEl)
    .setName("Max response length")
    .setDesc(
        "Maximum length of AI responses in Task Chat mode (300-4000 tokens). " +
        "Higher = more detailed explanations but slower and more expensive. " +
        "Lower = concise answers but may miss details. " +
        "Recommended: 1500 for balance, 2000 for detail, 1000 for speed."
    )
    .addSlider((slider) =>
        slider
            .setLimits(300, 4000, 100)
            .setValue(this.plugin.settings.maxTokensChat)
            .setDynamicTooltip()
            .onChange(async (value) => {
                this.plugin.settings.maxTokensChat = value;
                await this.plugin.saveSettings();
            })
    );
```

---

## Cost Implications

### Token Costs (Example: gpt-4o-mini)

**Pricing:**
- Input: $0.15 per 1M tokens
- Output: $0.60 per 1M tokens

**Example query:**
```
Input: 1000 tokens = $0.00015
Output (max 1500): ~1000 actual = $0.00060
──────────────────────────────────────
Total per query: ~$0.00075
```

**Monthly (50 queries/day):**
- Daily: $0.0375
- Monthly: $1.125

**With different max_tokens settings:**
- max_tokens 500: ~$0.75/month
- max_tokens 1500: ~$1.13/month
- max_tokens 3000: ~$1.50/month

**Difference:** ~$0.75/month between settings

---

## Best Practices

### For Query Parsing
- **Keep at 1000** - Technical requirement
- **Don't expose to users** - Internal operation
- **Temperature 0.1** - Consistency needed

### For Task Chat Analysis
- **Let users configure** - Personal preference
- **Provide guidance** - Explain trade-offs
- **Smart defaults** - 1500 for most users
- **Show cost impact** - Help users decide

### For Temperature
- **Already configurable** - Good! ✅
- **Add context help** - Explain what it does
- **Separate for different calls** - Parsing (0.1) vs Chat (user choice)

---

## Summary Table

| Feature | Input Tokens | Output Tokens | User Control |
|---------|--------------|---------------|--------------|
| **Query Parsing** | ~100-200 | ~500-800 | ❌ Keep fixed |
| **Task Chat** | ~1000-2000 | ~500-1500 | ✅ Should configure |
| **Temperature** | N/A | Affects variety | ✅ Already configurable |

---

## Recommendations

### Implement

1. ✅ Add `maxTokensChat` to settings
2. ✅ Keep `maxTokensQueryParser` fixed at 1000
3. ✅ Add UI slider with explanation
4. ✅ Show cost implications
5. ✅ Respect user settings in aiService.ts

### Don't Implement

1. ❌ User control of query parsing tokens
2. ❌ User control of query parsing temperature
3. ❌ Complex token management UI

### Why Keep Some Fixed

**Query parsing is like:**
- Compiler settings
- Database connection parameters
- Network protocols

**Users don't need to configure technical internals!**

**Task Chat is like:**
- Editor preferences
- Display settings
- Response style

**Users DO need to configure user-facing features!**

---

## Implementation Plan

1. Add `maxTokensChat` to settings interface
2. Update aiService.ts to use `settings.maxTokensChat`
3. Add slider in settingsTab.ts with helpful description
4. Document cost implications
5. Keep query parser tokens fixed

**Result:** Users can control what matters, technical settings stay optimized!

---

## Conclusion

**Input tokens:** What you send (controlled by content)  
**Output tokens:** What AI returns (controlled by `max_tokens`)  
**200 worked before:** Fewer keywords (10-20)  
**1000 needed now:** More keywords (60)  
**User configuration:** Yes for Task Chat, No for query parsing  
**Temperature:** Already configurable ✅

**Next:** Implement user-configurable `maxTokensChat` setting!
