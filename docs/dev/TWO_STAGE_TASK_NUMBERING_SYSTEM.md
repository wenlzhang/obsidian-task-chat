# Two-Stage Task Numbering System

## User's Insight (2025-01-19)

The user correctly identified that the prompt was mixing two separate stages:
1. **AI Context Stage**: How tasks are numbered when sent to AI
2. **Display Stage**: How tasks are numbered in the recommended list UI

This mixing created confusion for both the AI and humans reviewing the prompt.

## The Two Stages Explained

### Stage 1: AI Context (Internal Processing)

**Purpose**: Provide AI with sorted, numbered tasks for analysis

**Process**:
```typescript
// Send top 50 sorted tasks to AI
const tasksToAnalyze = sortedTasks.slice(0, 50);

// Build context with sequential IDs
[TASK_1]: "Highest priority task..." (1st in sorted list)
[TASK_2]: "Second priority task..." (2nd in sorted list)
...
[TASK_15]: "15th priority task..." (15th in sorted list)
[TASK_42]: "42nd priority task..." (42nd in sorted list)
...
[TASK_50]: "50th priority task..." (50th in sorted list)
```

**AI's Job**:
- Analyze these 50 tasks
- Select relevant ones using their [TASK_X] IDs
- Reference selected tasks in response: "[TASK_15], [TASK_42], [TASK_3]..."

**Key Point**: AI only needs to know about [TASK_X] format. It doesn't need to know about Stage 2.

### Stage 2: Display (User Interface)

**Purpose**: Show user a clean, sequential list of recommended tasks

**Process**:
```typescript
// AI recommended: [TASK_15], [TASK_42], [TASK_3], [TASK_5], [TASK_26], [TASK_6]

// Extract these tasks (in mention order)
recommended = [
    tasks[14],  // TASK_15 (first mentioned)
    tasks[41],  // TASK_42 (second mentioned)
    tasks[2],   // TASK_3 (third mentioned)
    tasks[4],   // TASK_5 (fourth mentioned)
    tasks[25],  // TASK_26 (fifth mentioned)
    tasks[5],   // TASK_6 (sixth mentioned)
]

// Build mapping: original ID → display position
taskIdToPosition:
  15 → 1  (TASK_15 becomes Task 1)
  42 → 2  (TASK_42 becomes Task 2)
  3 → 3   (TASK_3 becomes Task 3)
  5 → 4   (TASK_5 becomes Task 4)
  26 → 5  (TASK_26 becomes Task 5)
  6 → 6   (TASK_6 becomes Task 6)

// Replace in AI response
"Start with [TASK_15], then [TASK_42]..."
→ "Start with Task 1, then Task 2..."
```

**User Sees**:
```
Summary: "Start with Task 1, then Task 2..."

Recommended tasks:
1. Highest priority task... (was TASK_15)
2. 42nd priority task...    (was TASK_42)
3. Third task...            (was TASK_3)
4. Fifth task...            (was TASK_5)
5. 26th task...             (was TASK_26)
6. Sixth task...            (was TASK_6)
```

**Key Point**: Users only see "Task 1, Task 2, Task 3..." They never see [TASK_X] format.

## Why Separation is Critical

### Problem: Mixing Both Stages in Prompt

**Old Prompt** (confusing):
```
Use [TASK_X] format...
System converts [TASK_X] → Task N...
Example: [TASK_15] → Task 1
User sees: Task 1, Task 2, Task 3...
```

**Issues**:
1. AI gets confused: "Should I use [TASK_X] or Task 1?"
2. AI might write "Task 1" thinking that's correct
3. Humans reviewing prompt get confused about two numbering systems
4. Makes it seem like AI needs to handle conversion (it doesn't!)

### Solution: Focus Only on Stage 1 in Prompt

**New Prompt** (clear):
```
Use [TASK_X] format with exact IDs from task list below.

EXAMPLES:
✅ CORRECT: "Start with [TASK_15], then [TASK_42]"
❌ WRONG: "Start with Task 1, then Task 2"
```

**Benefits**:
1. AI only needs to know: use [TASK_X] format
2. No mention of conversion (automatic, AI doesn't need to know)
3. Clear examples of what to do and what NOT to do
4. Simpler mental model for everyone

## Complete Data Flow

### Step 1: Filter & Sort (All Modes)
```
Query: "Fix urgent bugs"
→ Filter: 338 tasks with "fix" or "bug"
→ Score: Relevance + due date + priority
→ Sort: By total score (descending)
→ Result: sortedTasks[0] = highest priority
```

### Step 2: Build AI Context (Task Chat Only)
```typescript
// Take top 50 sorted tasks
const tasksToAnalyze = sortedTasks.slice(0, 50);

// Number them sequentially
const taskContext = tasksToAnalyze.map((task, index) => {
    return `[TASK_${index + 1}] ${task.text} ...metadata...`;
}).join('\n\n');

// Context shows:
[TASK_1]: "Fix critical login bug" (highest priority)
[TASK_2]: "Resolve database connection issue"
...
[TASK_50]: "Minor UI fix" (50th priority)
```

**Key**: Numbering is based on SORTED ORDER. Lower numbers = higher priority.

### Step 3: AI Analysis
```
Prompt: "Use [TASK_X] format from the list"

AI reads list, writes response:
"To fix urgent bugs, start with [TASK_1] which is critical. Then address [TASK_2] and [TASK_5]. Also consider [TASK_12], [TASK_15], and [TASK_18] for related issues."
```

**Key**: AI uses exact IDs from context. Doesn't know about Stage 2.

### Step 4: Extract Recommended Tasks
```typescript
// Parse AI response for [TASK_X] references
const mentioned = [1, 2, 5, 12, 15, 18];

// Extract in mention order
recommended = mentioned.map(id => tasksToAnalyze[id - 1]);
// [tasks[0], tasks[1], tasks[4], tasks[11], tasks[14], tasks[17]]
```

### Step 5: Map & Replace (Stage 2 Begins)
```typescript
// Build mapping: original ID → display position
taskIdToPosition = {
  1 → 1,   // TASK_1 → Task 1
  2 → 2,   // TASK_2 → Task 2
  5 → 3,   // TASK_5 → Task 3
  12 → 4,  // TASK_12 → Task 4
  15 → 5,  // TASK_15 → Task 5
  18 → 6,  // TASK_18 → Task 6
}

// Replace in response
response.replace(/\[TASK_(\d+)\]/g, (match, id) => {
    const position = taskIdToPosition.get(parseInt(id));
    return `Task ${position}`;
});

// Result:
"To fix urgent bugs, start with Task 1 which is critical. Then address Task 2 and Task 3. Also consider Task 4, Task 5, and Task 6 for related issues."
```

### Step 6: Display to User
```
Summary text:
"To fix urgent bugs, start with Task 1 which is critical..."

Recommended tasks list:
1. Fix critical login bug
2. Resolve database connection issue
3. [5th sorted task]
4. [12th sorted task]
5. [15th sorted task]
6. [18th sorted task]
```

**Key**: User sees clean sequential numbering (1, 2, 3...) that matches the summary text.

## Why This Works

### For AI:
- Simple instruction: "Use [TASK_X] format"
- No confusion about which format to use
- No need to understand conversion
- Just copy IDs from the provided list

### For Users:
- Clean sequential numbering: Task 1, Task 2, Task 3
- Numbers in summary match numbers in list
- Easy to reference: "I'll do Task 1 first"
- Professional appearance

### For System:
- Clear separation of concerns
- AI handles Stage 1 (analysis with [TASK_X])
- System handles Stage 2 (conversion to Task N)
- Easy to debug (can see both formats in logs)

## Prompt Design Principles

### DO (in prompt):
✅ Tell AI to use [TASK_X] format
✅ Show examples of [TASK_X] usage
✅ Show what NOT to do ("Task 1" is wrong)
✅ Keep instructions focused on AI's job

### DON'T (in prompt):
❌ Explain conversion process
❌ Mention "Task 1, Task 2" format
❌ Say "user sees" or "system converts"
❌ Mix Stage 1 and Stage 2 concerns

## Example Comparison

### Old Prompt (Mixed Stages - Confusing)
```
Use [TASK_X] format from the list below.
The system will convert [TASK_X] to "Task N" for users.

Example:
You write: "Start with [TASK_15], then [TASK_42]"
User sees: "Start with Task 1, then Task 2"
```

**Problems**:
- Mentions both [TASK_X] and Task N
- Explains conversion (AI doesn't need to know)
- AI might write "Task 1" thinking that's also correct

### New Prompt (Single Stage - Clear)
```
Use [TASK_X] format with exact IDs from the task list below.

EXAMPLES:
✅ CORRECT: "Start with [TASK_15], then [TASK_42]"
❌ WRONG: "Start with Task 1, then Task 2"
```

**Benefits**:
- Only mentions [TASK_X] format
- No mention of conversion
- Clear what to do and what NOT to do
- AI has no confusion

## Summary

**Two Stages**:
1. **AI Context** ([TASK_X]): Internal processing, AI analysis
2. **Display** (Task N): User interface, clean presentation

**Prompt Focus**:
- ONLY describe Stage 1
- Don't mention Stage 2 (automatic)
- Keep AI focused on its job

**Result**:
- Clear instructions for AI
- No confusion between stages
- Reliable [TASK_X] → Task N conversion
- Professional user experience

## Files Involved

**Stage 1 (AI Context)**:
- `aiService.ts`: Build context with [TASK_X] IDs
- `aiService.ts`: Send prompt telling AI to use [TASK_X]
- AI models: Generate response with [TASK_X] references

**Stage 2 (Display)**:
- `aiService.ts`: Extract [TASK_X] references
- `aiService.ts`: Build taskIdToPosition mapping  
- `aiService.ts`: Replace [TASK_X] → Task N
- `chatView.ts`: Display "Task N" to user

**Separation**: Stage 1 code doesn't know about "Task N", Stage 2 code doesn't appear in prompts.

## Status

✅ **IMPLEMENTED** - Prompt now focuses only on Stage 1
✅ **CLEAR** - No mention of conversion in prompt
✅ **SIMPLE** - AI just uses [TASK_X] format
✅ **RELIABLE** - Automatic Stage 2 conversion works correctly
