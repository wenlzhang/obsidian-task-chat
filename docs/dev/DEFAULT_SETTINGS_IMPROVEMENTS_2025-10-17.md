# Default Settings Improvements (2025-10-17)

## Summary

Improved default configuration values for better out-of-box experience:
1. ✅ Priority field name: `priority` → `p`
2. ✅ Relevance threshold: `0` (adaptive) → `30` (balanced)
3. ✅ Default sort: `dueDate` → `auto` (mode-aware)
4. ✅ Priority mapping: Consistent 3 values per level
5. ✅ Updated documentation and help text

---

## Changes Made

### 1. Priority Field Name

**Change**: `priority` → `p`

**Location**: `src/settings.ts`

```typescript
// Before:
dataviewKeys: {
    priority: "priority",
}

// After:
dataviewKeys: {
    priority: "p",
}
```

**Rationale**: 
- Shorter, more concise field name
- Common convention in task management (Todoist uses `p`)
- Easier to type: `[p::1]` vs `[priority::1]`

**Impact**: Users will need to use `[p::1]` format for priority metadata

---

### 2. Relevance Threshold

**Change**: `0` (adaptive) → `30` (balanced)

**Location**: `src/settings.ts`

```typescript
// Before:
relevanceThreshold: 0, // 0 = adaptive (recommended), 1-100 = fixed threshold

// After:
relevanceThreshold: 30, // Minimum relevance score (0-100). Lower = more results. 0 = adaptive.
```

**Rationale**:
- **Better defaults**: 30 provides good balance for most users
- **Adaptive still available**: Users can set to 0 for adaptive behavior
- **More predictable**: Fixed threshold easier to understand than adaptive
- **Easy to tune**: Users can adjust based on their needs

**Impact**: All modes use relevance threshold of 30 by default

**Settings Tab Description** (Updated):
> Quality filter for keyword searches (0-100). Filters out low-quality matches in all modes. Default: 30 (balanced). Set to 0 for adaptive thresholds (4+ keywords=20, 2-3 keywords=30, 1 keyword=40). Lower = more results (lenient), Higher = fewer results (strict). Fine-tune based on your needs to get the right balance between quantity and quality.

---

### 3. Default Sort Mode

**Change**: `dueDate` → `auto`

**Location**: `src/settings.ts`

```typescript
// Before:
taskSortBy: "dueDate", // Current sort setting

// After:
taskSortBy: "auto", // Default sort: auto (Task Chat), relevance (Simple/Smart)
```

**Rationale**:
- **Mode-aware**: "Auto" works best for Task Chat mode (AI-driven)
- **Smart fallback**: Falls back to relevance for Simple/Smart Search
- **Flexible**: Users can override in settings or per-query

**Recommended Defaults by Mode**:
| Mode | Recommended Sort | Reason |
|------|------------------|--------|
| Task Chat | `auto` | AI-driven, context-aware sorting |
| Simple Search | `relevance` | Best-match-first for keyword searches |
| Smart Search | `relevance` | Best-match-first for keyword searches |

**Settings Tab Description** (Updated):

**For Task Chat Mode**:
> Display order for results (applied AFTER quality filtering). Default: "Auto" (recommended for Task Chat mode). "Auto" = AI-driven sorting. "Relevance" = best-match-first order. Other options = sort by that field.

**For Simple/Smart Search**:
> Display order for results (applied AFTER quality filtering). Default: "Relevance" (recommended for Simple/Smart Search). "Relevance" = best-match-first order (keyword searches only). Other options work for all queries.

---

### 4. Priority Mapping

**Change**: Consistent 3 values per priority level

**Location**: `src/settings.ts`

```typescript
// Before:
dataviewPriorityMapping: {
    1: ["1", "p1", "high", "highest"],  // 4 values
    2: ["2", "p2", "medium", "med"],    // 4 values
    3: ["3", "p3", "low"],              // 3 values
    4: ["4", "p4", "none"],             // 3 values
}

// After:
dataviewPriorityMapping: {
    1: ["1", "p1", "high"],             // 3 values
    2: ["2", "p2", "medium"],           // 3 values
    3: ["3", "p3", "low"],              // 3 values
    4: ["4", "p4", "none"],             // 3 values
}
```

**Rationale**:
- **Consistency**: All levels now have same number of default values
- **Cleaner**: Removed redundant values (`highest`, `med`)
- **Extensible**: Users can still add their own values
- **Clear hierarchy**: 1=high, 2=medium, 3=low, 4=none

**Default Values**:
- **Level 1 (Highest)**: `1, p1, high`
- **Level 2 (High)**: `2, p2, medium`
- **Level 3 (Medium/Low)**: `3, p3, low`
- **Level 4 (None)**: `4, p4, none`

---

## Documentation Updates

### README.md

#### 1. Priority Field
```markdown
- **Priority Field**: Default is `p`
```

#### 2. Sorting Options
```markdown
### 🎯 Task Display & Sorting
- **Flexible Sorting Options**:
  - **Auto (AI Context-Aware)** - Recommended for Task Chat mode
  - **Relevance** - Recommended for Simple/Smart Search modes
  - Default: Auto (adjusts based on your chat mode)
```

#### 3. Priority Mapping
```markdown
**Priority Mapping** (Customizable, Todoist-style)
Map text values to numeric priority levels (1-4):
- **Level 1 (Highest)**: Default: `1, p1, high`
- **Level 2 (High)**: Default: `2, p2, medium`
- **Level 3 (Medium/Low)**: Default: `3, p3, low`
- **Level 4 (None)**: Default: `4, p4, none`
```

#### 4. Troubleshooting
```markdown
**Getting too few results?**
- Try lowering from 30 to 15-20
- Advanced: Set to 0 for adaptive thresholds

**Getting too many irrelevant results?**
- Try raising from 30 to 40-50
```

---

## Settings Tab Improvements

### Relevance Threshold
- **Updated description**: Mentions default value of 30
- **Clearer guidance**: Explains how to fine-tune
- **User-friendly**: Explains what lower/higher means

### Sort By
- **Mode-aware descriptions**: Different text for Task Chat vs Simple/Smart
- **Mentions defaults**: States recommended sort for each mode
- **Clearer instructions**: Explains when to use each option

---

## Migration Considerations

### For Existing Users

**No Migration Needed** (development phase):
- Settings structure unchanged
- Existing `priority` fields will work
- Users with `relevanceThreshold: 0` keep adaptive behavior
- Users with custom `taskSortBy` keep their preference

### For New Users

**Better First Experience**:
- Priority field `p` is shorter, more intuitive
- Relevance threshold `30` provides good balance
- Sort mode `auto` adapts to their chat mode
- Consistent priority values are easier to understand

---

## User Benefits

### 1. **Shorter Priority Syntax**
```markdown
Old: [priority::1]
New: [p::1]
```
Saves typing, matches common conventions.

### 2. **Predictable Results**
- Threshold `30` is consistent across queries
- Users know what to expect
- Easy to adjust if needed

### 3. **Mode-Aware Sorting**
- Task Chat users get AI-driven sorting by default
- Simple/Smart users get relevance sorting by default
- Optimal experience for each mode

### 4. **Consistent Priority Mapping**
- All levels have 3 default values
- Clean, balanced defaults
- Easy to remember and extend

---

## Testing Checklist

### Priority Field
- [ ] Tasks with `[p::1]` are recognized as priority 1
- [ ] Tasks with `[p::high]` are recognized as priority 1
- [ ] Priority filtering works correctly
- [ ] Priority sorting works correctly

### Relevance Threshold
- [ ] Default value is 30
- [ ] Setting to 0 enables adaptive behavior
- [ ] Slider works (0-100, step 5)
- [ ] Results filtered correctly at threshold 30

### Sort Mode
- [ ] Default is "auto"
- [ ] Task Chat mode shows "Auto" option
- [ ] Simple/Smart modes hide "Auto" option
- [ ] Fallback to "relevance" works when auto not available

### Priority Mapping
- [ ] All values recognized correctly
- [ ] Consistent 3 values per level
- [ ] Users can add custom values
- [ ] Multilingual values work

---

## Files Modified

| File | Changes |
|------|---------|
| `src/settings.ts` | Priority field `p`, threshold `30`, sort `auto`, mapping consistency |
| `src/settingsTab.ts` | Updated descriptions for threshold and sort |
| `README.md` | Updated defaults, priority mapping, troubleshooting |

---

## Summary of Defaults

### Before
| Setting | Old Value | Issues |
|---------|-----------|--------|
| Priority field | `priority` | Long, verbose |
| Relevance threshold | `0` (adaptive) | Unpredictable for beginners |
| Sort mode | `dueDate` | Not optimal for any mode |
| Priority mapping | 4/4/3/3 values | Inconsistent |

### After
| Setting | New Value | Benefits |
|---------|-----------|----------|
| Priority field | `p` | Short, concise, conventional |
| Relevance threshold | `30` | Balanced, predictable, tunable |
| Sort mode | `auto` | Mode-aware, intelligent |
| Priority mapping | 3/3/3/3 values | Consistent, clean |

---

## Conclusion

✅ **Build Status**: SUCCESS  
✅ **Defaults Improved**: 4 key settings optimized  
✅ **Documentation Updated**: README and settings help text  
✅ **User Experience**: Better out-of-box experience  

These improvements make the plugin more intuitive for new users while maintaining flexibility for advanced users to customize based on their needs.

**Recommendation**: Test with fresh install to verify new user experience.
