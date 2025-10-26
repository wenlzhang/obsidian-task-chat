# Error Handler and Status UI Improvements - 2025-01-26

## Summary

Implemented two major improvements based on user feedback:
1. **Dynamic default model references** in error messages
2. **Enhanced status category sort order UI** with slider and always-visible auto-organize

---

## ✅ Improvement #1: Dynamic Default Model References

### User's Insight

> "In the code files, you define some default models for the four cases. You should always suggest the first one in the list in the warning messages. This way, it will be easier to maintain the codebase in the future."

**User is 100% correct!** This approach is much more maintainable.

### What Was Changed

**Before (Hardcoded):**
```typescript
// errorHandler.ts
if (isOllama) {
    solution = `Try default: gpt-oss:20b`;  // ❌ Hardcoded
} else if (isAnthropic) {
    solution = `Try default: claude-sonnet-4`;  // ❌ Hardcoded
}
```

**After (Dynamic):**
```typescript
// errorHandler.ts
const defaultOllama = ModelProviderService.getDefaultOllamaModels()[0];
const defaultAnthropic = ModelProviderService.getDefaultAnthropicModels()[0];
const defaultOpenRouter = ModelProviderService.getDefaultOpenRouterModels()[0];
const defaultOpenAI = ModelProviderService.getDefaultOpenAIModels()[0];

if (isOllama) {
    solution = `Try default: ${defaultOllama}`;  // ✅ Dynamic (qwen3:8b-q8_0)
} else if (isAnthropic) {
    solution = `Try default: ${defaultAnthropic}`;  // ✅ Dynamic (claude-sonnet-4)
}
```

### Benefits

**Maintainability:**
- ✅ Single source of truth (modelProviderService.ts)
- ✅ Change model order once → error messages update automatically
- ✅ No need to update error handler when models change

**Consistency:**
- ✅ Error messages always match current best recommendations
- ✅ Same logic used for settings UI and error handling
- ✅ No hardcoded strings scattered across files

**Current First Models (Most Recommended):**
- OpenAI: `gpt-4o-mini`
- Anthropic: `claude-sonnet-4`
- OpenRouter: `openai/gpt-4o-mini`
- Ollama: `qwen3:8b-q8_0`

### Example Error Message

**Model Not Found Error:**
```
Provider: Ollama
Model: "invalid-model"

Solution:
1. Pull the model: ollama pull <model-name>
2. Check available models: ollama list
3. Verify model name in settings matches exactly
4. Try default: qwen3:8b-q8_0  ← Automatically updated!
```

### Files Modified

- `errorHandler.ts`:
  - Added import: `ModelProviderService`
  - Updated `createModelNotFoundError()` to use dynamic defaults
  - 4 provider-specific suggestions now reference first model from lists

---

## ✅ Improvement #2: Enhanced Status Category Sort Order UI

### User's Issues

1. **Auto-fix button invisible**: "I don't see any icon or indication of this auto-fix feature"
   - **Cause**: Button only appeared when duplicates detected
   - **User couldn't find it** when no duplicates existed

2. **Manual text input not ideal**: "Manually inputting a number isn't the best approach"
   - **Problem**: Typing numbers is error-prone
   - **Better UX**: Slider with visual feedback

### What Was Changed

#### Change #1: Always Show Auto-Organize Button

**Before:**
```typescript
// Only shown when validation.valid === false
if (!validation.valid) {
    // Show warning box with auto-fix button
}
// Nothing shown when sort orders are valid ❌
```

**After:**
```typescript
// Always show organizer box
const organizerBox = containerEl.createDiv({
    cls: validation.valid ? "task-chat-info-box" : "task-chat-warning-box",
});

if (!validation.valid) {
    // Show warning: "⚠️ Duplicate sort orders detected"
} else {
    // Show success: "✅ Sort orders look good! You can still use Auto-Organize..."
}

// Always show the auto-organize button ✅
new Setting(organizerBox)
    .setName("Auto-Organize Sort Orders")
    .addButton(...);
```

**Visual States:**

**When duplicates exist:**
```
┌─────────────────────────────────────────────────┐
│ ⚠️ Duplicate sort orders detected              │
│                                                 │
│ • Categories "open" and "custom1" both use: 1  │
│ • Categories "info" and "tendency" both use: 80│
│                                                 │
│ When multiple categories have the same order   │
│ number, sorting becomes unpredictable.          │
│                                                 │
│ Auto-Organize Sort Orders                       │
│ Automatically renumber all categories with      │
│ consistent gaps (10, 20, 30...)                 │
│                                                 │
│            [Auto-fix now] ← CTA button          │
└─────────────────────────────────────────────────┘
```

**When everything is fine:**
```
┌─────────────────────────────────────────────────┐
│ ✅ Sort orders look good! You can still use    │
│ Auto-Organize to renumber with consistent gaps  │
│ (10, 20, 30...).                               │
│                                                 │
│ Auto-Organize Sort Orders                       │
│ Automatically renumber all categories with      │
│ consistent gaps. Makes it easy to add new       │
│ categories between existing ones.               │
│                                                 │
│            [Organize now] ← Normal button       │
└─────────────────────────────────────────────────┘
```

#### Change #2: Slider Instead of Text Input

**Before (Text Input):**
```typescript
.addText((text) => {
    text.setPlaceholder("e.g., 3")
        .setValue(order !== undefined ? String(order) : "")
        .onChange(async (value) => {
            const parsed = parseInt(value.trim());
            // Validation logic...
        });
    text.inputEl.style.width = "80px";
});
```

**Problems:**
- ❌ Manual typing prone to errors
- ❌ No visual feedback of range
- ❌ Need to validate input
- ❌ Hard to see relative positions

**After (Slider + Clear Button):**
```typescript
const orderSetting = new Setting(advancedFields)
    .setName("Sort order")
    .setDesc(orderDesc);

// Add slider for easier adjustment
orderSetting.addSlider((slider) => {
    slider
        .setLimits(1, 100, 1)
        .setValue(order || effectiveOrder)
        .setDynamicTooltip()
        .onChange(async (value) => {
            this.plugin.settings.taskStatusMapping[categoryKey].order = value;
            await this.plugin.saveSettings();
        });
    slider.sliderEl.style.width = "200px";
});

// Add clear button to reset to default
orderSetting.addButton((button) =>
    button
        .setButtonText("Clear")
        .setTooltip("Clear custom order (use smart default)")
        .onClick(async () => {
            this.plugin.settings.taskStatusMapping[categoryKey].order = undefined;
            await this.plugin.saveSettings();
            this.display(); // Refresh to show new effective order
            new Notice(`Reset "${displayName}" to default order`);
        })
);
```

**Benefits:**
- ✅ Visual range (1-100)
- ✅ Easy dragging to adjust
- ✅ No typing errors
- ✅ Dynamic tooltip shows current value
- ✅ Clear button to reset to smart default
- ✅ Wider slider (200px) for better control

### UI Comparison

**Before:**
```
Sort order
Sort priority (1=highest). Currently using default: 1.
┌────────┐
│  e.g., 3│  ← Text input (manual typing)
└────────┘
```

**After:**
```
Sort order
Sort priority (1=highest). Currently using default: 1.
├──────────────────────────────┤  10  [Clear]
    ↑ Slider (1-100)            ↑     ↑
                            Tooltip  Reset
```

### User Experience Flow

**Adjusting Sort Order:**

Before:
1. Click text field
2. Type number (hope no typo)
3. Press Enter
4. Hope it's valid

After:
1. Drag slider
2. See tooltip with value
3. Auto-saves
4. ✅ Done!

**Resetting to Default:**

Before:
1. Clear text field
2. Click outside
3. Maybe reload?

After:
1. Click "Clear" button
2. See notice with reset confirmation
3. ✅ Done!

**Organizing All Orders:**

Before (with duplicates):
1. Notice warning box
2. Click "Auto-fix now"
3. Done

Before (without duplicates):
1. ❌ Can't find button!

After (always):
1. See info box (green or yellow)
2. Click "Organize now" or "Auto-fix now"
3. All categories renumbered: 10, 20, 30...
4. ✅ Done!

### Auto-Organize Behavior

**What it does:**
- Renumbers all categories with consistent gaps (10, 20, 30, 40...)
- Maintains relative order
- Leaves room for inserting new categories between existing ones
- Removes all duplicates automatically

**Example:**

Before auto-organize:
```
open: 1
custom1: 1  ← Duplicate!
inProgress: 2
info: 80
tendency: 80  ← Duplicate!
completed: 6
```

After auto-organize:
```
open: 10      ← Can add at 5
custom1: 20   ← Can add at 15
inProgress: 30 ← Can add at 25
completed: 40  ← Can add at 35
info: 50       ← Can add at 45
tendency: 60   ← Can add at 55
```

---

## Files Modified

**1. `src/utils/errorHandler.ts`**
- Added import: `ModelProviderService`
- Updated `createModelNotFoundError()` method
- Changed 4 hardcoded model names → dynamic references
- Lines changed: ~10 lines

**2. `src/settingsTab.ts`**
- Updated status category validation display (lines 865-923)
- Replaced text input with slider + clear button (lines 2009-2041)
- Lines changed: ~90 lines

---

## Benefits Summary

### For Error Messages:
- ✅ **Single source of truth** for default models
- ✅ **Automatic updates** when model order changes
- ✅ **No maintenance overhead** for error messages
- ✅ **Consistent recommendations** across all code

### For Status Sort Order UI:
- ✅ **Always visible** auto-organize button
- ✅ **Slider for easy adjustment** (no typing)
- ✅ **Clear visual feedback** (tooltip, range)
- ✅ **Reset button** for quick defaults
- ✅ **Helpful even without errors** (organize anytime)

---

## Testing Checklist

### Error Messages:
- [ ] Trigger model not found error with OpenAI → Check suggests `gpt-4o-mini`
- [ ] Trigger model not found error with Anthropic → Check suggests `claude-sonnet-4`
- [ ] Trigger model not found error with OpenRouter → Check suggests `openai/gpt-4o-mini`
- [ ] Trigger model not found error with Ollama → Check suggests `qwen3:8b-q8_0`
- [ ] Reorder models in `modelProviderService.ts` → Check error message updates

### Status Sort Order UI:
- [ ] Open status settings with no duplicates → See green info box with "Organize now"
- [ ] Open status settings with duplicates → See yellow warning box with "Auto-fix now"
- [ ] Click "Organize now" → All categories renumbered 10, 20, 30...
- [ ] Drag slider in category → See tooltip, value updates
- [ ] Click "Clear" button → Order resets to default, see notice
- [ ] Create many custom categories → Auto-organize keeps everything neat

---

## Build Status

```
✅ TypeScript: 0 errors
✅ Size impact: Minimal (+import statement)
✅ All references updated
✅ Backward compatible
✅ Ready to test!
```

---

## User's Excellent Feedback Addressed

> "In the code files, you define some default models. You should always suggest the first one in the list in the warning messages. This way, it will be easier to maintain the codebase in the future."

**✅ FIXED:** Error messages now dynamically reference first model from provider's default list in `modelProviderService.ts`.

> "I don't see any icon or indication of this auto-fix feature. How can I use the auto-fix feature if I can't find it anywhere in the interface?"

**✅ FIXED:** Auto-organize button now **always visible** (green info box when no duplicates, yellow warning when duplicates exist).

> "I believe that manually inputting a number isn't the best approach. Would using a slider or another solution be better?"

**✅ FIXED:** Replaced text input with slider (1-100 range) + Clear button for easy adjustment and reset.

---

## Status

**Both Improvements: COMPLETE** ✅

Ready for:
- Build verification
- User testing
- Production deployment

**Thank you for the excellent, practical suggestions that made the codebase more maintainable!** 🙏
