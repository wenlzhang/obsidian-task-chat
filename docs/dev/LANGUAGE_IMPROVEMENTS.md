# Language & UX Improvements (v0.0.3)

## Problems Fixed

Based on user feedback, the following issues were addressed:

### 1. **Task ID Mismatch**
**Problem**: AI said "请执行任务 [TASK_0]" but the recommended tasks list didn't show task numbers, making it impossible to know which task was being referenced.

**Solution**:
- Added visible task numbers in the recommended tasks UI
- Tasks now display as: `[1] 如何开发 Task Chat`
- Numbers match AI's `[TASK_1]` references exactly

### 2. **0-Based Indexing Confusion**
**Problem**: Using `[TASK_0]` is programmer convention but confusing for users who count from 1.

**Solution**:
- Changed to 1-based indexing: `[TASK_1]`, `[TASK_2]`, etc.
- More intuitive for non-technical users
- Matches how humans naturally count tasks

### 3. **Language Inconsistency**
**Problem**: AI responded in Chinese even though system prompt was in English. No way to control response language.

**Solution**:
- Added language settings in the Settings tab
- Four options available:
  - **Auto**: Matches user's input language
  - **English**: Always English
  - **Chinese**: Always Chinese (中文)
  - **Custom**: User-defined instruction

### 4. **Mixed Language Handling**
**Problem**: Users might mix languages in queries, unclear what language AI should use.

**Solution**:
- Auto mode detects primary language in mixed queries
- System prompt instructs AI: "If the query mixes multiple languages, use the primary language detected"
- Works seamlessly with bilingual users

## Implementation Details

### Language Configuration

**Settings Location**: Settings → Task Chat → Response language

**Options**:
1. **Auto (default)**: 
   ```
   "Respond in the same language as the user's query. 
   If the query mixes multiple languages, use the primary language detected."
   ```

2. **English**:
   ```
   "Always respond in English."
   ```

3. **Chinese**:
   ```
   "Always respond in Chinese (中文)."
   ```

4. **Custom**:
   - User provides their own instruction
   - Examples:
     - "Always respond in Spanish"
     - "Respond in French, but use English for technical terms"
     - "Use simplified Chinese"

### Task Number Display

**Before**:
```
Recommended tasks:
  如何开发 Task Chat 📝 2025-10-14T22:29  →
```

**After**:
```
Recommended tasks:
  [1] 如何开发 Task Chat 📝 2025-10-14T22:29  →
```

Now users can clearly see:
- AI says "请执行任务 [TASK_1]"
- Task list shows "[1] 如何开发 Task Chat"
- Perfect correspondence!

### System Prompt Updates

The AI now receives language-specific instructions:

**English Mode**:
```
7. Always respond in English.
```

**Chinese Mode**:
```
7. Always respond in Chinese (中文).
```

**Auto Mode**:
```
7. Respond in the same language as the user's query. 
   If the query mixes multiple languages, use the primary language detected.
```

**Custom Mode**:
```
7. [User's custom instruction]
```

## Code Changes

### 1. Settings Schema (`settings.ts`)
```typescript
export interface PluginSettings {
    // ... existing settings
    responseLanguage: 'auto' | 'english' | 'chinese' | 'custom';
    customLanguageInstruction: string;
}
```

### 2. Settings UI (`settingsTab.ts`)
- Added dropdown for language selection
- Conditionally shows custom instruction field
- Refreshes UI when selection changes

### 3. AI Service (`aiService.ts`)
- Uses 1-based indexing: `[TASK_${index + 1}]`
- Builds language instruction from settings
- Includes in system prompt: `7. ${languageInstruction}`
- Converts task IDs back to 0-based when extracting

### 4. Chat View (`chatView.ts`)
- Displays task numbers in recommended list
- Uses 1-based indexing: `[${index + 1}]`
- Added CSS class for styling

### 5. Styles (`styles.css`)
```css
.task-chat-task-number {
    font-weight: 600;
    color: var(--interactive-accent);
    margin-right: 4px;
}
```

## Usage Examples

### Example 1: English Query
**Settings**: Response Language = Auto

**User**: "what should I work on next?"

**AI Response**: 
```
I recommend [TASK_1] which is high priority and due today.
```

**Recommended Tasks**:
```
[1] Fix critical bug in authentication
```

### Example 2: Chinese Query
**Settings**: Response Language = Auto

**User**: "如何开发 Task Chat"

**AI Response**:
```
请执行任务 [TASK_1] 来开发 Task Chat。
```

**Recommended Tasks**:
```
[1] 如何开发 Task Chat
```

### Example 3: Mixed Language Query
**Settings**: Response Language = Auto

**User**: "Show me tasks about 项目开发"

**AI Response** (detects English as primary):
```
Found [TASK_1] about project development.
```

**Recommended Tasks**:
```
[1] 完成项目开发文档
```

### Example 4: Force English
**Settings**: Response Language = English

**User**: "如何开发 Task Chat"

**AI Response** (forced English):
```
Please execute [TASK_1] to develop Task Chat.
```

**Recommended Tasks**:
```
[1] 如何开发 Task Chat
```

### Example 5: Custom Instruction
**Settings**: 
- Response Language = Custom
- Custom Instruction = "Respond in formal business Japanese"

**User**: "What are my tasks?"

**AI Response**:
```
タスク [TASK_1] をご確認ください。
```

## Best Practices

### For English Users
- **Recommended**: Keep "Auto" setting
- AI will respond in English naturally
- No configuration needed

### For Non-English Users
- **Option 1**: Use "Auto" - AI matches your language
- **Option 2**: Force your language (e.g., Chinese)
- **Benefit**: Consistent responses in native language

### For Bilingual Users
- **Recommended**: Use "Auto"
- AI detects dominant language in query
- Can switch languages freely between queries

### For Teams/Shared Vaults
- **Recommended**: Use "Auto"
- Each user can set their preference
- Or use "Custom" for organization standard

## Comparison with Other Tools

### ChatGPT Approach
- Automatically detects and matches input language
- Our "Auto" mode works similarly
- No explicit language setting needed

### Claude Approach
- Supports system-level language instructions
- Our custom instruction allows similar control
- Can specify detailed language preferences

### Existing Obsidian AI Plugins
- **Text Generator Plugin**: No language control
- **BMO Chatbot**: Detects language from input
- **Smart Connections**: No language settings

**Our Advantage**: 
- Explicit language control when needed
- Flexible auto-detection by default
- Custom instructions for specific needs

## Future Enhancements

Potential improvements:
1. **Automatic locale detection**: Use system language as fallback
2. **Per-chat language**: Different chats in different languages
3. **Translation mode**: "Translate tasks to English"
4. **Language mixing**: "Respond in English but keep task names in original language"
5. **Voice input support**: Language detection from speech

## Migration Notes

Existing users:
- Default setting is "Auto" - same behavior as before
- No action needed unless you want to force a specific language
- Old chats will continue working normally
- New chats will use updated task numbering ([1] instead of [0])

## Testing Recommendations

Test the following scenarios:
1. ✅ Query in your native language → AI responds in same language
2. ✅ Switch to English query → AI switches to English
3. ✅ Force language setting → AI always uses that language
4. ✅ Task numbers visible in UI
5. ✅ Task numbers match AI references
6. ✅ Mixed language queries handled correctly
7. ✅ Custom instruction works as expected
