# Task Chat

An AI-powered Obsidian plugin that enables you to chat with your tasks. Filter tasks by text, folders, priority, due date, completion status, and more. Get AI recommendations and navigate directly to tasks in your notes.

## ⚡ Three Chat Modes

Choose the mode that fits your needs. Set your default in settings, override per-query in chat:

| Mode | AI Usage | Cost | Best For |
|------|----------|------|----------|
| **🚀 Simple Search** | None | $0 | Quick searches, free operation |
| **🧠 Smart Search** | Keyword expansion | ~$0.0001 | Multilingual, broader results |
| **💬 Task Chat** | Full AI assistant | ~$0.0021 | AI insights, prioritization |

**Default**: Simple Search (free). Switch anytime using the dropdown in chat interface.

## Features

### 🤖 AI-Powered Task Analysis
- **Intelligent Chat Interface**: Natural language conversations about your tasks
- **Multiple AI Providers**: Choose from OpenAI, Anthropic, OpenRouter, or Ollama (local)
- **Smart Response Generation**: Context-aware recommendations based on your actual tasks
- **Temperature Control**: Adjust AI creativity/consistency (0.0-2.0)
- **Custom System Prompts**: Tailor AI assistant behavior to your needs

### 🔍 Three Chat Modes
Choose the mode that fits your needs. Set your default in settings, override per-query:

- **Simple Search** (Default, Free): Fast regex-based keyword search
  - No AI usage, always $0
  - Perfect for quick searches and simple filters
  - Stop word removal for better accuracy
  
- **Smart Search** (AI Keyword Expansion, ~$0.0001): Enhanced semantic search
  - AI expands keywords into multilingual synonyms
  - Cross-language task matching
  - Direct results (no AI analysis)
  - Best for multilingual and broader searches
  
- **Task Chat** (Full AI Assistant, ~$0.0021): Complete AI experience
  - AI keyword expansion + Analysis + Recommendations
  - Context-aware prioritization
  - Conversational insights
  - Best for complex queries and task prioritization

### 📊 Comprehensive Task Filtering
- **Text Search**: Semantic keyword matching across task content
- **Priority Filtering**: Filter by priority levels (1-4)
  - Customizable priority mapping (Todoist-style)
  - Support for emoji indicators (⏫ 🔼 🔽) and text values
- **Due Date Filtering**: 
  - Relative dates: today, tomorrow, overdue, future
  - Date ranges: this week, next week, this month
  - Specific dates: YYYY-MM-DD format
  - "Any due date" filter for tasks with deadlines
- **Status Filtering**: 
  - Open/incomplete tasks
  - Completed tasks
  - In-progress tasks
  - Cancelled tasks
- **Folder Filtering**: Path-based filtering with partial matches
- **Tag Filtering**: Hashtag-based filtering (#work, #personal)
- **Compound Filtering**: Combine multiple filters simultaneously
  - Example: "high priority overdue tasks in project folder with #urgent tag"

### 🎯 Task Display & Sorting
- **Multi-Criteria Sorting**: Tasks are sorted by multiple criteria in sequence
  - Primary sort applied first, secondary for ties, tertiary for further ties
  - Separate configurations for display vs. AI context
  - Fully customizable order per mode (Simple/Smart/Chat)
  - **Smart Internal Defaults**:
    - **Relevance**: Best matches first (score 100 → 0)
    - **Priority**: Highest first (1 → 2 → 3 → 4, where 1 maps to "high", "urgent", etc.)
    - **Due Date**: Most urgent first (overdue → today → future; no date = last)
    - **Created Date**: Newest first (recent tasks → older tasks)
    - **Alphabetical**: Natural A → Z order
  - **Auto Mode**: Intelligently picks relevance or due date based on query type
  - Default for Simple/Smart: Relevance → Due Date → Priority
  - Default for Chat Display: Auto → Relevance → Due Date → Priority  
  - Default for Chat AI Context: Relevance → Due Date → Priority
- **Configurable Result Limits**:
  - Max Direct Results (default: 20): No-cost instant results
  - Max Tasks for AI (default: 30): Context for AI analysis
  - Max Recommendations (default: 20): Final curated list
- **Task Navigation**: One-click navigation to task location in notes
  - Preserves line numbers
  - Opens source file automatically
  - Works across all vault folders

### 🎚️ Quality Filter

Control how strictly tasks are filtered before display. Higher percentages = fewer but higher-quality results.

#### What is Quality Filtering?

After finding tasks that match your query, Task Chat scores each task based on:
1. **Keyword relevance** (default 20× weight) - How well keywords match
2. **Due date urgency** (default 4× weight) - How soon it's due  
3. **Priority level** (default 1× weight) - Task importance

These weights are configurable in Settings → Scoring Coefficients.

The Quality Filter removes low-scoring tasks, showing only results above your chosen threshold.

**Score Calculation (User-Configurable):**
```
Final Score = (Relevance × R) + (Due Date × D) + (Priority × P)

Default coefficients: R=20, D=4, P=1
Maximum: 31 points (with defaults)

Configure in Settings → Scoring Coefficients
```

#### Configuration

**Settings → Task Display → Quality Filter**

- **Slider:** 0-100%
- **Default:** 0% (Adaptive - recommended)

**Filter Levels:**

| Level | Percentage | Description | Use When |
|-------|-----------|-------------|-----------|
| **Adaptive** | 0% | Auto-adjusts based on query | Recommended for most users |
| **Permissive** | 1-25% | Broad matching, more results | Exploring, semantic expansion |
| **Balanced** | 26-50% | Moderate quality filtering | Daily task management |
| **Strict** | 51-75% | Only strong matches | Specific requirements |
| **Very Strict** | 76-100% | Near-perfect matches only | Exact matching needed |

#### How to Choose

**Start with 0% (Adaptive)** - The system will automatically adjust based on:
- Number of keywords (more keywords = lower threshold)
- Semantic expansion detected (permissive threshold)
- Query complexity (simpler = higher threshold)

**Increase (30-50%)** if you're getting:
- Too many results
- Irrelevant tasks in results
- Need more focused matches

**Decrease (10-25%)** if you're getting:
- Too few results
- Missing relevant tasks
- Want broader exploration

#### Examples

**Query:** "fix urgent bug"  
**Semantic expansion:** 45 keywords total

| Filter | Threshold | Tasks Returned | Quality |
|--------|-----------|----------------|---------|
| 0% (Adaptive) | Auto: ~10% | 12 tasks | All relevant matches |
| 25% | 7.8/31 points | 8 tasks | Removed weak matches |
| 50% | 15.5/31 points | 4 tasks | Strong relevance + metadata |
| 75% | 23.3/31 points | 1 task | Near-perfect match only |

**Query:** "overdue tasks" (Simple Search)  
**Keywords:** 2 words

| Filter | Threshold | Tasks Returned | Quality |
|--------|-----------|----------------|---------|
| 0% (Adaptive) | Auto: ~26% | 15 tasks | Balanced quality |
| 50% | 0.6/1.2 points | 8 tasks | Moderate filtering |

#### Mode-Specific Behavior

**Simple Search:**
- Filters based on keyword matching only
- Score range: 0-1.2 points
- No semantic expansion
- Fast and straightforward

**Smart Search & Task Chat:**
- Filters on combined score (keywords + due date + priority)
- Score range: 0-31 points
- Uses semantic expansion
- More intelligent matching

**All modes:**
- Same percentage setting applies
- Automatically scales to appropriate score range
- Consistent behavior across plugin

#### Adaptive Mode Details

When set to 0%, threshold auto-adjusts:

| Keywords | Adaptive Threshold | Reason |
|----------|-------------------|--------|
| 20+ | ~10% | Semantic expansion - be permissive |
| 4-19 | ~16% | Several keywords - balanced |
| 2-3 | ~26% | Few keywords - moderate |
| 1 | ~32% | Single keyword - stricter |

#### Tips

1. **Start with 0% (Adaptive)** - Works great for most users
2. **Too many results?** Gradually increase to 30%, then 50%
3. **Too few results?** Lower to 10-25% or return to 0%
4. **Semantic expansion queries** work best with 10-25%
5. **Exact queries** may need 50-75%
6. **Check console logs** to see actual threshold values

#### Technical Details

**Percentage to Threshold Conversion:**
```
Filter Strength (%) → Threshold (score)
25% → 7.75 points (keep tasks scoring ≥ 7.75)
50% → 15.5 points (keep tasks scoring ≥ 15.5)
75% → 23.25 points (keep tasks scoring ≥ 23.25)
```

**Safety Net:**
If threshold filters out too many tasks, the system keeps a minimum number to ensure you get results.

### ⚙️ Scoring Coefficients

**New in 2024-10-18:** Control how much each factor affects task scores. Configure in **Settings → Scoring Coefficients**.

#### What Are Scoring Coefficients?

Coefficients determine the weight of each scoring component. The final score formula:

```
Final Score = (Relevance × R) + (Due Date × D) + (Priority × P)
```

**Components:**
- **Relevance (R)**: How well keywords match (max base score: 1.2)
- **Due Date (D)**: How urgent (max base score: 1.5 for overdue)
- **Priority (P)**: How important (max base score: 1.0 for priority 1)

#### Default Coefficients

| Coefficient | Default | Range | Result with Defaults |
|-------------|---------|-------|----------------------|
| **Relevance** | 20 | 1-50 | 1.2 × 20 = 24 points |
| **Due Date** | 4 | 1-20 | 1.5 × 4 = 6 points |
| **Priority** | 1 | 1-20 | 1.0 × 1 = 1 point |
| **Max Score** | - | - | **31 points total** |

#### Common Configurations

**Keyword-Focused (R=30, D=2, P=1):**
- Emphasizes keyword matching
- Due dates less important
- Max score: 37 points
- **Use when:** Searching for specific content

**Urgency-Focused (R=20, D=10, P=5):**
- Emphasizes deadlines and priority
- Keywords still important
- Max score: 44 points
- **Use when:** Managing time-sensitive tasks

**Priority-Focused (R=15, D=3, P=10):**
- Emphasizes task importance
- Less weight on keywords
- Max score: 34 points
- **Use when:** Importance > urgency

**Balanced (R=20, D=4, P=1) - Default:**
- Good for most users
- Keywords weighted heavily
- Due date moderately important
- Priority as tiebreaker
- Max score: 31 points

#### How to Configure

1. Open **Settings → Task Display → Scoring Coefficients**
2. Adjust sliders for each coefficient
3. See max score update in real-time
4. Changes apply immediately to all search modes

#### When to Adjust

**Increase Relevance (R) if:**
- You do a lot of keyword searches
- Content matching is most important
- You want search-engine-like behavior

**Increase Due Date (D) if:**
- You're deadline-driven
- Overdue tasks should always appear first
- Time management is priority

**Increase Priority (P) if:**
- You use priority levels actively
- High-priority tasks should dominate
- Priority > due date in your workflow

#### Real-Time Max Score Display

The settings show your current maximum possible score:

```
📈 Maximum Possible Score: 31.0 points
Relevance: 24.0 + Due Date: 6.0 + Priority: 1.0
```

This updates instantly as you adjust coefficients, helping you understand the impact of your changes.

#### Impact on Quality Filter

Your coefficients affect the Quality Filter's threshold calculation:

```
Example: Quality Filter set to 25%

With defaults (R=20, D=4, P=1):
Max Score = 31 points
Threshold = 31 × 0.25 = 7.75 points

With keyword-focus (R=30, D=2, P=1):
Max Score = 37 points  
Threshold = 37 × 0.25 = 9.25 points (stricter!)
```

Same percentage, different absolute threshold based on your coefficients.

#### Tips

1. **Start with defaults** - They work well for most users
2. **Adjust gradually** - Change one coefficient at a time
3. **Test with queries** - See how results change
4. **Monitor max score** - Keep it reasonable (20-50 points)
5. **Quality filter adapts** - Automatically scales to your coefficients

---

### 🔧 Advanced Scoring Coefficients

**New in 2024-10-18:** For power users who want fine-grained control over every aspect of scoring.

#### What Are Advanced Coefficients?

Beyond the main coefficients (Relevance, Due Date, Priority), advanced coefficients let you control scoring at a detailed level **within each factor**.

**Most users don't need these!** The main three coefficients are sufficient for 95% of workflows. Advanced coefficients are for:
- Power users who want maximum control
- Users with very specific workflow requirements
- Users experimenting with scoring behavior

#### Relevance Sub-Coefficients

Control how keyword matching is scored:

| Sub-Coefficient | Default | Range | What It Does |
|-----------------|---------|-------|--------------|
| **Core keyword weight** | 0.2 | 0.0-1.0 | **Additional bonus** for exact query matches (before expansion) |
| **All keywords weight** | 1.0 | 0.0-2.0 | **Base reference weight** for all matches (core + semantic equivalents) |

**How it works:**
- **All keywords weight** is the base reference (typically kept at 1.0)
- **Core keyword weight** is an **additional bonus** added on top
- Set core weight to **0** to disable the bonus and treat all keywords equally
- The core bonus is **added to** the all keywords score (not multiplied)

**Example:**

With defaults (core: 0.2, all: 1.0):
- Task matches 2 of 2 core keywords: `2/2 × 0.2 = 0.2 points` (bonus)
- Task matches 15 of 20 expanded keywords: `15/20 × 1.0 = 0.75 points` (base)
- **Relevance base score:** `0.2 + 0.75 = 0.95` (before main coefficient)
- **Final relevance:** `0.95 × 20 (main coeff) = 19 points`

**When to adjust:**

*No Core Bonus (core: 0, all: 1.0):*
- All keywords treated equally
- No preference for exact query matches
- **Use for:** Pure semantic searches

*Exact Match Focus (core: 0.5, all: 1.0):*
- Strong bonus for original query terms
- Semantic equivalents still important (base weight)
- **Use for:** Precise, technical searches

*Semantic Breadth (core: 0.1, all: 1.5):*
- Emphasizes semantic coverage (higher base)
- Small bonus for original terms
- **Use for:** Exploratory, conceptual searches

**Tip:** Keep all keywords weight at 1.0 and adjust core weight instead. This makes it easier to understand the relative importance.

#### Due Date Sub-Coefficients

Control scoring at each time range:

| Time Range | Default | Range | Meaning |
|------------|---------|-------|---------|
| **Overdue** | 1.5 | 0.0-2.0 | Past due date (most urgent) |
| **Within 7 days** | 1.0 | 0.0-2.0 | Due within a week |
| **Within 1 month** | 0.5 | 0.0-2.0 | Due within 30 days |
| **After 1 month** | 0.2 | 0.0-2.0 | Due later than 30 days |
| **No due date** | 0.1 | 0.0-2.0 | No deadline set |

**Example:**

With defaults (overdue: 1.5, main coeff: 4):
- Overdue task: `1.5 × 4 = 6 points`
- Due in 3 days: `1.0 × 4 = 4 points`
- Due in 2 weeks: `0.5 × 4 = 2 points`

**Common Configurations:**

*Aggressive Urgency (overdue: 2.0, 7days: 1.0, rest: 0.1):*
- Overdue tasks heavily prioritized
- Far-future tasks largely ignored
- **Use for:** Deadline-driven, reactive workflow

*Balanced Timeline (overdue: 1.2, 7days: 0.8, month: 0.5, later: 0.3):*
- Smoother urgency curve
- All dates considered fairly
- **Use for:** Long-term planning, proactive workflow

*Future Focus (overdue: 0.5, 7days: 1.0, month: 0.8, later: 0.5):*
- Upcoming tasks prioritized over overdue
- Forward-looking rather than reactive
- **Use for:** Planning-focused workflow

#### Priority Sub-Coefficients

Control scoring at each priority level:

| Priority Level | Default | Range | Typical Mapping |
|----------------|---------|-------|-----------------|
| **P1 (Highest)** | 1.0 | 0.0-1.0 | Urgent, critical, must-do |
| **P2 (High)** | 0.75 | 0.0-1.0 | Important, should-do |
| **P3 (Medium)** | 0.5 | 0.0-1.0 | Normal, regular tasks |
| **P4 (Low)** | 0.2 | 0.0-1.0 | Nice-to-have, optional |
| **No priority** | 0.1 | 0.0-1.0 | Unclassified tasks |

**Example:**

With defaults (P1: 1.0, main coeff: 1):
- P1 task: `1.0 × 1 = 1 point`
- P2 task: `0.75 × 1 = 0.75 points`
- P3 task: `0.5 × 1 = 0.5 points`

**Common Configurations:**

*Binary Priority (P1: 1.0, P2: 0.9, P3-4: 0.1):*
- Sharp distinction between high and low
- P1/P2 treated similarly (both "important")
- P3/P4 largely ignored
- **Use for:** Simple high/low workflow

*Graduated Priority (P1: 1.0, P2: 0.7, P3: 0.4, P4: 0.15):*
- Smooth progression between levels
- All levels clearly distinct
- **Use for:** Detailed priority management

*Flatten Priority (all: 0.5):*
- Priority doesn't matter much
- Focus on relevance and dates instead
- **Use for:** Priority-agnostic workflow

---

### 🎯 Complete Scoring Examples

#### Example 1: Keyword-Focused Power User

**Scenario:** Content researcher doing specific keyword searches

**Main Coefficients:**
- Relevance: 30 (emphasize keywords)
- Due Date: 2 (dates less important)
- Priority: 1 (standard)

**Sub-Coefficients:**
- Core weight: 0.3 (emphasize exact matches)
- All weight: 1.2 (but semantic still matters)
- Due date: All defaults
- Priority: All defaults

**Result:**
- Max score: `(1.2 × 30) + (1.5 × 2) + (1.0 × 1) = 40 points`
- Tasks matching query keywords heavily prioritized
- Dates/priority are secondary factors

**Use for:** Research, content creation, knowledge work

---

#### Example 2: Deadline Warrior

**Scenario:** Project manager juggling multiple deadlines

**Main Coefficients:**
- Relevance: 20 (standard)
- Due Date: 10 (emphasize urgency)
- Priority: 5 (moderate importance)

**Sub-Coefficients:**
- Relevance: All defaults
- Overdue: 2.0 (critical!)
- Within 7 days: 1.5 (very important)
- Within month: 0.8 (moderate)
- Later: 0.2 (minimal)
- Priority: All elevated ×1.2

**Result:**
- Max score: `(1.2 × 20) + (2.0 × 10) + (1.2 × 5) = 50 points`
- Overdue tasks dominate results
- Priority reinforces urgency

**Use for:** Project management, time-sensitive work

---

#### Example 3: Importance Over Urgency

**Scenario:** Strategic thinker focusing on important work

**Main Coefficients:**
- Relevance: 15 (moderate)
- Due Date: 3 (reduced emphasis)
- Priority: 10 (heavily emphasize)

**Sub-Coefficients:**
- Relevance: All defaults
- Due date: All defaults
- P1: 1.0
- P2: 0.6 (bigger drop from P1)
- P3: 0.3
- P4: 0.1
- None: 0.05

**Result:**
- Max score: `(1.2 × 15) + (1.5 × 3) + (1.0 × 10) = 32.5 points`
- High-priority tasks always on top
- Dates are tiebreakers only

**Use for:** Strategic planning, important vs urgent focus

---

### 📝 Tips for Advanced Users

#### Starting Out

1. **Use defaults first** - Test main coefficients before diving into advanced
2. **One change at a time** - Easier to understand impact
3. **Document your config** - Note why you chose values
4. **Compare before/after** - Run same query with different settings

#### When to Use Advanced Coefficients

**DO use them if:**
- Main coefficients aren't granular enough
- You have very specific workflow needs
- You understand the scoring system
- You're willing to experiment

**DON'T use them if:**
- You're new to the plugin
- Main coefficients work fine
- You don't want complexity
- You're unsure about impact

#### Testing Your Configuration

```
Test Query: "urgent bug fix due tomorrow priority 1"

Expected with defaults:
- Relevance: High (matches multiple keywords)
- Due Date: High (tomorrow = within 7 days)
- Priority: High (P1)
- Should appear at top of results

Expected with your config:
- Adjust expectations based on your coefficients
- Verify tasks rank as you intend
- Iterate if results don't match expectations
```

#### Common Pitfalls

**❌ Setting everything to max:**
- Makes all tasks score similarly
- Defeats purpose of differential scoring
- **Solution:** Vary coefficients to create meaningful differences

**❌ Too aggressive thresholds:**
- Overdue: 2.0, everything else: 0.1
- Only overdue tasks show up
- **Solution:** Smoother curves preserve more information

**❌ Ignoring base scores:**
- Sub-coefficients multiply with main coefficients
- Small main coeff + high sub-coeff = still small
- **Solution:** Adjust main coefficients first

---

### 💡 Advanced Tips

#### Property ORDER vs WEIGHT

**Important:** With user coefficients, **weight matters more than order!**

**Before (without user coefficients):**
- Sort order mattered: [relevance, dueDate, priority]
- First criterion dominated, others were tiebreakers

**Now (with user coefficients):**
- Coefficients determine importance: R=30, D=4, P=1
- Tasks scored as: `(R×30) + (D×4) + (P×1)`
- Relevance gets 30× weight → dominates regardless of order
- Order only matters for rare exact-score ties

**What to configure:**
- **Coefficients:** Control HOW MUCH each property matters
- **Sort order:** Select WHICH properties to include (not their importance)

**Example:**

```
Query: "fix bug"
Task A: relevance=0.8, dueDate=1.5 (overdue), priority=1.0 (P1)
Task B: relevance=1.0, dueDate=0.5 (month away), priority=0.75 (P2)

With R=30, D=4, P=1:
Task A: (0.8×30) + (1.5×4) + (1.0×1) = 24 + 6 + 1 = 31 points
Task B: (1.0×30) + (0.5×4) + (0.75×1) = 30 + 2 + 0.75 = 32.75 points

Task B ranks higher despite being overdue-less, because:
- Perfect relevance match (1.0 vs 0.8)
- Relevance weighted 30×, difference = 6 points
- Due date weighted 4×, difference = 4 points
- Relevance wins!
```

#### Resetting to Defaults

The settings tab includes convenient reset buttons to restore default values:

**Available Reset Options:**
1. **Reset All Advanced** - Resets all 13 sub-coefficients (relevance, due date, priority)
2. **Reset Main Coefficients** - Resets Relevance: 20, Due Date: 4, Priority: 1
3. **Reset Relevance** - Resets core weight: 0.2, all weight: 1.0
4. **Reset Due Date** - Resets all 5 time-range scores
5. **Reset Priority** - Resets all 5 priority-level scores

**Default Values:**

*Main Coefficients:*
- Relevance: 20
- Due Date: 4
- Priority: 1

*Relevance Sub-Coefficients:*
- Core weight: 0.2
- All keywords weight: 1.0

*Due Date Sub-Coefficients:*
- Overdue: 1.5, Within 7 days: 1.0, Within month: 0.5, Later: 0.2, None: 0.1

*Priority Sub-Coefficients:*
- P1: 1.0, P2: 0.75, P3: 0.5, P4: 0.2, None: 0.1

**Tip:** If your customization isn't working, use the reset buttons to restore defaults, then adjust ONE coefficient at a time until you find your ideal balance.

### 💬 Session Management
- **Multiple Chat Sessions**: Create and switch between different conversations
- **Session History**: All messages preserved with timestamps
- **Session Switching**: Quick access to previous conversations
- **Session Deletion**: Clean up old conversations
- **Auto-save**: Sessions saved automatically

### 🌍 Multilingual Support
- **Query Languages**: Configure supported languages for semantic search
- **Response Language**: Control AI response language
  - Auto: Match user's query language
  - Fixed: Always use English or Chinese
  - Custom: Define your own language instruction
- **Cross-language Matching**: Find tasks in any configured language
  - Query in English, find Chinese tasks
  - Query in Chinese, find English tasks

### 💰 Cost Tracking & Optimization
- **Real-time Token Usage**: See token count for every AI interaction
- **Cost Estimation**: Accurate cost calculation per query
  - Different pricing for input vs output tokens
  - Provider-specific rates (OpenAI, Anthropic, OpenRouter)
  - Automatic pricing updates from OpenRouter API
- **Cumulative Tracking**: Total tokens and costs across all sessions
- **Transparent Display**: See exactly when and why AI is used
  - Direct search indicators (no cost)
  - AI analysis indicators (with cost breakdown)
  - Explanation of why each method was chosen

### 🔄 Real-time Integration
- **Auto-refresh**: Tasks update automatically when notes change
- **Debounced Updates**: Intelligent update batching to prevent performance issues
- **DataView Integration**: Seamless integration with DataView plugin
  - Supports inline fields: `[due::2025-01-20]`
  - Supports emoji indicators: `📅 2025-01-20`
  - Customizable field mapping

### ⚙️ Extensive Configuration
- **Provider-specific API Keys**: Separate keys for each AI service
- **Model Selection**: Choose from available models per provider
  - Auto-loads available models on startup
  - Caches model list for quick access
- **Custom API Endpoints**: Use custom endpoints or proxies
- **Task Status Mapping**: Customize how task statuses are recognized
  - Default: Tasks plugin compatible
  - Fully customizable status symbols
- **Priority Mapping**: Define your own priority value mappings
  - Map any text value to priority levels 1-4
  - Support for multilingual priority values
- **Date Format Configuration**: Customize date display formats

### 🎨 User Interface
- **Modern Chat UI**: Clean, intuitive chat interface
- **Copy to Clipboard**: Copy any message with one click
- **Typing Indicators**: Visual feedback during AI processing
- **Filter Status Display**: See active filters at a glance
- **Token Usage Display**: Optional cost information below responses
- **Theme Support**: Integrates with Obsidian themes
- **Responsive Design**: Works in sidebars and main panes

## Quick Start Guide

### Opening Task Chat

- Click the chat icon in the left ribbon, or
- Use the command palette: "Task Chat: Open Task Chat"

### Chat Interface Controls

The chat interface has controls grouped into sections:

**Group 1: Session Management**
- **+ New**: Create a new chat session
- **Sessions**: View and switch between sessions

**Group 2: Chat Mode**
- **Chat mode dropdown**: Override the default chat mode per-query
  - **Simple Search**: Free keyword search (no AI)
  - **Smart Search**: AI keyword expansion (~$0.0001/query)
  - **Task Chat**: Full AI assistant (~$0.0021/query)
  - Selection overrides your default for the current query only

**Group 3: Task Management**
- **Filter tasks**: Open filter modal to narrow down tasks
- **Refresh tasks**: Reload tasks from vault

**Group 4: Cleanup**
- **Clear chat**: Clear current session's messages

### Basic Usage

**1. Start a Conversation**

1. **Choose chat mode** (dropdown in controls bar):
   - Uses your default from settings, or override for this query
   - **Simple Search**: Free, instant results
   - **Smart Search**: AI-enhanced keyword matching
   - **Task Chat**: Full AI analysis and recommendations
2. Click "Filter tasks" to select which tasks to focus on (optional)
3. Type your question or request in the chat input
4. Press Cmd/Ctrl+Enter to send
5. Click the → button next to recommended tasks to navigate to them
   - Opens the file and jumps to the task line
   - Works even in nested folders

**4. Manage Sessions**
- Click "+ New" to start a fresh conversation
- Click "Sessions" to view and switch between chat histories
- Each session preserves its own conversation context

### Commands

| Command | Shortcut | Description |
|---------|----------|-------------|
| **Send Message** | `Cmd/Ctrl + Enter` | Send your query to AI |
| **Task Chat: Open Task Chat** | - | Open the chat interface |
| **Task Chat: Refresh tasks** | - | Manually refresh task list |

### Example Queries

**Simple Search Mode** ($0)
- `"priority 1"` → Shows all high priority tasks
- `"due today"` → Shows tasks due today
- `"overdue"` → Shows past-due tasks
- `"#work"` → Shows tasks with #work tag
- `"bug fix"` → Keyword search (stop words removed)

**Smart Search Mode** (~$0.0001)
- `"urgent meeting"` → AI expands to ["urgent", "紧急", "meeting", "会议"]
- `"开发任务"` → Finds tasks in any language
- `"fix bug"` → AI finds synonyms: repair, resolve, debug
- `"priority 1 due today"` → AI parsing + direct results

**Task Chat Mode** (~$0.0021)
- `"What should I focus on today?"` → AI recommends with explanations
- `"Which tasks are most urgent?"` → AI analyzes and prioritizes
- `"Help me plan my week"` → Comprehensive AI insights
- `"What's blocking my progress?"` → Contextual analysis

## How the Three Chat Modes Work

Task Chat offers three distinct chat modes, each with **predictable behavior and costs**. Set your default in settings, override per-query in chat:

### 🚀 Simple Search (Default, Free)

**No AI, always $0**

```
Your Query → Regex Parsing → Task Filtering → Direct Results
```

**How it works:**
1. **Query Parsing**: Pattern matching extracts filters and keywords
2. **Stop Word Removal**: Removes "the", "a", "how", "what", etc.
3. **Task Filtering**: Applies filters (priority, due date, tags, etc.)
4. **Direct Results**: Displays filtered and sorted tasks

**Examples:**
- `"priority 1"` → Finds all priority 1 tasks
- `"due today"` → Finds tasks due today
- `"#work"` → Finds tasks with #work tag
- `"bug fix"` → Searches for "bug" and "fix" (removes stop words)

**When to use:**
- ✅ Quick searches and simple filters
- ✅ When you want instant, free results
- ✅ When you know exactly what you're looking for

**Cost:** Always $0

---

### 🧠 Smart Search (AI Keyword Expansion, ~$0.0001)

**AI expands keywords, direct results**

```
Your Query → AI Parsing → Keyword Expansion → Task Filtering → Direct Results
```

**How it works:**
1. **AI Query Parsing**: AI extracts filters and keywords
2. **Keyword Expansion**: AI generates multilingual synonyms
   - "urgent" → ["urgent", "紧急", "critical", "high-priority"]
   - "meeting" → ["meeting", "会议", "reunion", "conference"]
3. **Task Filtering**: Matches expanded keywords across all languages
4. **Direct Results**: Displays filtered and sorted tasks (no AI analysis)

**Examples:**
- `"urgent meeting"` → Expands to multilingual synonyms, finds more results
- `"开发任务"` → Finds tasks in English and Chinese
- `"fix bug"` → Expands to "repair", "resolve", "debug"

**When to use:**
- ✅ Multilingual task searches
- ✅ When you want broader, more comprehensive results
- ✅ When simple keyword matching is too narrow

**Cost:** ~$0.0001 per query (~250 tokens)

---

### 💬 Task Chat (Full AI Assistant, ~$0.0021)

**AI keyword expansion + analysis + recommendations**

```
Your Query → AI Parsing → Keyword Expansion → Task Filtering → AI Analysis → Recommendations
```

**How it works:**
1. **AI Query Parsing**: AI extracts filters and keywords
2. **Keyword Expansion**: AI generates multilingual synonyms
3. **Task Filtering**: Matches expanded keywords
4. **AI Analysis**: AI analyzes filtered tasks for context and priority
5. **Recommendations**: AI provides ranked recommendations with explanations

**Examples:**
- `"What should I focus on today?"` → AI recommends top priorities
- `"Which tasks are most urgent?"` → AI analyzes and ranks by urgency
- `"Help me plan my week"` → AI provides strategic insights

**When to use:**
- ✅ Complex questions about your tasks
- ✅ When you want AI recommendations and prioritization
- ✅ When you need insights, not just a list

**Cost:** ~$0.0021 per query (~1,000-1,500 tokens)

---

### 📊 Mode Comparison

| Feature | Simple Search | Smart Search | Task Chat |
|---------|--------------|--------------|-----------|
| **Query Parsing** | Regex | AI | AI |
| **Keyword Expansion** | No | Yes (multilingual) | Yes (multilingual) |
| **AI Analysis** | No | No | Yes |
| **Recommendations** | No | No | Yes |
| **Cost** | $0 | ~$0.0001 | ~$0.0021 |
| **Speed** | Instant | 1-2 sec | 2-3 sec |
| **Best For** | Quick searches | Multilingual | AI insights |

---

### 💰 Cost Examples

**Daily Usage Scenarios:**

**Scenario 1: Free User (Simple Search only)**
- 50 queries/day
- Daily cost: **$0**
- Monthly cost: **$0**

**Scenario 2: Mixed User**
- 30 Simple Search (free)
- 15 Smart Search (~$0.0015)
- 5 Task Chat (~$0.0105)
- Daily cost: **~$0.012**
- Monthly cost: **~$0.36**

**Scenario 3: Power User**
- 50 Task Chat queries/day
- Daily cost: **~$0.105**
- Monthly cost: **~$3.15**

---

### 🎯 Best Practices

**Choosing the Right Mode:**
- Use **Simple Search** for: `"priority 1"`, `"due today"`, `"#work"`
- Use **Smart Search** for: `"urgent meeting"`, `"开发任务"`, `"fix bug"`
- Use **Task Chat** for: `"What's urgent?"`, `"Plan my week"`, `"Top priorities?"`

**Cost Optimization:**
1. Default to **Simple Search** for most queries
2. Switch to **Smart Search** when you need multilingual/broader results
3. Reserve **Task Chat** for when you want AI insights

**Understanding Token Usage:**
Every response shows which mode was used:
- `📊 Mode: Simple Search • $0`
- `📊 Mode: Smart Search • 250 tokens • ~$0.0001`
- `📊 Mode: Task Chat • 1,234 tokens • ~$0.0021`

## Requirements

- **Obsidian** v1.0.0 or higher
- **DataView plugin** (required for task access)
- **API Key** for your chosen AI provider (not needed for Ollama)

## Installation

### From Obsidian Community Plugins

1. Open Obsidian Settings
2. Navigate to Community Plugins
3. Search for "Task Chat"
4. Click Install, then Enable

### Manual Installation

1. Download the latest release from the [Releases](https://github.com/wenlzhang/obsidian-task-chat/releases) page
2. Extract the files to your vault's `.obsidian/plugins/task-chat/` directory
3. Reload Obsidian
4. Enable the plugin in Settings → Community Plugins

## Setup

### Prerequisites
1. **Install DataView Plugin** (Required)
   - Go to Settings → Community Plugins
   - Search for "DataView"
   - Install and enable it

### Initial Configuration
1. Open Task Chat settings (Settings → Task Chat)
2. **Configure AI Provider**:
   - Select your provider (OpenAI, Anthropic, OpenRouter, or Ollama)
   - Enter your API key (not needed for Ollama)
   - Choose your preferred model
3. **Optional: Customize Settings**
   - DataView field mappings (match your task format)
   - Query languages (for multilingual support)
   - Response language preference
   - Max result limits (optimize cost vs. completeness)

### Getting an API Key

**OpenAI**
- Visit: https://platform.openai.com/api-keys
- Create new secret key
- Recommended model: `gpt-4o-mini` (cheap, fast)

**Anthropic**
- Visit: https://console.anthropic.com/account/keys
- Create new API key
- Recommended model: `claude-3-5-sonnet-20241022`

**OpenRouter**
- Visit: https://openrouter.ai/keys
- Create new API key
- Access to multiple models with single key
- Recommended: Various models available

**Ollama (Free, Local)**
- Install Ollama: https://ollama.com
- Run: `ollama serve`
- No API key needed, runs locally
- Recommended model: `llama3.2`

## Understanding Semantic Expansion

**Applies to: Smart Search and Task Chat modes only**

Semantic expansion is the core technology that enables multilingual and broader task discovery in Smart Search and Task Chat modes.

### What is Semantic Expansion?

**Direct Cross-Language Semantic Equivalence Generation**

For each keyword extracted from your query, the AI generates semantic equivalents **directly** in all your configured languages. This is **NOT literal translation** but conceptual equivalence.

**Key Concept:**
- Not "translate this word" → Literal word-for-word conversion
- But "how would you express this concept in language X?" → Contextual equivalents

### How It Works

**Step-by-Step Process:**

```
Your Query: "How to develop Task Chat plugin"
     ↓
1. AI Extracts Keywords: ["develop", "Task", "Chat", "plugin"]
     ↓
2. For EACH Keyword, Generate Semantic Equivalents in ALL Languages:
   
   "develop" →
     English (5): develop, build, create, implement, code
     中文 (5): 开发, 构建, 创建, 编程, 实现
     Svenska (5): utveckla, bygga, skapa, programmera, implementera
     Total: 15 equivalents
   
   "Task" →
     English (5): task, work, item, assignment, job
     中文 (5): 任务, 工作, 事项, 项目, 作业
     Svenska (5): uppgift, arbete, göra, uppdrag, ärende
     Total: 15 equivalents
   
   "Chat" →
     English (5): chat, conversation, talk, discussion, dialogue
     中文 (5): 聊天, 对话, 交流, 谈话, 沟通
     Svenska (5): chatt, konversation, prata, diskussion, samtal
     Total: 15 equivalents
   
   "plugin" →
     English (5): plugin, extension, addon, module, component
     中文 (5): 插件, 扩展, 附加组件, 模块, 组件
     Svenska (5): plugin, tillägg, modul, komponent, instick
     Total: 15 equivalents
     ↓
3. Total Keywords: 4 × 15 = 60 keywords for matching
     ↓
4. Search your vault for tasks containing ANY of these 60 keywords
```

### Expansion Math Explained

**The Formula:**

```
Per keyword, per language:     Your setting (default: 5)
Per keyword, all languages:    Setting × Number of languages
Entire query total:            Number of keywords × (Setting × Languages)
```

**Concrete Example:**

**Your settings:**
- Max expansions per language: `5`
- Query languages: `["English", "中文", "Svenska"]` (3 languages)

**Query:** "如何开发 Task Chat 插件"

**Calculation:**
```
Step 1: Extract keywords
  → ["开发", "Task", "Chat", "插件"] = 4 keywords

Step 2: Calculate per-keyword total
  → 5 per language × 3 languages = 15 per keyword

Step 3: Calculate query total
  → 4 keywords × 15 per keyword = 60 total keywords
```

**Result:** Your 4-keyword query expands to 60 keywords for comprehensive matching!

### Why NOT "Translation"?

**Translation (❌ Not what we do):**
```
开发 → Literally translate to English → "develop"
Task → Literally translate to Chinese → "任务"
```

**Semantic Equivalence (✅ What we actually do):**
```
开发 → "How do English speakers express 'development/building'?"
  → develop, build, create, implement, code, program, construct

Task → "How do Chinese speakers express 'task/work item'?"
  → 任务, 工作, 事项, 项目, 作业, 任务项
```

**Why this is better:**
- Captures full semantic range, not just one translation
- Generates context-appropriate terms
- Handles cultural/linguistic nuances
- Works naturally for mixed-language queries

### Mixed-Language Queries

**Scenario:** Your query mixes multiple languages

**Query:** "开发 plugin for Task管理"
- "开发" = Chinese
- "plugin" = English  
- "Task" = English
- "管理" = Chinese

**How expansion handles it:**

```
For EACH keyword (regardless of its original language):
  → Generate equivalents in ALL configured languages

"开发" (originally Chinese) →
  English: develop, build, create, implement, code
  中文: 开发, 构建, 创建, 编程, 实现
  Svenska: utveckla, bygga, skapa, programmera, implementera

"plugin" (originally English) →
  English: plugin, extension, addon, module, component
  中文: 插件, 扩展, 附加组件, 模块, 组件
  Svenska: plugin, tillägg, modul, komponent, instick
```

**Result:** Same comprehensive coverage regardless of query language mix!

### Settings Configuration

**Location:** Settings → Task Chat → Semantic Expansion

**Max keyword expansions per language** (Default: 5)
- Controls how many equivalents to generate per language
- Range: 1-15
- Higher = Better recall, more token usage
- Lower = Faster, cheaper, narrower matching

**Visual in settings shows:**
```
🧮 Expansion Math:
• Per keyword, per language: Your setting (default 5)
• Per keyword, all languages: Setting × Number of languages
• Entire query: (Keywords in query) × (Setting × Languages)

Example: Query "如何开发 Task Chat插件"
→ Extracts 4 keywords: [开发, Task, Chat, 插件]
→ With 5 per language × 3 languages = 15 per keyword
→ Total: 4 × 15 = 60 keywords for matching

⚡ Current: 5 per language × 3 languages = 15 per keyword
```

### Cost Impact

**Token Usage:**

Semantic expansion increases token usage for the query parsing step:

**Without expansion (Simple Search):**
- Tokens: ~0 (regex-based)
- Cost: $0

**With expansion (Smart Search):**
- Tokens: ~150-300 (depends on keyword count)
- Cost: ~$0.0001 per query
- Impact: Minimal

**With expansion + AI analysis (Task Chat):**
- Tokens: ~1,000-1,500 (expansion + analysis)
- Cost: ~$0.0021 per query
- Impact: Low for occasional use, moderate for heavy use

**Optimization tip:** Use Simple Search for quick lookups, Smart Search when you need broader/multilingual results.

### Benefits

**1. Cross-Language Task Discovery**
```
Query in English: "urgent meeting"
Finds tasks in ANY language:
  - English: "urgent meeting tomorrow"
  - Chinese: "紧急会议"
  - Swedish: "brådskande möte"
```

**2. Broader Semantic Coverage**
```
Query: "fix bug"
Also finds:
  - "repair error"
  - "resolve issue"
  - "debug problem"
  - "修复错误"
  - "fixa fel"
```

**3. Natural Mixed-Language Queries**
```
Query: "开发 plugin for Task管理"
Works perfectly! Each keyword expanded independently.
```

**4. No Special Cases**
- Proper nouns get expanded too
- Technical terms get context-appropriate equivalents
- Same process for all keywords

### When to Adjust Settings

**Increase max expansions (6-10) when:**
- ✅ You have diverse multilingual tasks
- ✅ Tasks use varied vocabulary
- ✅ You want maximum recall
- ✅ Token cost is not a concern

**Decrease max expansions (2-4) when:**
- ✅ You want faster, cheaper queries
- ✅ Your tasks use consistent vocabulary
- ✅ You mainly use one language
- ✅ Precision more important than recall

**Default (5) works well for:**
- ✅ Most users
- ✅ Balanced recall and precision
- ✅ Multilingual workflows
- ✅ Moderate token usage

### Troubleshooting

**Getting too few results?**
- Check console to see how many keywords were expanded
- Increase "Max keyword expansions per language" (try 7-10)
- Verify your languages are configured correctly
- Lower relevance threshold (Settings → Task Display)

**Getting too many irrelevant results?**
- Decrease "Max keyword expansions per language" (try 3-4)
- Raise relevance threshold (Settings → Task Display)
- Use more specific keywords in your query

**Other language not working?**
- Use English language names
- AI models may recognize English names better

## Configuration

### AI Provider Settings

- **AI Provider**: Choose between OpenAI, Anthropic, OpenRouter, or Ollama
- **API Key**: Your provider's API key (provider-specific)
  - OpenAI Key, Anthropic Key, OpenRouter Key stored separately
  - Ollama: No key required (local)
- **Model**: Model name (auto-populated dropdown)
  - OpenAI: `gpt-4o-mini`, `gpt-4o`, `gpt-4-turbo`
  - Anthropic: `claude-3-5-sonnet-20241022`, `claude-3-opus`
  - OpenRouter: Various models from multiple providers
  - Ollama: Local models (llama3.2, etc.)
- **API Endpoint**: Custom API endpoint URL (auto-filled, customizable)
- **Temperature**: AI creativity (0.0-2.0, default: 0.1)
  - Lower = more consistent, deterministic
  - Higher = more creative, varied
- **Max Response Length**: Maximum AI response length (500-16,000 tokens, default: 2,000)
  - Controls response detail and length
  - Higher = more detailed but slower and more expensive
  - Lower = faster and cheaper but may miss details
  - See "Model Capabilities" below for model-specific limits

### Model Capabilities and Token Limits

Different AI models have different **maximum output token limits** (how long their responses can be). Understanding these helps you choose appropriate settings.

**Note:** This refers to response length (output tokens), not context window (input).

#### OpenAI Models

**GPT-4o / GPT-4o-mini** (Recommended)
- **Max output:** 16,384 tokens (~12,000 words)
- **Context:** 128,000 tokens
- **Best for:** Most use cases, excellent value
- **Recommended setting:** 2,000-8,000 tokens
- **Cost (gpt-4o-mini):** $0.15 input / $0.60 output per 1M tokens

**GPT-4-turbo**
- **Max output:** 4,096 tokens (~3,000 words)
- **Context:** 128,000 tokens
- **Best for:** Complex reasoning
- **Recommended setting:** 1,500-4,000 tokens
- **Cost:** $10.00 input / $30.00 output per 1M tokens

#### Anthropic Models (Claude)

**Claude 3.5 Sonnet** (Latest)
- **Max output:** 8,192 tokens (~6,000 words)
- **Context:** 200,000 tokens
- **Best for:** Excellent reasoning and coding
- **Recommended setting:** 2,000-6,000 tokens
- **Cost:** $3.00 input / $15.00 output per 1M tokens

**Claude 3 Opus/Sonnet/Haiku**
- **Max output:** 4,096 tokens (~3,000 words)
- **Context:** 200,000 tokens
- **Recommended setting:** 1,500-4,000 tokens

#### Local Models (Ollama)

**Llama 3.2 / 3.1**
- **Max output:** 2,048-4,096 tokens (configurable)
- **Context:** 128,000 tokens
- **Best for:** Free local processing
- **Recommended setting:** 1,000-2,000 tokens

**Other local models** (Mistral, Phi3, Qwen)
- **Max output:** 2,048-4,096 tokens
- **Recommended setting:** 1,000-2,000 tokens

#### Choosing Your Setting

**By model:**
- GPT-4o/4o-mini: Can use up to 8,000+ tokens
- Claude 3.5 Sonnet: Can use up to 6,000 tokens
- GPT-4-turbo/Claude 3: Keep under 4,000 tokens
- Local models: Keep under 2,000 tokens

**By use case:**
- Quick checks: 1,000 tokens (~750 words)
- Daily analysis: 2,000 tokens (~1,500 words) ← default
- Detailed reports: 4,000-6,000 tokens (~3,000-4,500 words)
- Comprehensive analysis: 8,000+ tokens (~6,000+ words)

**By budget:**
- Cost-conscious: 1,000 tokens
- Balanced: 2,000 tokens
- Money not an issue: 4,000+ tokens

**Cost example** (gpt-4o-mini, 50 queries/day):
- 1,000 tokens: $0.90/month
- 2,000 tokens: $1.80/month ← default
- 4,000 tokens: $3.60/month
- 8,000 tokens: $7.20/month

**⚠️ Important:** Setting above your model's limit may cause errors or response truncation. Check your model's specifications!

### Chat Settings

- **Max Chat History**: Number of messages to keep (default: 50)
  - Controls memory usage
  - Only recent messages sent to AI for context
- **Show Task Count**: Display task count in filter status banner
- **Show Token Usage**: Display cost and token information below responses
  - Shows prompt/completion tokens
  - Estimated cost per query
  - Cumulative usage tracking
- **Auto-open Sidebar**: Open Task Chat automatically on startup
- **System Prompt**: Customize the AI assistant's behavior
  - Default: Focus on existing tasks, be concise
  - Customize for your workflow

### Query & Search Settings

**🔑 Three Chat Modes (Default + Per-Query Override)**

Task Chat offers three modes with **predictable behavior and costs**. The **default chat mode** (configured in settings) is used for all new sessions. You can override it per-query using the dropdown in the chat interface:

```
┌──────────────────────────────────────────────────┐
│ Simple Search (Default) - Free                   │
├──────────────────────────────────────────────────┤
│ • Regex parsing, no AI                           │
│ • Always $0                                      │
│ • Instant results                                │
│ • Best for: Quick searches, cost-free operation  │
└──────────────────────────────────────────────────┘

┌──────────────────────────────────────────────────┐
│ Smart Search - AI Keyword Expansion (~$0.0001)   │
├──────────────────────────────────────────────────┤
│ • AI expands keywords to multilingual synonyms   │
│ • Direct results (no AI analysis)                │
│ • ~250 tokens per query                          │
│ • Best for: Multilingual, broader results        │
└──────────────────────────────────────────────────┘

┌──────────────────────────────────────────────────┐
│ Task Chat - Full AI Assistant (~$0.0021)         │
├──────────────────────────────────────────────────┤
│ • AI keyword expansion + analysis + insights     │
│ • Ranked recommendations with explanations       │
│ • ~1,000-1,500 tokens per query                  │
│ • Best for: Complex queries, AI prioritization   │
└──────────────────────────────────────────────────┘
```

**How to Configure:**
- **Default mode**: Settings → Task Chat → **Default chat mode**
  - Select: Simple Search (free) | Smart Search (AI keywords) | Task Chat (full AI)
  - This applies to all new sessions
- **Per-query override**: Use dropdown in chat interface (top controls)
  - Changes mode for current query only
  - Doesn't change your default setting

**Mode-Specific Features:**
- **Simple Search**: Free, instant, no AI
- **Smart Search**: Multilingual keyword expansion, direct results
- **Task Chat**: AI analysis, recommendations, "Auto" sorting mode available

---

**Search Optimization Settings**

- **Max Direct Results** (default: 20)
  - Controls how many results to show for Simple/Smart Search modes
  - Task Chat mode analyzes up to this many tasks
  - Range: 5-100 tasks

- **Max Tasks for AI** (default: 30)
  - Only affects Task Chat mode
  - Controls how many tasks AI analyzes
  - Higher = more context for AI, higher token cost
  - Lower = faster, cheaper responses

- **Max Recommendations** (default: 20)
  - Only affects Task Chat mode
  - Final curated list size after AI analysis
  - Keep manageable for user review

---

**Language Settings**

- **Query Languages** (default: English, 中文)
  - Languages for semantic expansion in Smart Search and Task Chat modes
  - Simple Search mode doesn't use this (regex-based keyword matching only)
  - For EACH keyword, AI generates semantic equivalents in ALL these languages
  - More languages = broader cross-language matching but slightly more tokens
  - Example: English, Español, 中文, 日本語
  - **Tip:** Use English language names for better AI recognition

- **Response Language** (AI response preference)
  - Only affects Task Chat mode (only mode with AI responses)
  - Auto: AI detects and responds in the language matching your query
  - English: Always respond in English
  - Chinese: Always respond in Chinese (中文)
  - Custom: Define your own language instruction
  - **Note:** This only controls response language, not expansion languages

### Task Display Settings

**Sorting Options**
- **Task Sort By**: Field to sort tasks by
  - **Auto (AI-driven)** - ⭐ Only available in Task Chat mode
    - **Availability**: Only shown when default chat mode is set to "Task Chat"
    - AI intelligently chooses sorting based on query type
      - Keyword searches → Relevance sorting
      - Other queries → Due Date sorting
    - Best for: Task Chat mode users who want smart AI-driven sorting
  - **Relevance**: Keyword match quality score (works when query has keywords)
    - Scores tasks based on how well they match your search keywords
    - Works in all three modes
    - Best for: Finding most relevant tasks in keyword searches
  - **Due Date**: Sort by deadline
    - Best for: Time-sensitive task management
  - **Priority**: Sort by priority level (1-4)
    - Best for: Importance-based workflows
  - **Created Date**: Sort by creation time
    - Best for: Chronological task tracking
  - **Alphabetical**: Sort by task text
    - Best for: Organized browsing
- **Sort Direction**: Sort order
  - Low to High (ascending): 1→4, A→Z, Early→Late
  - High to Low (descending): 4→1, Z→A, Late→Early
- **Note**: "Auto" sorting is exclusive to Task Chat mode for AI-driven prioritization

**Result Limits** (controls cost and performance)
- **Max Direct Results** (default: 20, range: 5-100)
  - Tasks shown directly without AI analysis
  - No cost, instant results
  - Higher = more results before AI triggers
- **Max Tasks for AI** (default: 30, range: 5-100)
  - Tasks sent to AI for context
  - Affects token usage and cost
  - Higher = better AI understanding, higher cost
- **Max Recommendations** (default: 20, range: 5-100)
  - Final curated task list size
  - AI selects most relevant from analyzed tasks
  - Keep manageable for user

**Relevance Threshold** (Advanced - Tune for your needs)
- **Range**: 0-100 (default: 0 = system defaults)
- **What it does**: Sets base threshold for keyword matching in BOTH direct search and AI analysis
- **When it applies**: Only when "Sort tasks by" is set to "Relevance" AND query has keywords
- **How it works**: System applies intelligent adjustments around your base value:
  - 4+ keywords → **base - 10** (more lenient for complex queries)
  - 2-3 keywords → **base** (use your setting)
  - 1 keyword → **base + 10** (more strict for simple queries)
- **Unified behavior**: Same filtering rules apply whether using direct search or AI analysis

**Examples:**
| Your Setting | 4+ Keywords | 2-3 Keywords | 1 Keyword |
|--------------|-------------|--------------|-----------|
| 0 (default) | 20 | 30 | 40 |
| 15 (lenient) | 5 | 15 | 25 |
| 25 (moderate) | 15 | 25 | 35 |
| 35 (strict) | 25 | 35 | 45 |
| 50 (very strict) | 40 | 50 | 60 |

**When to adjust**:
- **Getting too few results?** Lower the base (try 15-20)
  - Example: Setting 15 gives you (5/15/25) - more lenient across all queries
- **Getting too many irrelevant results?** Raise the base (try 40-50)
  - Example: Setting 40 gives you (30/40/50) - stricter across all queries
- **Different languages**: Multilingual queries often need lower base (15-25)
- **Keep 0 for smart defaults** - works well for most users!

**How scoring works**: Each keyword match = 15-20 points, multiple matches get bonuses
- Task matching 2 keywords = ~30-45 points
- Task matching 3 keywords = ~55-70 points
- Task matching 4+ keywords = ~70-90+ points

### DataView Integration

**Field Mapping**
Configure field names to match your task metadata format:

- **Due Date Field**: Default is `due`
  - Supports: `[due::2025-01-20]`
- **Created Date Field**: Default is `created`
- **Completed Date Field**: Default is `completed`
- **Priority Field**: Default is `priority`

**Priority Mapping** (Customizable, Todoist-style)
Map text values to numeric priority levels (1-4):
- **Level 1 (Highest)**: Default: `1, p1, high, highest`
  - Add your own: `urgent, critical`
- **Level 2 (High)**: Default: `2, p2, medium, med`
- **Level 3 (Medium/Low)**: Default: `3, p3, low`
- **Level 4 (None)**: Default: `4, p4, none`

System uses 1-4 internally for consistent filtering.

**Task Status Mapping** (Customizable)
Define which symbols represent each status:
- **Open**: Default: ` ` (space), empty
  - Standard: `- [ ] Task`
- **Completed**: Default: `x, X`
  - Standard: `- [x] Task`
- **In Progress**: Default: `/,  ~`
  - Standard: `- [/] Task`
- **Cancelled**: Default: `-`
  - Standard: `- [-] Task`

**Date Formats** (optional, for display)
- Due Date Format: `YYYY-MM-DD` (ISO standard)
- Created Date Format: `YYYY-MM-DD`
- Completed Date Format: `YYYY-MM-DD`

## Task Format

Task Chat works with standard Markdown tasks that include DataView metadata:

```markdown
- [x] Write blog post [due::2025-01-15] [p::high]
- [/] Review pull requests [due::2025-01-18] [p::medium]
```

**Supported Task Properties:**
- **Due Dates**: 
  - DataView format: `[due::YYYY-MM-DD]`
  - Example: `- [ ] Task [due::2025-01-20]`
  
- **Priority**: 
  - DataView format: `[p::high]`, `[p::1]`, `[p::p1]`
  - Custom values: Add in settings (e.g., `[p::urgent]`)
  
- **Status Indicators**: 
  - Open: `- [ ] Task`
  - Completed: `- [x] Task`
  - In Progress: `- [/] Task`
  - Cancelled: `- [-] Task`
  
- **Tags**: 
  - Standard Obsidian tags: `#work`, `#personal`, `#urgent`
  - Inline or at end of line
  
- **Folder Context**: Automatically detected from file path

**Complete Example:**
```markdown
## Projects

- [ ] Design new feature [due::2025-01-25] [p::high] #design #urgent
- [/] Write documentation [due::2025-01-20] [p::medium] #docs
- [x] Fix login bug [due::2025-01-15] [p::1] [completed::2025-01-14] #bugfix
- [ ] Review PR #123 [p::medium] #code-review
- [-] Old task [p::low]
```

## Advanced Usage Tips

### Power User Workflows

**1. Multi-Criteria Filtering**
```
"Show me high priority in-progress tasks in the projects folder due this week with #urgent tag"
```
→ Combines 5 filters: priority + status + folder + due date + tag

**2. Cross-Language Task Management**
```
Query in English: "development tasks"
Finds: "开发任务", "Task development", "Develop feature"
```
→ Semantic matching across languages

**3. Cost-Optimized Queries**
- Use simple, direct queries for routine checks
- Enable AI Query Parsing only when needed
- Adjust maxDirectResults to control AI trigger point

**4. Session Organization**
- Create separate sessions for different projects
- Use descriptive session names (auto-generated from first query)
- Switch sessions to maintain context

### Keyboard Shortcuts

| Action | Shortcut |
|--------|----------|
| Send message | `Cmd/Ctrl + Enter` |
| Focus input | Click in textarea |
| Copy message | Click copy button |

### Integration with Other Plugins

**Works well with:**
- **Tasks Plugin**: Compatible status formats
- **Calendar Plugin**: Due date integration
- **Kanban Plugin**: Status-based workflows
- **Templater**: Auto-generate tasks with metadata
- **DataView**: Full integration for queries

## Development

```bash
# Install dependencies
npm install

# Start development server
npm run dev

# Build for production
npm run build

# Run tests
npm test

# Lint code
npm run lint
```

## Acknowledgments

This plugin leverages code patterns from:
- [Task Scope](https://github.com/wenlzhang/obsidian-task-scope) - DataView task integration
- [Todoist Context Bridge](https://github.com/wenlzhang/obsidian-todoist-context-bridge) - Task property handling

## Privacy & Security

- Your API keys are stored locally in Obsidian's data folder
- Task data is only sent to your chosen AI provider when you send a message
- No data is collected or stored by this plugin
- For maximum privacy, use Ollama for local AI processing

## Troubleshooting

### Tasks not showing up

1. Ensure DataView plugin is installed and enabled
2. Check that your tasks follow the proper format
3. Click "Refresh tasks" in the chat view
4. Verify DataView field mappings in settings

### AI not responding

1. Check your API key is entered correctly
2. Verify your API endpoint is correct
3. Ensure you have internet connection (except for Ollama)
4. Check the console for error messages (Ctrl/Cmd + Shift + I)

### Cannot navigate to tasks

1. Ensure the source file still exists
2. Try refreshing tasks
3. Check that line numbers are being captured correctly

### Understanding chat modes

**Which mode should I use?**
- **Simple Search**: Quick searches, simple filters, free operation
- **Smart Search**: Multilingual searches, broader keyword matching
- **Task Chat**: Complex questions, AI recommendations, task prioritization

**How do I switch modes?**
- **Set default**: Settings → Task Chat → Default chat mode dropdown
  - This sets the default for all new sessions
- **Override per-query**: Use dropdown in chat interface (top controls)
  - Temporarily changes mode for current query only

**Understanding costs:**
- **Simple Search**: Always $0 (no AI)
- **Smart Search**: ~$0.0001 per query (AI keyword expansion only)
- **Task Chat**: ~$0.0021 per query (full AI analysis)

**How to reduce costs?**
1. Use Simple Search as your default mode
2. Switch to Smart Search only when you need multilingual/broader results
3. Reserve Task Chat for when you want AI recommendations
4. Use Ollama for free local AI processing (all modes)

**Query not understood correctly?**
- Try Smart Search or Task Chat mode for better AI understanding
- Check Settings → Query Languages to ensure your language is listed
- Use more specific keywords or filters
- Check the console for extracted filters (Ctrl/Cmd + Shift + I)

**Getting too few results in Smart Search or Task Chat?**
- The relevance base threshold may be too strict for your language
- Go to Settings → Task Display → Relevance threshold
- **Quick fix**: Try setting to 15 (gives you 5/15/25 thresholds)
- **Understanding**: System will still adapt, but around a lower base
- **Tip**: Multilingual queries often need base of 15-20

**Getting too many irrelevant results?**
- The relevance base threshold may be too lenient
- Try raising base to 40-45 for more selective results across all queries
- Check console (Ctrl/Cmd+Shift+I) to see actual scores
- **Tip**: Look for log showing "Final adaptive threshold"

**Fine-tuning relevance threshold for your language:**
1. Start with default (0) and test typical queries
2. Open console (Ctrl/Cmd+Shift+I) and look for:
   ```
   "Using default adaptive base: 20 (4 keywords)"
   "Final adaptive threshold: 20 (base: 20, keywords: 4)"
   "Filtered to 6 relevant tasks"
   ```
3. Evaluate results:
   - **Too few results?** Lower base by 10-15
     - If default gives 20, try base 15 (→ thresholds become 5/15/25)
   - **Too many irrelevant?** Raise base by 10-15
     - If default gives 20, try base 30 (→ thresholds become 20/30/40)
4. Test with different query types (1 keyword, 2-3 keywords, 4+ keywords)
5. **Remember**: System always adapts around your base - you're shifting the whole curve!

## Contributing

Contributions are welcome! Please feel free to submit issues or pull requests.

## License

MIT License - see LICENSE file for details

## Support

<a href='https://ko-fi.com/C0C66C1TB' target='_blank'><img height='36' style='border:0px;height:36px;' src='https://storage.ko-fi.com/cdn/kofi1.png?v=3' border='0' alt='Buy Me a Coffee at ko-fi.com' /></a>
