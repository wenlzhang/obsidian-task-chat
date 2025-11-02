# Task Search Workflow Analysis - Document Index

This directory contains a comprehensive analysis of the Obsidian Task Chat plugin's task search pipeline.

## Documents

### 1. TASK_SEARCH_ANALYSIS.md (Primary Reference)
**664 lines | Complete Technical Documentation**

Main resource for understanding the task search architecture. Contains:
- Simple Search Mode workflow (Section 1)
- Keyword vs non-keyword search paths (Section 2)
- API-level filtering operations (Section 3)
- Comprehensive JS-level scoring (Section 4)
- Task limiting mechanisms (Section 5)
- Task attribute expansion (Section 6)
- Performance analysis (Section 7)
- Data flow diagrams (Section 8)
- File reference guide (Section 9)
- Optimization recommendations (Section 10)

**Best for**: Understanding complete pipeline, finding specific operations, performance analysis

### 2. TASK_SEARCH_VISUAL.txt (Quick Reference)
**200 lines | Visual Architecture**

Quick visual guide with:
- Stage-by-stage pipeline diagrams
- Filter ordering explanation (170x speedup insight!)
- Performance characteristics table
- Main bottleneck identification
- File quick reference

**Best for**: Getting oriented, understanding overall flow, performance comparisons

## Quick Answers

### Q: How does simple search mode work?
**File**: TASK_SEARCH_ANALYSIS.md → Section 1
**Files**: taskSearchService.ts (lines 748-824), aiService.ts (lines 99-126)

Simple Search uses regex-based query parsing (no AI). It removes property syntax positionally, extracts keywords with typo correction and stop word filtering, then extracts properties via regex patterns.

### Q: What's the difference between keyword and non-keyword searches?
**File**: TASK_SEARCH_ANALYSIS.md → Section 2
**Visual**: TASK_SEARCH_VISUAL.txt → Stage 2

Keyword searches apply full API-level filtering (property → relevance → quality → limiting).
Non-keyword searches apply only property filters at API level and skip relevance filtering.

### Q: Where is API-level filtering?
**File**: TASK_SEARCH_ANALYSIS.md → Section 3
**Location**: datacoreService.ts (lines 485-850+)

Four stages: Property filtering → Relevance filtering (VECTORIZED) → Quality filtering (VECTORIZED+CHUNKED) → Early limiting (VECTORIZED)

### Q: Where is comprehensive scoring?
**File**: TASK_SEARCH_ANALYSIS.md → Section 4
**Location**: taskSearchService.ts (lines 1273-1442)

Comprehensive scoring combines: Relevance + Due Date + Priority + Status components with user-configurable coefficients.

### Q: What are the bottlenecks?
**File**: TASK_SEARCH_ANALYSIS.md → Section 7
**Visual**: TASK_SEARCH_VISUAL.txt → "MAIN BOTTLENECK"

Critical: Non-keyword searches skip early limiting (datacoreService.ts line 740-741)
This causes unnecessary property extraction for all tasks instead of limiting first.

## Key Insights

1. **Filter Ordering is Critical**
   - Relevance filter applied FIRST (fast keyword matching)
   - Quality filter applied AFTER (slow property extraction)
   - Result: 170x performance improvement for keyword searches

2. **Score Caching Provides 50% Savings**
   - Scores calculated at API level during filtering
   - Cached in scoreCache map
   - JS-level scoring reuses cached values
   - Eliminates redundant calculations

3. **Vectorized Batch Processing**
   - 10-100x faster than traditional per-task scoring
   - Uses typed arrays (Float32Array) for native performance
   - Applied to: Relevance, Quality, Comprehensive scoring

4. **Non-Keyword Search Bottleneck**
   - Potential 30-50% improvement by applying early limiting
   - Currently: Property-only queries extract ALL tasks first
   - Proposed: Skip to comprehensive scoring if results > 500

## File Reference Quick Lookup

| Operation | File | Lines | Section |
|-----------|------|-------|---------|
| Query parsing | taskSearchService.ts | 748-824 | 1 |
| Keyword extraction | taskSearchService.ts | 139-181 | 1 |
| Property extraction | taskSearchService.ts | 217-567 | 1 |
| API selection | aiService.ts | 99-322 | 2 |
| Filter reload decision | aiService.ts | 324-676 | 2 |
| API-level filtering | datacoreService.ts | 485-850+ | 3 |
| Comprehensive scoring | taskSearchService.ts | 1273-1442 | 4 |
| Score caching | datacoreService.ts | 558-567, 786-799 | 3 |
| Vectorized operations | vectorizedScoring.ts | All | 7 |
| Task attributes | datacoreService.ts | 156-301 | 6 |

## Performance Summary

### Current Optimizations
- Vectorized batch processing: 10-100x faster
- Filter ordering: 170x faster for keyword searches
- Score caching: 50% fewer calculations
- Chunked processing: UI-responsive
- Early limiting: Avoids Task object creation

### Main Bottleneck
- Non-keyword searches: 30-50% improvement potential
- Issue: Skip early limiting when no keywords
- Impact: Full property extraction for all tasks
- Fix: Apply comprehensive scoring at API level even for property-only queries

## When to Reference Each Document

**TASK_SEARCH_ANALYSIS.md:**
- Understanding the complete architecture
- Finding exact line numbers for operations
- Reading detailed explanations
- Optimization recommendations
- Data flow examples

**TASK_SEARCH_VISUAL.txt:**
- Getting an overview of the pipeline
- Understanding performance gains
- Identifying bottlenecks visually
- Quick file references
- Performance characteristics comparison

## Related Code Files to Review

1. **Main Orchestrator**: src/services/ai/aiService.ts
2. **Query Parsing**: src/services/tasks/taskSearchService.ts
3. **API Filtering**: src/services/tasks/datacoreService.ts
4. **Scoring**: src/utils/vectorizedScoring.ts
5. **Settings**: src/settings.ts (for coefficients)

---

*Analysis completed: November 2, 2025*
*Branch: debug_delay_large*
*Based on: Codebase snapshot with current optimizations*
