# AI Natural Language Understanding - Test Cases

**Purpose**: Comprehensive test cases for AI-enhanced query parsing  
**Modes**: Smart Search and Task Chat only (not Simple Search)  
**Date**: 2025-01-21

---

## Test Categories

1. [Natural Language Queries](#natural-language-queries)
2. [Multilingual Queries](#multilingual-queries)
3. [Typo Correction](#typo-correction)
4. [Property Recognition](#property-recognition)
5. [Edge Cases](#edge-cases)

---

## Natural Language Queries

### Test Set 1: Basic Status Recognition

| Input | Expected Output |
|-------|-----------------|
| "show me open tasks" | `status: "open"` |
| "tasks I'm working on" | `status: "inprogress"` |
| "things I'm doing" | `status: "inprogress"` |
| "completed tasks" | `status: "completed"` |
| "finished items" | `status: "completed"` |
| "cancelled work" | `status: "cancelled"` |
| "blocked tasks" | `status: "?" (blocked symbol)` |
| "stuff that's stuck" | `status: "?" (blocked symbol)` |

### Test Set 2: Priority Recognition

| Input | Expected Output |
|-------|-----------------|
| "urgent tasks" | `priority: 1` |
| "critical items" | `priority: 1` |
| "high priority work" | `priority: 1 or 2` |
| "important tasks" | `priority: 1 or 2` |
| "medium priority" | `priority: 2 or 3` |
| "normal tasks" | `priority: 2 or 3` |
| "low priority items" | `priority: 3 or 4` |
| "minor tasks" | `priority: 4` |
| "can wait" | `priority: 3 or 4` |

### Test Set 3: Due Date Recognition

| Input | Expected Output |
|-------|-----------------|
| "tasks due today" | `dueDate: "2025-01-21"` |
| "due tomorrow" | `dueDate: "2025-01-22"` |
| "due next week" | `dueDateRange: next week` |
| "overdue tasks" | `dueDate: "overdue"` |
| "late items" | `dueDate: "overdue"` |
| "past due work" | `dueDate: "overdue"` |
| "no deadline" | `dueDate: "no date"` |
| "without due date" | `dueDate: "no date"` |

### Test Set 4: Combined Properties

| Input | Expected Output |
|-------|-----------------|
| "urgent open tasks" | `status: "open", priority: 1` |
| "high priority items due today" | `priority: 1, dueDate: "today"` |
| "overdue critical tasks" | `dueDate: "overdue", priority: 1` |
| "completed high priority work" | `status: "completed", priority: 1` |
| "tasks I'm working on that are urgent" | `status: "inprogress", priority: 1` |
| "open items with no deadline" | `status: "open", dueDate: "no date"` |

### Test Set 5: Complex Natural Language

| Input | Expected Output |
|-------|-----------------|
| "show me critical bugs in the payment system" | `keywords: [bug, payment, system], priority: 1` |
| "what tasks do I have due tomorrow?" | `dueDate: "tomorrow"` |
| "list all overdue high priority items" | `dueDate: "overdue", priority: 1` |
| "find tasks I'm working on that are urgent" | `status: "inprogress", priority: 1` |
| "which critical tasks are still open?" | `priority: 1, status: "open"` |
| "show incomplete work due this week" | `status: "open", dueDateRange: "this week"` |

---

## Multilingual Queries

### Test Set 6: Chinese (中文)

| Input | Expected Output |
|-------|-----------------|
| "打开的任务" | `status: "open"` |
| "进行中的工作" | `status: "inprogress"` |
| "完成的任务" | `status: "completed"` |
| "紧急任务" | `priority: 1` |
| "高优先级工作" | `priority: 1 or 2` |
| "明天到期" | `dueDate: "tomorrow"` |
| "过期的任务" | `dueDate: "overdue"` |
| "明天到期的紧急未完成任务" | `status: "open", priority: 1, dueDate: "tomorrow"` |
| "正在进行的高优先级工作" | `status: "inprogress", priority: 1` |
| "显示支付系统中的严重错误" | `keywords: [payment, system, bug], priority: 1` |

### Test Set 7: Swedish

| Input | Expected Output |
|-------|-----------------|
| "öppna uppgifter" | `status: "open"` |
| "pågående arbete" | `status: "inprogress"` |
| "klara uppgifter" | `status: "completed"` |
| "brådskande uppgifter" | `priority: 1` |
| "hög prioritet" | `priority: 1 or 2` |
| "förfallna imorgon" | `dueDate: "tomorrow"` |
| "försenade uppgifter" | `dueDate: "overdue"` |
| "brådskande ofullständiga uppgifter förfallna imorgon" | `status: "open", priority: 1, dueDate: "tomorrow"` |

### Test Set 8: German

| Input | Expected Output |
|-------|-----------------|
| "offene Aufgaben" | `status: "open"` |
| "in Bearbeitung" | `status: "inprogress"` |
| "fertige Aufgaben" | `status: "completed"` |
| "dringende Aufgaben" | `priority: 1` |
| "hohe Priorität" | `priority: 1 or 2` |
| "fällig morgen" | `dueDate: "tomorrow"` |
| "überfällige Aufgaben" | `dueDate: "overdue"` |
| "dringende unvollständige Aufgaben fällig morgen" | `status: "open", priority: 1, dueDate: "tomorrow"` |

### Test Set 9: Spanish

| Input | Expected Output |
|-------|-----------------|
| "tareas abiertas" | `status: "open"` |
| "en progreso" | `status: "inprogress"` |
| "tareas completadas" | `status: "completed"` |
| "tareas urgentes" | `priority: 1` |
| "alta prioridad" | `priority: 1 or 2` |
| "vence mañana" | `dueDate: "tomorrow"` |
| "tareas vencidas" | `dueDate: "overdue"` |
| "tareas urgentes incompletas vencidas mañana" | `status: "open", priority: 1, dueDate: "tomorrow"` |

### Test Set 10: Mixed Languages

| Input | Expected Output |
|-------|-----------------|
| "urgent 任务 due tomorrow" | `priority: 1, dueDate: "tomorrow"` |
| "show me öppna uppgifter with high priority" | `status: "open", priority: 1` |
| "完成的 tasks in project folder" | `status: "completed", keywords: [project, folder]` |

---

## Typo Correction

### Test Set 11: Common Typos

| Input | Corrected | Expected Output |
|-------|-----------|-----------------|
| "opne tasks" | "open tasks" | `status: "open"` |
| "taks list" | "task list" | `keywords: [task, list]` |
| "priorty 1" | "priority 1" | `priority: 1` |
| "complated items" | "completed items" | `status: "completed"` |
| "urgant work" | "urgent work" | `priority: 1` |
| "overdu tasks" | "overdue tasks" | `dueDate: "overdue"` |
| "tommorow" | "tomorrow" | `dueDate: "tomorrow"` |
| "tomorow" | "tomorrow" | `dueDate: "tomorrow"` |
| "critcal bugs" | "critical bugs" | `priority: 1, keywords: [bug]` |
| "paymant system" | "payment system" | `keywords: [payment, system]` |

### Test Set 12: Multiple Typos

| Input | Corrected | Expected Output |
|-------|-----------|-----------------|
| "urgant opne taks" | "urgent open tasks" | `priority: 1, status: "open"` |
| "complated priorty 1 itmes" | "completed priority 1 items" | `status: "completed", priority: 1` |
| "overdu critcal taks due tommorow" | "overdue critical tasks due tomorrow" | `dueDate: "overdue", priority: 1` |
| "show me opne taks in paymant system" | "show me open tasks in payment system" | `status: "open", keywords: [payment, system]` |

### Test Set 13: Phonetic Mistakes

| Input | Corrected | Expected Output |
|-------|-----------|-----------------|
| "hi priorty" | "high priority" | `priority: 1 or 2` |
| "compleet" | "complete" | `status: "completed"` |
| "urgint" | "urgent" | `priority: 1` |
| "tomorrrow" | "tomorrow" | `dueDate: "tomorrow"` |

---

## Property Recognition

### Test Set 14: Status Variations

| Input | Recognized As |
|-------|---------------|
| "todo items" | `status: "open"` |
| "pending tasks" | `status: "open"` |
| "wip tasks" | `status: "inprogress"` |
| "doing tasks" | `status: "inprogress"` |
| "active work" | `status: "inprogress"` |
| "done items" | `status: "completed"` |
| "finished tasks" | `status: "completed"` |
| "closed work" | `status: "completed"` |
| "abandoned tasks" | `status: "cancelled"` |
| "dropped items" | `status: "cancelled"` |
| "stuck tasks" | `status: "?" (blocked)` |
| "waiting items" | `status: "?" (blocked)` |

### Test Set 15: Priority Variations

| Input | Recognized As |
|-------|---------------|
| "asap tasks" | `priority: 1` |
| "emergency work" | `priority: 1` |
| "critical tasks" | `priority: 1` |
| "urgent items" | `priority: 1` |
| "important work" | `priority: 1 or 2` |
| "high priority" | `priority: 1 or 2` |
| "normal tasks" | `priority: 2 or 3` |
| "regular work" | `priority: 2 or 3` |
| "medium priority" | `priority: 2 or 3` |
| "low priority" | `priority: 3 or 4` |
| "minor tasks" | `priority: 4` |
| "later items" | `priority: 3 or 4` |

### Test Set 16: Date Variations

| Input | Recognized As |
|-------|---------------|
| "due today" | `dueDate: today` |
| "deadline today" | `dueDate: today` |
| "expires tomorrow" | `dueDate: tomorrow` |
| "late tasks" | `dueDate: "overdue"` |
| "past due" | `dueDate: "overdue"` |
| "behind schedule" | `dueDate: "overdue"` |
| "no deadline" | `dueDate: "no date"` |
| "without date" | `dueDate: "no date"` |
| "unscheduled" | `dueDate: "no date"` |
| "next week" | `dueDateRange: next week` |
| "this week" | `dueDateRange: this week` |
| "next month" | `dueDateRange: next month` |

---

## Edge Cases

### Test Set 17: Ambiguous Queries

| Input | Expected Behavior | Notes |
|-------|-------------------|-------|
| "high" | Ask for clarification or treat as keyword | Could be "high priority" or keyword |
| "open" | `status: "open"` OR keyword | Context-dependent |
| "critical" | `priority: 1` OR keyword | Usually priority, but could be keyword |
| "tomorrow" | `dueDate: "tomorrow"` | Clear date reference |
| "work" | keyword | Generic, unlikely to be property |

### Test Set 18: Conflicting Properties

| Input | Expected Output | Resolution |
|-------|-----------------|------------|
| "open completed tasks" | Clarify or prefer last mentioned | Contradiction |
| "high priority low importance" | Use last or ask | Contradiction |
| "due today and tomorrow" | Use both (OR logic) | Both dates |
| "urgent and low priority" | Prefer explicit (urgent) | Contradiction |

### Test Set 19: Empty or Minimal Queries

| Input | Expected Output | Notes |
|-------|-----------------|-------|
| "" | Error or show all | Empty query |
| "tasks" | Show all tasks | Too generic |
| "show" | Show all tasks | Action word only |
| "?" | Help or error | Invalid |

### Test Set 20: Very Long Queries

| Input | Expected Behavior |
|-------|-------------------|
| "show me all urgent high priority critical tasks that are open or in progress and due today or tomorrow or next week in the project folder with payment system bugs" | Parse multiple properties correctly |

### Test Set 21: Syntax Mixed with Natural Language

| Input | Expected Output | Notes |
|-------|-----------------|-------|
| "s:open and urgent tasks" | `status: "open", priority: 1` | Mix works! |
| "p1 tasks that are due tomorrow" | `priority: 1, dueDate: "tomorrow"` | Mix works! |
| "show me s:wip & overdue" | `status: "inprogress", dueDate: "overdue"` | Mix works! |

---

## Expected AI Behaviors

### Confidence Scoring

- **High confidence (0.8-1.0)**: Clear property matches, no ambiguity
- **Medium confidence (0.5-0.8)**: Some uncertainty, likely correct
- **Low confidence (0.0-0.5)**: Ambiguous, fall back to Simple Search

### Language Detection

- Detect primary language from input
- Support mixed-language queries
- Map to internal property codes regardless of language

### Typo Correction

- Correct within 1-2 character edits
- Use common typo patterns
- Phonetic similarity matching
- Show corrections to user (Task Chat only)

### Property Mapping

- Map natural language → internal codes
- Support multiple synonyms per property
- Handle cultural variations (e.g., "critical" vs "asap")
- Fall back to keywords if unsure

---

## Test Execution

### Manual Testing Checklist

- [ ] Test all natural language queries
- [ ] Test all multilingual queries
- [ ] Test all typo corrections
- [ ] Test all property recognitions
- [ ] Test all edge cases
- [ ] Verify Smart Search uses correct filtering
- [ ] Verify Task Chat shows AI understanding
- [ ] Verify confidence scoring works
- [ ] Verify fallback to Simple Search
- [ ] Verify cost tracking accuracy

### Automated Testing

Create automated tests in Jest for:
- Property recognition accuracy (90%+ target)
- Typo correction accuracy (85%+ target)
- Language detection accuracy (95%+ target)
- Confidence scoring consistency
- Fallback behavior correctness

---

## Success Criteria

✅ **Property Recognition**: 90%+ accuracy across all test cases  
✅ **Typo Correction**: 85%+ correction accuracy  
✅ **Multilingual**: Support 5+ languages with 90%+ accuracy  
✅ **Confidence**: Appropriate confidence scores for all queries  
✅ **Fallback**: Graceful degradation to Simple Search when uncertain  
✅ **Performance**: <0.5s average query processing time  
✅ **Cost**: <$0.0002 per query average  
✅ **User Satisfaction**: Positive feedback on natural language queries

---

## Notes

- All tests apply to **Smart Search and Task Chat only**
- Simple Search remains regex-based (unchanged)
- AI understanding shown in **Task Chat only**
- Typo corrections logged to console for debugging
- Language detection is heuristic, not perfect
- Confidence threshold configurable by user

---

**Last Updated**: 2025-01-21  
**Test Coverage**: 21 test sets, 150+ individual test cases  
**Status**: Ready for implementation
