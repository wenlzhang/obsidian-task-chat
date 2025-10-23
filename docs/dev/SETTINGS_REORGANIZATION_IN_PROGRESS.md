# Settings Tab Reorganization - In Progress

## Status: READY TO IMPLEMENT

All documentation files created. Ready to reorganize settingsTab.ts.

## Implementation Approach

Due to the large size (2960 lines), I'll implement this in multiple commits:

### Commit 1: Section Reordering (NEXT)
- Reorder existing sections to match new structure
- Update section headers to use sentence case
- Use `.setHeading()` consistently
- No content changes yet

### Commit 2: Text Reduction
- Shorten verbose descriptions
- Add documentation links
- Remove redundant info boxes
- Keep essential info boxes

### Commit 3: Tag-Based Sorting UI
- Implement visual tag interface
- Add CSS styling
- Replace text input

### Commit 4: Collapsible Sections
- Add collapsible advanced options
- Implement toggle buttons

### Commit 5: Final Polish
- Test all functionality
- Verify links
- Build and verify

## New Section Structure

```
1. AI provider          (Keep as-is)
2. Chat modes           (New: simplified from "Chat")
3. Semantic search      (New: consolidate AI features)
4. Task chat            (New: chat-specific settings)
5. DataView integration (Move up)
6. Status categories    (Move up, reduce text)
7. Task filtering       (New: stop words standalone)
8. Task scoring         (Consolidate scoring)
9. Task sorting         (Add tag-based UI)
10. Task display        (Simplified)
11. Advanced            (System prompt, pricing, stats)
```

## Section Names (Sentence Case)

- "AI provider" (not "AI Provider")
- "Chat modes" (not "Chat Modes")
- "Semantic search" (not "Semantic Search")
- "Task chat" (not "Task Chat")
- "DataView integration" (not "DataView Integration")
- "Status categories" (not "Status Categories")
- "Task filtering" (not "Task Filtering")
- "Task scoring" (not "Task Scoring")
- "Task sorting" (not "Task Sorting")
- "Task display" (not "Task Display")
- "Advanced" (not "Advanced Settings")

## Documentation Files Created

✅ `/docs/SEARCH_MODES.md` - Chat mode comparison
✅ `/docs/SEMANTIC_EXPANSION.md` - AI query features
✅ `/docs/SCORING_SYSTEM.md` - Scoring formula details
✅ `/docs/SORTING_SYSTEM.md` - Multi-criteria sorting
✅ `/docs/STATUS_CATEGORIES.md` - Status guide

## Next Steps

1. Start with Commit 1: Reorder sections
2. Test after each commit
3. Build and verify
4. Continue with subsequent commits

## Estimated Time

- Commit 1: 1-2 hours
- Commit 2: 1 hour
- Commit 3: 1 hour
- Commit 4: 30 min
- Commit 5: 1 hour
- **Total: 4-5 hours**

## Ready to Begin

All planning complete. Documentation ready. Starting implementation now.
