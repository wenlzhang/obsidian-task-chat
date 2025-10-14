# Task Chat Improvements

## Changes Made (v0.0.2)

### Problem Identified
The original implementation had several issues:
1. AI was generating generic advice instead of focusing on existing tasks
2. Task extraction was broken (showing single characters instead of full task text)
3. No semantic search - couldn't find tasks based on query meaning
4. Wrong workflow - AI should prioritize existing tasks, not create new content

### Solutions Implemented

#### 1. **New Task Search Service** (`taskSearchService.ts`)
- **Semantic Search**: Searches tasks using keyword matching and relevance scoring
- **Fuzzy Matching**: Finds tasks even if query doesn't match exactly
- **Smart Scoring**: Ranks tasks by:
  - Exact query matches (highest score)
  - Individual word matches
  - Folder and tag matches
  - Priority level (boosts high priority)
  - Completion status (boosts incomplete tasks)
  - Due dates (boosts tasks with due dates)
- **Query Intent Analysis**: Detects if user is searching or asking for priorities
- **Keyword Extraction**: Removes stop words and extracts meaningful keywords (supports English and Chinese)

#### 2. **Improved AI Service**
- **Two-Stage Approach**:
  1. **Local Search First**: Searches tasks locally using `TaskSearchService`
  2. **AI Prioritization**: Sends only relevant tasks to AI for analysis
- **Task ID System**: Assigns `[TASK_0]`, `[TASK_1]` etc. to each task
- **Proper Extraction**: AI references tasks by ID, making extraction reliable
- **Fallback Matching**: If AI doesn't use IDs, falls back to fuzzy word matching
- **Stricter System Prompt**: Explicitly instructs AI to:
  - ONLY reference existing tasks
  - NOT create new tasks or generic advice
  - Use [TASK_X] IDs when recommending
  - Focus on prioritization and execution

#### 3. **Updated Default Settings**
- Changed default system prompt to enforce task-focused behavior
- Emphasizes existing task management over content generation

### How It Works Now

#### Example Query: "如何开发 Task Chat" (How to develop Task Chat)

**Old Behavior**:
- AI generates generic development advice
- Returns broken task fragments (single letters)
- Doesn't find the actual "develop Task Chat" task

**New Behavior**:
1. **Local Search**:
   - Extracts keywords: `["开发", "task", "chat"]`
   - Searches all tasks for these keywords
   - Finds task containing "开发 Task Chat" with high relevance score
   
2. **AI Analysis**:
   - Receives: `[TASK_0] 开发 Task Chat [due::2025-01-20] [priority::high]`
   - AI responds: "I found [TASK_0] which matches your query..."
   - System extracts TASK_0 from response
   
3. **Result**:
   - Shows the actual task
   - Provides navigation button
   - AI focuses on that specific task

### Benefits

1. **Accurate Task Finding**: Uses local search before AI, ensuring relevant tasks are found
2. **Reliable Extraction**: Task IDs make it impossible to extract wrong fragments
3. **Task-Focused Responses**: AI can't generate generic content anymore
4. **Better Performance**: Searches locally first, only uses AI for prioritization
5. **Bilingual Support**: Works with English and Chinese queries
6. **Smart Ranking**: Most relevant tasks appear first

### Technical Details

#### Task Search Algorithm
```typescript
// Scoring system:
- Exact query match: +100 points
- Word match in task text: +10 points per word
- Folder match: +5 points
- Tag match: +5 points
- Incomplete task: +2 points
- High priority: +3 points
- Has due date: +2 points
```

#### Task ID Format
```
[TASK_0] Buy groceries
  Status: open | Priority: high | Due: 2025-01-20

[TASK_1] Review code
  Status: inProgress | Priority: medium | Due: 2025-01-18
```

AI must reference tasks using `[TASK_0]`, `[TASK_1]` format.

### Usage Examples

#### Finding Specific Tasks
**Query**: "task about developing plugin"
- Searches for: `["developing", "plugin"]`
- Returns: Tasks containing those keywords
- AI analyzes and recommends most relevant ones

#### Prioritization Requests
**Query**: "what should I work on next?"
- Detects priority intent
- Searches all incomplete tasks
- AI ranks by urgency, priority, and due dates
- Recommends top tasks with [TASK_X] IDs

#### Folder-Specific Search
**Query**: "show tasks in project folder"
- Searches for: `["project", "folder"]`
- Filters tasks by folder path
- AI lists tasks from that folder

### Future Enhancements

Potential improvements for future versions:
1. **Vector Embeddings**: Use embeddings for semantic similarity
2. **Task Relationships**: Detect dependencies between tasks
3. **Natural Language Updates**: "Mark task 5 as complete"
4. **Task Creation**: "Create a new task: ..." (only when explicitly requested)
5. **Batch Operations**: "Move all high priority tasks to today"
6. **Statistics**: "How many tasks due this week?"

### Testing Recommendations

1. Test with queries in your native language
2. Try exact task text matches
3. Try partial/fuzzy matches
4. Test priority-based queries
5. Test folder/tag-based queries
6. Verify task navigation works correctly

### Migration Notes

No data migration needed. The plugin will:
- Use new search algorithm automatically
- Apply new system prompt to new chats
- Existing chat history remains unchanged
- You may want to clear old chats and start fresh
