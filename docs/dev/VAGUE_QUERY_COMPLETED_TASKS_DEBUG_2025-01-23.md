# Vague Query Completed Tasks - Deep Debug Analysis
## January 23, 2025

## **Problem Report**

User query: **"What should I do today?"**

**Results:**
- 880 tasks returned
- Most are COMPLETED ❌
- Only 1 open task (has no due date)
- User set overdue coefficient to 0, still gets completed tasks

---

## **Root Cause Investigation**

### **Step 1: Check DataView Filtering**

From console logs:
```
[Simple Search] Extracted properties: {status: 'none', ...}
[Task Chat] Task-level filtering complete: 880 tasks matched
```

**Analysis:**
- `status: 'none'` means **NO status filter applied**
- DataView returns **ALL 880 tasks** (open + completed + cancelled + everything)
- This is the ROOT CAUSE!

**Why no status filter?**

Simple Search regex doesn't extract status from vague queries:
```
Query: "What should I do today?"
→ No status keywords detected
→ extractedStatus = null
→ DataView filter: NONE
→ Result: All tasks returned
```

---

### **Step 2: Check Scoring Logic**

Even with 880 mixed tasks, scoring should prioritize open tasks. Let's check:

**Vague query characteristics:**
- No keywords → `relevanceScore = 0` for all tasks
- DueDate range: "today" (≤ today, includes overdue)
- No status filter → All status types included

**Score calculation:**
```typescript
finalScore = 
    relevanceScore × relevCoeff × relevanceCoefficient +
    dueDateScore × dateCoeff × dueDateCoefficient +
    priorityScore × priorCoeff × priorityCoefficient +
    statusScore × statusCoeff × statusCoefficient
```

**For vague query "What should I do today?":**

**Relevance component:**
- No keywords → `relevanceCoefficient = 0` ✅
- `relevanceScore × 20 × 0 = 0` ✅

**DueDate component:**
- Query has dueDate ("today") → `dueDateCoefficient = 1.0` ✅
- User set coefficient = 0 → `dateCoeff = 0` ✅
- `dueDateScore × 0 × 1.0 = 0` ✅

**Priority component:**
- No priority in query → Check sort order
- If priority in sort → `priorityCoefficient = 1.0`
- Default `priorCoeff = 1`
- `priorityScore × 1 × 1.0 = priorityScore`

**Status component:**
- No status in query → Check sort order
- If status in sort → `statusCoefficient = 1.0`
- Default `statusCoeff = 1`
- `statusScore × 1 × 1.0 = statusScore`

---

### **Step 3: Actual Scores**

**Completed task (finished yesterday, P1):**
```
relevanceScore: 0 (no keywords)
dueDateScore: 1.5 (was yesterday - overdue)
priorityScore: 1.0 (P1)
statusScore: 0.2 (completed)

Final = (0 × 20 × 0) + (1.5 × 0 × 1.0) + (1.0 × 1 × 1.0) + (0.2 × 1 × 1.0)
     = 0 + 0 + 1.0 + 0.2
     = 1.2 points
```

**Open task (no date, no priority):**
```
relevanceScore: 0 (no keywords)
dueDateScore: 0.1 (no date)
priorityScore: 0.1 (no priority)
statusScore: 1.0 (open)

Final = (0 × 20 × 0) + (0.1 × 0 × 1.0) + (0.1 × 1 × 1.0) + (1.0 × 1 × 1.0)
     = 0 + 0 + 0.1 + 1.0
     = 1.1 points
```

**Result:** Completed P1 task (1.2) ranks HIGHER than open task with no priority (1.1)!

---

### **Step 4: Why User's Fix Didn't Work**

**User said:** "I set the coefficient for overdue tasks to zero"

**What happened:**
- `dueDateCoefficient = 0` → DueDate component = 0 ✅
- BUT priority and status components STILL ACTIVE!
- Completed tasks still score from: `priorityScore + statusScore`

**Example with dueDate = 0:**

**Completed P1:**
```
Final = 0 + 0 + (1.0 × 1) + (0.2 × 1) = 1.2
```

**Open no-priority:**
```
Final = 0 + 0 + (0.1 × 1) + (1.0 × 1) = 1.1
```

Still the same! Completed P1 still wins!

---

## **THE REAL PROBLEMS**

### **Problem #1: No Status Filtering** ⚠️

**Current:**
- Vague queries don't extract status
- No filter applied
- ALL tasks returned (880 including completed)

**Impact:**
- User sees completed tasks they don't want
- Results are cluttered
- Not useful

**Solution Options:**

**Option A: Default to Open for Vague Queries** (Previously proposed - user REJECTED)
```typescript
if (isVague && !extractedStatus) {
    extractedStatus = "open";
}
```
**User feedback:** "Not appropriate - sometimes I want completed tasks"

**Option B: UI Toggle** ✅ (User preference)
```typescript
// In settings
vagueQueryIncludeCompleted: boolean; // Default: false

// In query processing
if (isVague && !extractedStatus && !settings.vagueQueryIncludeCompleted) {
    extractedStatus = "open,inprogress"; // Exclude completed/cancelled
}
```

**Option C: Smarter Context Detection** (Best!)
```typescript
// Detect "actionable" context
const actionableWords = ['should', 'can', 'do', 'need to', 'must'];
const isActionableQuery = actionableWords.some(w => query.toLowerCase().includes(w));

if (isVague && isActionableQuery && !extractedStatus) {
    extractedStatus = "open,inprogress"; // Actionable → exclude completed
    console.log("[...] Actionable vague query: Excluding completed tasks");
}
```

### **Problem #2: Status Coefficient Always Active** ⚠️

**Current logic (line 1471):**
```typescript
const statusCoefficient = queryHasStatus || statusInSort ? 1.0 : 0.0;
```

**For vague query:**
- `queryHasStatus = false`
- `statusInSort = true` (if status in sort order)
- Result: `statusCoefficient = 1.0` (ACTIVE!)

**This is BY DESIGN** (from previous fix) but may not be appropriate for vague queries!

**Issue:**
- Status coefficient is ALWAYS active if status in sort order
- Completed tasks get `statusScore = 0.2` (not zero!)
- Combined with priority, they can outscore open tasks

**Example:**
```
Completed P1: priority(1.0) + status(0.2) = 1.2
Open P4: priority(0.2) + status(1.0) = 1.2
Open no-priority: priority(0.1) + status(1.0) = 1.1

Completed P1 ties/beats open tasks!
```

---

## **DEEPER INVESTIGATION NEEDED**

### **Question 1: What's in the Sort Order?**

Need to check console logs for:
```
[Task Chat] Sort order: [...]
```

If it's `["relevance", "dueDate", "priority", "status"]`, then:
- Priority coefficient: ACTIVE
- Status coefficient: ACTIVE
- Both contribute to scores

### **Question 2: What Are the Actual Task Scores?**

Need detailed scoring logs. Add this after line 1538:

```typescript
// Log top 10 tasks for debugging
if (scored.length > 0) {
    console.log("[Task Chat] ========== TOP 10 SCORED TASKS ==========");
    scored.slice(0, 10).forEach((item, index) => {
        console.log(`[Task Chat] ${index + 1}. "${item.task.text.substring(0, 50)}..."`);
        console.log(`[Task Chat]    Status: ${item.task.statusCategory}, Priority: ${item.task.priority || 'none'}, Due: ${item.task.dueDate || 'none'}`);
        console.log(`[Task Chat]    Scores: rel=${item.relevanceScore.toFixed(2)}, due=${item.dueDateScore.toFixed(2)}, pri=${item.priorityScore.toFixed(2)}, stat=${item.statusScore.toFixed(2)}`);
        console.log(`[Task Chat]    Final: ${item.score.toFixed(2)}`);
    });
    console.log("[Task Chat] ================================================");
}
```

### **Question 3: Are Completed Tasks Actually Ranked High?**

Need to check if:
1. Completed tasks are scoring high (sorting issue)
2. OR completed tasks just appear because there are many of them (filtering issue)

---

## **RECOMMENDED INVESTIGATION STEPS**

### **Step 1: Add Debug Logging** ✅

Add detailed score logging to see EXACTLY what's happening:

```typescript
// In taskSearchService.ts, after line 1548 (after scoring)
console.log("[Task Chat] ========== VAGUE QUERY SCORE ANALYSIS ==========");
console.log(`[Task Chat] Total tasks scored: ${scored.length}`);

// Group by status
const byStatus = scored.reduce((acc, item) => {
    const status = item.task.statusCategory || 'unknown';
    if (!acc[status]) acc[status] = [];
    acc[status].push(item);
    return acc;
}, {} as Record<string, typeof scored>);

Object.entries(byStatus).forEach(([status, tasks]) => {
    const avgScore = tasks.reduce((sum, t) => sum + t.score, 0) / tasks.length;
    const maxScore = Math.max(...tasks.map(t => t.score));
    console.log(`[Task Chat] ${status}: ${tasks.length} tasks, avg score: ${avgScore.toFixed(2)}, max: ${maxScore.toFixed(2)}`);
});

// Top 20 tasks
console.log("[Task Chat] Top 20 tasks:");
scored.slice(0, 20).forEach((item, i) => {
    console.log(`[Task Chat] ${i+1}. [${item.task.statusCategory}] ${item.task.text.substring(0, 40)}... (score: ${item.score.toFixed(2)})`);
});
console.log("[Task Chat] ======================================================");
```

### **Step 2: Check Sort Order**

Look for this in console:
```
[Task Chat] Sort order: [...]
```

### **Step 3: Test Hypotheses**

**Hypothesis A:** Completed tasks score high due to priority
- Check if top completed tasks have high priority
- If yes → Problem is priority scoring

**Hypothesis B:** Completed tasks don't score high, just many of them
- Check distribution in top 20
- If many completed in top 20 → Scoring issue
- If few completed in top 20 → Just volume issue (filtering)

**Hypothesis C:** Status coefficient shouldn't be active for vague
- Try disabling: `const statusCoefficient = 0.0;` for vague queries
- See if results improve

---

## **PROPOSED FIXES**

### **Fix #1: Add Detailed Debug Logging** (Do this first!)

```typescript
// Location: taskSearchService.ts line 1548
// Add comprehensive score analysis logging
```

### **Fix #2: UI Toggle for Completed Tasks** (User preference)

```typescript
// settings.ts
vagueQueryIncludeCompleted: boolean; // Default: false

// Simple Search
if (isVague && !extractedStatus && !settings.vagueQueryIncludeCompleted) {
    extractedStatus = "open,inprogress";
}
```

### **Fix #3: Smart Context Detection** (Better UX)

```typescript
const actionableContext = /\b(should|can|could|need|must|do|todo)\b/i;
if (isVague && actionableContext.test(query) && !extractedStatus) {
    extractedStatus = "open,inprogress";
    console.log("[...] Actionable query detected: Excluding completed tasks");
}
```

### **Fix #4: Disable Status Coefficient for Vague?** (Experimental)

```typescript
// Line 1471
const statusCoefficient = isVagueQuery 
    ? 0.0  // Don't score by status for vague queries
    : (queryHasStatus || statusInSort ? 1.0 : 0.0);
```

**Rationale:** For vague queries, status should be a FILTER (include/exclude) not a RANKING factor.

---

## **NEXT STEPS**

1. ✅ **Add debug logging** to see actual scores
2. ✅ **Run test query** "What should I do today?"
3. ✅ **Analyze output:**
   - How many completed tasks in top 20?
   - What are their scores?
   - What components contribute?
4. ✅ **Determine root cause:**
   - Filtering issue (too many completed returned)
   - Scoring issue (completed ranked too high)
   - Both
5. ✅ **Implement appropriate fix**

---

**Status:** Ready for deep debugging with detailed logging! 🔍
