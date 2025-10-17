# System Prompt Architecture

**Date:** 2024-10-17  
**Status:** ✅ Implemented  
**Build:** ✅ Success (115.9kb)

## Overview

Complete explanation of how the system prompt works, how user customization interacts with technical instructions, and how to manage it in the settings UI.

---

## 🏗️ Architecture

### **How the System Prompt is Built**

**Code location:** `aiService.ts` line 869-910

```typescript
// Step 1: Start with user's custom prompt (BASE)
let systemPrompt = settings.systemPrompt;

// Step 2: Append technical instructions (ENHANCEMENTS)
systemPrompt += `
⚠️ CRITICAL: ONLY DISCUSS ACTUAL TASKS...
IMPORTANT RULES: 1-10...
[Priority mapping]
[Date formats]
[Status mapping]
[Recommendation limits]
[Sort order]
[Task context]
`;
```

### **Two-Layer Design**

| Layer | Source | Purpose | User Control |
|-------|--------|---------|--------------|
| **Base Layer** | `settings.systemPrompt` | Sets AI's personality, tone, style | ✅ Full control |
| **Enhancement Layer** | Hardcoded technical instructions | Ensures task management behavior | ❌ Automatic |

---

## 🎯 How It Works (No Overriding!)

### **User's Prompt = Personality/Style**

The user's `systemPrompt` sets the **general behavior**:

**Examples:**
```
"Be extremely brief. Focus only on deadlines."
"Be friendly and encouraging. Explain your reasoning."
"Respond in bullet points. No explanations."
```

### **Technical Instructions = Task Management Specifics**

The appended instructions ensure **correct task handling**:
- How to reference tasks ([TASK_X] format)
- What not to do (don't create new tasks)
- How to interpret priorities, dates, status
- How many recommendations to give
- What order tasks are in

### **Result: Additive, Not Overriding**

**User sets:** "Be brief."  
**AI receives:**
```
Be brief.

⚠️ CRITICAL: ONLY DISCUSS ACTUAL TASKS...
[Technical instructions]
```

**Effect:**
- ✅ AI is brief (follows user's style)
- ✅ AI handles tasks correctly (follows technical rules)
- ✅ Both goals achieved!

---

## 📝 Default System Prompt

### **New Default** (Updated 2024-10-17)

```
"You are a task management assistant for Obsidian. Your role is to help users find, prioritize, and manage their EXISTING tasks."
```

**Why this is the default:**
1. ✅ Simple and clear
2. ✅ Sets task management context
3. ✅ Emphasizes EXISTING tasks (not creating new ones)
4. ✅ Not redundant with technical instructions
5. ✅ Proven to work well

### **Old Default** (Before update)

```
"You are a task assistant for Obsidian. Focus ONLY on existing tasks from the vault. Do not create new content or provide generic advice. Help users find, prioritize, and manage their actual tasks. Reference tasks using [TASK_X] IDs. Be concise and actionable."
```

**Why it was changed:**
- ❌ Too detailed (redundant with technical instructions)
- ❌ Included implementation details ([TASK_X] format)
- ❌ Longer than necessary for base behavior

---

## 🔄 Reset Button Feature

### **What Was Added**

**Location:** Settings → Advanced → System prompt

**Features:**
1. ✅ "Reset to default" button
2. ✅ Tooltip explaining what it does
3. ✅ Shows default prompt in description
4. ✅ Refreshes UI after reset
5. ✅ Shows success notice

### **User Flow**

**Before customization:**
```
[System prompt text area]
[Shows default: "You are a task management assistant..."]
[Reset to default button]
```

**After customization:**
```
[System prompt text area]
[Shows: "Be brief and focus on high-priority tasks only."]
[Reset to default button] ← Click this!
```

**After reset:**
```
[System prompt text area]
[Shows: "You are a task management assistant..."] ← Restored!
Notice: "System prompt reset to default"
```

---

## 🎨 Customization Examples

### **Example 1: Brief and Direct**

**User sets:**
```
systemPrompt: "Be extremely concise. Only list task IDs, no explanations."
```

**AI behavior:**
```
User: "What should I work on?"
AI: "[TASK_1] [TASK_3] [TASK_7]"
```

✅ Respects user's desire for brevity

---

### **Example 2: Friendly and Encouraging**

**User sets:**
```
systemPrompt: "You are a supportive task coach. Be encouraging and explain your reasoning. Help users feel confident about their priorities."
```

**AI behavior:**
```
User: "What should I work on?"
AI: "Great question! I'd recommend starting with [TASK_1] because it's overdue and high priority - getting this done will give you momentum. Then [TASK_3] since it's due today. You've got this!"
```

✅ Completely different personality!

---

### **Example 3: Focus-Specific**

**User sets:**
```
systemPrompt: "Focus ONLY on high-priority tasks. Ignore everything else. Be direct about what matters most."
```

**AI behavior:**
```
User: "Show me all my tasks"
AI: "Your high-priority items: [TASK_2] [TASK_5] [TASK_8]. Everything else can wait."
```

✅ AI filters through user's lens

---

## 🔍 Technical Details

### **Complete Prompt Structure**

```
[USER'S CUSTOM PROMPT]

⚠️ CRITICAL: ONLY DISCUSS ACTUAL TASKS FROM THE LIST ⚠️
[Warnings about not creating new tasks]

CRITICAL: DO NOT LIST TASKS IN YOUR RESPONSE TEXT
[Instructions about task display]

IMPORTANT RULES:
1-10. [Core task management rules]

CRITICAL: HOW TO REFERENCE TASKS IN YOUR RESPONSE:
[Task reference format with examples]

METHODS TO REFERENCE TASKS:
[Concrete examples of task referencing]

WHAT USER SEES:
[Explanation of [TASK_X] → Task N conversion]

RESPONSE FORMAT:
[Requirements for response structure]

[LANGUAGE INSTRUCTION]
[PRIORITY MAPPING - user settings]
[DATE FORMATS - user settings]
[STATUS MAPPING - user settings]

RECOMMENDATION LIMITS:
[maxRecommendations from user settings]

QUERY UNDERSTANDING:
[Filter context]

TASK ORDERING (User-Configured):
[Sort order explanation based on user settings]

[TASK CONTEXT - actual tasks]
```

### **Variable Sections (User Settings)**

These sections **dynamically adapt** to user configuration:

| Section | Source | Example |
|---------|--------|---------|
| Language | `responseLanguage` | "Respond in English" |
| Priority | `dataviewPriorityMapping` | "HIGH (1): high, urgent, ⏫" |
| Date Formats | `dataviewKeys` | "[due::YYYY-MM-DD]" |
| Status | `taskStatusDisplayNames` | "Open: Todo tasks" |
| Limits | `maxRecommendations` | "Max 5 tasks" |
| Sort Order | `taskSortOrderChatAI` | "priority → dueDate" |

---

## ⚠️ What NOT to Put in systemPrompt

### **Avoid Technical Details**

❌ **Don't include:**
```
"Reference tasks using [TASK_X] IDs"
"Do not create new tasks"
"Focus on existing tasks only"
"List up to 20 tasks"
```

**Why not?**
- These are **already in technical instructions**
- Redundant and wastes tokens
- Harder to maintain

### **Focus on Personality/Style**

✅ **Do include:**
```
"Be brief"
"Be encouraging"
"Focus on deadlines"
"Explain your reasoning"
"Use bullet points"
```

**Why?**
- Sets AI's **tone and behavior**
- Complements technical instructions
- Easy to customize

---

## 📊 Benefits of This Architecture

### **1. Separation of Concerns** ✅

- **User controls:** Personality, style, focus
- **System ensures:** Correct task management
- **No conflicts:** Both work together

### **2. Easy Customization** ✅

- Users don't need to know technical details
- Can experiment with different personalities
- Reset button if they want to go back

### **3. Maintainability** ✅

- Technical instructions in one place (code)
- User customization in settings
- Updates to technical layer don't affect users

### **4. Flexibility** ✅

- Same user can have different styles for different needs
- Can be brief for quick queries, detailed for planning
- AI adapts to user's workflow

---

## 🧪 Testing Scenarios

### **Test 1: Default Prompt**

**Config:** Default (not customized)

**Query:** "What should I focus on?"

**Expected:** Standard task management response with all technical features working

**Result:** ✅ Pass

---

### **Test 2: Brief Custom Prompt**

**Config:** `systemPrompt: "Be brief."`

**Query:** "What should I focus on?"

**Expected:** Very short response, still correctly formatted with [TASK_X] references

**Result:** ✅ Pass

---

### **Test 3: Reset Button**

**Steps:**
1. Customize prompt to "Be brief"
2. Use it (verify it works)
3. Click "Reset to default"
4. Verify prompt restored
5. Use it (verify default behavior)

**Expected:** Smooth reset with no errors

**Result:** ✅ Pass

---

## 📚 Documentation for Users

### **Settings Tab Description**

**Current text:**
```
"Customize the AI's base behavior and personality. This sets the tone and style - technical task management instructions are automatically appended. Default: 'You are a task management assistant for Obsidian. Your role is to help users find, prioritize, and manage their EXISTING tasks.'"
```

**Key points communicated:**
1. ✅ Purpose: Customize behavior/personality
2. ✅ Scope: Sets tone and style
3. ✅ Technical layer: Automatically appended
4. ✅ Default: Shows the default prompt

---

## 🎯 Best Practices

### **For Users**

**DO:**
- ✅ Set overall tone ("Be brief", "Be friendly")
- ✅ Set focus areas ("Focus on deadlines", "Prioritize by importance")
- ✅ Set response style ("Use bullet points", "Explain reasoning")

**DON'T:**
- ❌ Include task reference format ([TASK_X])
- ❌ Include technical rules (already covered)
- ❌ Make it too long (wastes tokens)

### **For Developers**

**Maintaining the Technical Layer:**
- Keep it in one place (buildMessages method)
- Document why each section is there
- Update when task management logic changes
- Don't duplicate what's in user's prompt

**Maintaining the Default:**
- Keep it simple and general
- Focus on task management context
- Avoid implementation details
- Test with and without customization

---

## 🔮 Future Enhancements

### **Potential Additions**

1. **Prompt Templates**
   ```
   [Brief Mode] "Be extremely concise"
   [Friendly Mode] "Be supportive and encouraging"
   [Focus Mode] "Prioritize by importance"
   ```

2. **Prompt Preview**
   - Show final assembled prompt in settings
   - Help users understand what AI sees

3. **Per-Mode Prompts**
   - Different prompts for Simple/Smart/Chat modes
   - More granular control

4. **Community Prompts**
   - Share successful prompts
   - Import/export functionality

---

## 📝 Summary

### **Key Points**

1. ✅ User's systemPrompt = Personality/style (BASE)
2. ✅ Technical instructions = Task management (APPENDED)
3. ✅ No overriding - both work together
4. ✅ Default updated to proven, simple version
5. ✅ Reset button added to settings
6. ✅ Clear documentation in UI

### **User Benefits**

- Full control over AI personality
- Easy to customize without technical knowledge
- Reset button for safety
- Technical correctness guaranteed

### **Developer Benefits**

- Clean separation of concerns
- Easy to maintain technical layer
- User customization doesn't break functionality
- Clear architecture

**Build:** ✅ Success (115.9kb)  
**User Impact:** ✅ Empowered customization with safety net
