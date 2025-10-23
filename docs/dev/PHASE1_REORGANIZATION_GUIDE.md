# Phase 1: Section Reorganization Guide

## Current vs New Structure

### New Target Order (with sentence case)
1. Understanding Settings (keep at top)
2. **AI provider** (keep as-is, update header to sentence case)
3. **Chat modes** (NEW: extract default mode + link from Chat section)
4. **Semantic search** (NEW: extract semantic expansion settings)
5. **Task chat** (NEW: extract chat-specific settings)
6. **DataView integration** (move up from position ~10)
7. **Status categories** (move up from position ~11)
8. **Task filtering** (NEW: rename "Stop words" section)
9. **Task scoring** (consolidate scoring sections)
10. **Task sorting** (move multi-criteria sorting)
11. **Task display** (move display settings)
12. **Advanced** (consolidate advanced settings)

### Current Section Locations (approximate line numbers)

1. Understanding Settings: ~31-97 ✅ Keep
2. AI provider: ~100-275 ✅ Keep position, update header
3. Chat: ~277-605 → **SPLIT INTO 3 SECTIONS**
   - Chat modes (default mode): Extract ~368-398
   - Semantic search: Extract ~400-522
   - Task chat: Extract remaining chat settings
4. Stop words: ~616-658 → **RENAME to "Task filtering"**
5. Task display: ~659-729 → Move to position 11
6. Scoring coefficients: ~732-899 → Move to position 9
7. Advanced scoring: ~904-1330 → Merge with scoring (position 9)
8. Advanced: ~1332-1358 → Move to position 12
9. DataView: ~1360-1452 → Move to position 6
10. Priority mapping: ~1455-1561 → Remove or merge
11. Status categories: ~1563-2025 → Move to position 7
12. Pricing/Usage: ~1839-2025 → Merge with Advanced
13. Multi-criteria sorting: ~2644-2782 → Move to position 10

## Implementation Strategy

Given the file size (2729 lines), we'll use a phased approach:

### Step 1: Update All Section Headers to Sentence Case
- Easy global changes
- No content movement
- Sets foundation

### Step 2: Split "Chat" Section into 3 Sections
- Chat modes
- Semantic search  
- Task chat

### Step 3: Reorganize Major Sections
- Move DataView up
- Move Status categories up
- Rename Stop words
- Move Task display down
- Consolidate Scoring
- Move Sorting
- Consolidate Advanced

## Detailed Mapping

### Section 2: AI provider ✅
**Current:** Lines ~100-275
**Action:** Keep position, change header
**Header:** `containerEl.createEl("h3", { text: "AI provider" });`

### Section 3: Chat modes (NEW)
**Extract from:** Chat section (~368-398)
**Content:**
- Default chat mode dropdown
- Mode comparison link (already added)
**Header:** `new Setting(containerEl).setName("Chat modes").setHeading();`

### Section 4: Semantic search (NEW)
**Extract from:** Chat section (~400-522)
**Content:**
- Query languages
- Enable semantic expansion
- Max keyword expansions
- Custom property terms
**Header:** `new Setting(containerEl).setName("Semantic search").setHeading();`

### Section 5: Task chat (NEW)
**Extract from:** Chat section (remaining)
**Content:**
- Max chat history
- Show task count
- Auto-open sidebar
- Show token usage
- Response language
- Show AI understanding
- Enable streaming
**Header:** `new Setting(containerEl).setName("Task chat").setHeading();`

### Section 6: DataView integration
**Current:** Lines ~1360-1452
**Move to:** After Task chat
**Header:** `new Setting(containerEl).setName("DataView integration").setHeading();`

### Section 7: Status categories
**Current:** Lines ~1563-2025
**Move to:** After DataView
**Keep header:** Already correct

### Section 8: Task filtering
**Current:** Lines ~616-658 ("Stop words")
**Rename to:** "Task filtering"
**Header:** `new Setting(containerEl).setName("Task filtering").setHeading();`

### Section 9: Task scoring
**Consolidate:**
- Scoring coefficients (~732-899)
- Advanced scoring (~904-1330)
**Header:** `new Setting(containerEl).setName("Task scoring").setHeading();`

### Section 10: Task sorting
**Current:** Lines ~2644-2782
**Move to:** After Task scoring
**Header:** Already "Multi-criteria sorting" - keep or change to "Task sorting"?

### Section 11: Task display
**Current:** Lines ~659-729
**Move to:** After Task sorting
**Header:** `new Setting(containerEl).setName("Task display").setHeading();`

### Section 12: Advanced
**Consolidate:**
- Advanced section (~1332-1358)
- Pricing data (~1839-1895)
- Usage statistics (~1896-2025)
**Header:** `new Setting(containerEl).setName("Advanced").setHeading();`

## Notes

- Priority mapping section (~1455-1561) may need to be kept or removed
- All headers should use `.setHeading()` method
- Sentence case for all section names
- Keep "Understanding Settings" overview at top
- Keep all functionality intact

## Ready to Implement

This guide provides the roadmap for reorganization. Implementation will be done carefully to avoid breaking anything.
