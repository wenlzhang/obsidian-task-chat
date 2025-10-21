# Task Chat Query Syntax Reference

## 🎯 Quick Reference

### **Priority Filters**
| Syntax | Description | Example |
|--------|-------------|---------|
| `P1`, `p1` | Priority 1 (highest) | `bug P1` |
| `P2`, `P3`, `P4` | Lower priorities | `review P2` |
| `p1 \| p2` | Multiple priorities | `p1 \| p2 \| p3` |
| `!p1` | Exclude priority | `!p1` |
| `priority:high` | Named priority | `priority:high` |

### **Date Filters**
| Syntax | Description | Example |
|--------|-------------|---------|
| `1d` | Due in 1 day | `meeting 1d` |
| `1w`, `2w` | Due in 1/2 weeks | `review 2w` |
| `1m` | Due in 1 month | `project 1m` |
| `today` | Due today | `tasks today` |
| `tomorrow` | Due tomorrow | `tomorrow` |
| `overdue`, `od` | Overdue tasks | `overdue` |
| `next week` | Due next week | `next week` |
| `this friday` | Due this Friday | `this friday` |
| `date before: May 5` | Before specific date | `date before: May 5` |
| `date after: Jan 1` | After specific date | `date after: Jan 1` |
| `no date` | No due date | `no date` |
| `!no date` | Has due date | `!no date` |

### **Status Filters**
| Syntax | Description | Example |
|--------|-------------|---------|
| `status:open` | Open tasks | `status:open` |
| `open` | Shortcut for open | `open` |
| `status:completed` | Completed tasks | `status:completed` |
| `completed` | Shortcut for completed | `completed` |
| `status:important` | Custom status | `status:important` |
| `important` | Custom status shortcut | `important` |

### **Boolean Operators**
| Syntax | Description | Example |
|--------|-------------|---------|
| `&` | AND (both conditions) | `bug & P1` |
| `\|` | OR (either condition) | `p1 \| p2` |
| `!` | NOT (exclude) | `!completed` |
| `()` | Grouping | `(p1 \| p2) & overdue` |

### **Tags & Folders**
| Syntax | Description | Example |
|--------|-------------|---------|
| `#urgent` | Tag filter | `#urgent` |
| `#backend \| #frontend` | Multiple tags | `#backend \| #frontend` |
| `folder:"Projects/Work"` | Folder filter | `folder:"Projects/Work"` |

---

## 📚 Detailed Examples

### **Basic Searches**

```
bug fix
→ Tasks containing "bug" AND "fix"

"urgent meeting"
→ Exact phrase search

P1
→ All priority 1 tasks

overdue
→ All overdue tasks

open
→ All open tasks
```

### **Combined Filters**

```
bug P1 overdue
→ High priority overdue bugs

meeting 1w & !p1
→ Meetings due in 1 week, excluding P1

status:open & (p1 | p2)
→ Open tasks with priority 1 or 2

#urgent & date: today
→ Urgent tasks due today

search: deployment & status:completed
→ Completed tasks about deployment
```

### **Date Examples**

```
# Relative dates
1d          → Due tomorrow
3d          → Due in 3 days
1w          → Due in 1 week
2w          → Due in 2 weeks
1m          → Due in 1 month

# Natural language
today       → Due today
tomorrow    → Due tomorrow
overdue     → Overdue tasks
next week   → Due next week
this friday → Due this Friday
next month  → Due next month

# Date ranges
date before: May 5        → Due before May 5
date after: Jan 1         → Due after January 1
date: this week           → Due this week
date: next month          → Due next month

# No date filters
no date     → Tasks without due date
!no date    → Tasks with due date
```

### **Priority Examples**

```
# Single priority
P1          → Priority 1 tasks
p2          → Priority 2 tasks (case-insensitive)

# Multiple priorities
p1 | p2     → Priority 1 OR 2
p1 | p2 | p3 → Priority 1, 2, or 3

# Exclude priority
!p1         → NOT priority 1
!p4         → Exclude lowest priority

# Named priorities
priority:high    → Priority 1 (alias)
priority:medium  → Priority 2 (alias)
priority:low     → Priority 3 (alias)
```

### **Status Examples**

```
# Single status
status:open           → Open tasks
open                  → Open tasks (shortcut)
status:completed      → Completed tasks
completed             → Completed tasks (shortcut)

# Multiple statuses
status:open | status:inProgress
→ Open OR in-progress tasks

open | inProgress
→ Same as above (shortcuts)

# Custom statuses (user-defined)
status:important      → Important status
status:bookmark       → Bookmarked tasks
status:waiting        → Waiting status
important             → Important (shortcut)
bookmark              → Bookmark (shortcut)

# Exclude status
!completed            → Not completed
!status:cancelled     → Not cancelled
```

### **Complex Queries**

```
# Project planning
(p1 | p2) & 1w & status:open
→ High/medium priority open tasks due in 1 week

# Bug triage
bug & p1 & overdue & !status:completed
→ Unresolved high priority overdue bugs

# Meeting preparation
meeting & (today | tomorrow) & !completed
→ Upcoming meetings not yet completed

# Folder + tags
folder:"Projects/Work" & #urgent & p1
→ Urgent P1 tasks in work folder

# Complex date logic
(overdue | today) & p1 & status:open
→ Overdue or today's open P1 tasks

# Team coordination
#backend & (p1 | p2) & date before: next week
→ Backend high/medium priority tasks due before next week
```

---

## 🔧 **How It Works Internally**

Understanding how your queries are processed helps you write better queries.

### **The Hybrid Intelligence System**

When you type a query like `bug fix P1 overdue`, the system:

#### **Step 1: Split Query Components**

```
Input: "bug fix P1 overdue"
    ↓
Properties (Always Deterministic):
├─ P1 → Priority: 1 (regex, instant, 100% accurate)
└─ overdue → DueDate: < today (chrono-node, instant)

Keywords (Mode-Dependent):
├─ Simple: ["bug", "fix"] (regex extraction)
└─ Smart/Chat: ["bug", "error", "issue", "fix", "repair", ...]
              (AI semantic expansion)
```

#### **Step 2: Convert to DataView Format**

```
Properties → WHERE clauses:
  WHERE priority = 1 AND due < date(today)

Keywords → Content filters:
  AND (text.contains("bug") OR text.contains("fix") ...)
```

#### **Step 3: Execute (Same for All Modes)**

```
1. DataView API filters by properties (fast!)
2. Keyword matching on filtered tasks
3. Score by relevance + properties
4. Sort by user preferences
5. Display results (Simple/Smart) or Chat (Task Chat)
```

### **Why This Matters**

✅ **Properties are always accurate**: `P1` never fails to match priority 1  
✅ **Fast when possible**: Simple search needs no AI (instant!)  
✅ **Intelligent when needed**: Smart/Chat use AI for semantic matching  
✅ **Cost-efficient**: No AI tokens wasted on parsing `P1` or `overdue`  
✅ **Unified execution**: All modes use the same filter/score/sort pipeline  

---

## 🎨 Mode-Specific Behavior

### **Simple Search** (Regex-based, Fast)
- Uses regex patterns for instant parsing
- No AI needed (free, instant)
- Best for: Quick property filters
- Performance: < 100ms

**Example:**
```
P1 overdue
→ Instant regex parsing → Filter → Results in ~50ms
```

### **Smart Search** (AI-enhanced)
- AI semantic expansion for keywords
- Regex parsing for properties
- Best for: Semantic keyword matching + filters
- Performance: ~500-600ms

**Example:**
```
bug fix P1
→ AI expands "bug", "fix" semantically
→ Regex extracts P1
→ Combined filtering
```

### **Task Chat** (Full AI)
- Full AI intelligence for natural language
- Understands context and intent
- Best for: Complex queries, recommendations
- Performance: ~2-3 seconds

**Example:**
```
"Show me important bugs that need fixing this week"
→ AI extracts: keywords=["bug", "fix"], status="important", dueDate="this week"
→ Recommends and prioritizes tasks
```

---

## 💡 Tips & Best Practices

### **1. Start Simple, Add Complexity**
```
# Start
bug

# Add priority
bug P1

# Add date
bug P1 overdue

# Add status
bug P1 overdue & !completed
```

### **2. Use Shortcuts**
```
# Instead of
status:open & priority:1 & date:overdue

# Use
open & p1 & od
```

### **3. Leverage Boolean Logic**
```
# Either high or medium priority
p1 | p2

# Both urgent AND backend
#urgent & #backend

# Not completed
!completed
```

### **4. Combine Keywords with Filters**
```
# Good
deployment & p1 & 1w
→ Clear intent: deployment tasks, P1, due in 1 week

# Also good
"code review" & p2 & !completed
→ Exact phrase + filters
```

### **5. Use Natural Language Dates**
```
# Natural
next friday
this week
2 weeks from now

# Also works
date: 2025-01-21
date before: May 5
```

---

## 🔧 Troubleshooting

### **Query Returns No Results**

**Check:**
1. **Typos**: `p5` → Should be `p1-p4`
2. **Date format**: `date: invalid` → Use natural language or ISO format
3. **Status name**: Must match your configured status categories
4. **Operator syntax**: Use `&` not `AND`, `|` not `OR`

### **Unexpected Results**

**Common Issues:**
```
# Issue: Too broad
bug
→ Returns all tasks with "bug"

# Fix: Add filters
bug & p1 & overdue
→ More specific

# Issue: Conflicting filters
p1 & !p1
→ Impossible condition

# Fix: Use OR for alternatives
p1 | p2
→ Either priority
```

### **Performance Issues**

**Optimization:**
```
# Slow: Keywords only (searches all content)
deployment configuration

# Faster: Add property filters
deployment & p1 & 1w
→ Narrows search space first

# Fastest: Properties first in Simple Search
p1 & overdue
→ Regex-based, instant
```

---

## 📖 Learning Path

### **Beginner** (Week 1)
Learn basic filters:
- Keywords: `bug fix`
- Priority: `P1`, `P2`
- Dates: `today`, `tomorrow`, `overdue`
- Status: `open`, `completed`

### **Intermediate** (Week 2-3)
Combine filters:
- Boolean: `bug & P1`, `p1 | p2`
- Dates: `1d`, `1w`, `next week`
- Tags: `#urgent`, `#backend`
- Negation: `!completed`, `!p1`

### **Advanced** (Week 4+)
Complex queries:
- Grouping: `(p1 | p2) & overdue`
- Ranges: `date before: May 5`
- Folders: `folder:"Projects"`
- Multi-condition: `(#urgent | #critical) & p1 & (today | overdue)`

---

## 🎓 Comparison with Other Tools

### **vs. Todoist**
```
Todoist: search: meeting & today & p1
Task Chat: meeting & today & P1
→ Similar syntax, cleaner appearance
```

### **vs. DataView**
```
DataView: TASK WHERE due = date(today) AND priority = 1
Task Chat: today & P1
→ Much more concise
```

### **vs. Natural Language**
```
Plain English: "Show me high priority overdue bugs"
Task Chat: bug & P1 & overdue
→ More precise, faster to type
```

---

## 🚀 Future Enhancements (Planned)

### **Phase 2**
- Time-specific queries: `today at 2pm`
- Created/completed date filters: `created: last week`
- Assignee filters: `assignee: @me`

### **Phase 3**
- Saved filters: `@my-urgent-tasks`
- Smart suggestions: Auto-complete as you type
- Query templates: Pre-defined complex queries

### **Phase 4**
- Custom operators: Define your own shortcuts
- Query macros: Reusable query components
- Advanced regex: For power users

---

## 📞 Getting Help

**Resources:**
- **Settings → Query Syntax Help**: In-app reference
- **Documentation**: Full guide in `docs/USER_GUIDE_QUERY_SYNTAX.md`
- **Examples**: See `docs/examples/` folder
- **Community**: Discord/Forum for questions

**Common Questions:**
- Q: "Can I use AND instead of &?"
  A: Not yet, but planned for Phase 2

- Q: "How do I search for the literal text 'P1'?"
  A: Use quotes: `"P1"` or `search: P1`

- Q: "Can I combine all three modes?"
  A: Each mode uses the same syntax, just parsed differently

---

**Status**: 📚 **REFERENCE COMPLETE** - Ready for users!
