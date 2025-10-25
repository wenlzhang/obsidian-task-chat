# Remaining Prompt Optimization Plan

**Date**: 2025-01-25  
**Status**: Phase 1 Complete ✅, Phases 2-4 Pending

## Phase 1: aiQueryParserService.ts ✅ COMPLETE

**Status**: Optimized by user (manual cleanup)
- **Before**: 2216 lines
- **After**: 1200 lines  
- **Reduction**: 47% (1016 lines removed)
- **Result**: Clean, streamlined query parser prompt maintaining all features

---

## Phase 2: aiPromptBuilderService.ts 📋 PENDING

**Current**: 545 lines  
**Target**: ~350 lines (~36% reduction)

### Files to Optimize:

#### Method: `buildPropertyTermGuidance()` (Lines 459-542)
**Current**: 84 lines  
**Issues**:
- Three-layer system explanation is verbose
- Repetitive examples
- Long term lists could be summarized

**Optimization**:
- Consolidate layer explanations (reduce from 50 lines to 25 lines)
- Streamline examples
- Keep all functionality, user settings, and term lists
- **Target**: ~40 lines

#### Method: `buildStatusMapping()` (Lines 150-259)
**Current**: 110 lines  
**Issues**:
- Verbose terminology clarification
- Repetitive recognition examples
- Multiple "IMPORTANT" sections

**Optimization**:
- Consolidate terminology section
- Reduce duplicate examples
- Keep all user settings and mappings
- **Target**: ~65 lines

#### Method: `buildSortOrderExplanation()` (Lines 280-375)
**Current**: 96 lines  
**Issues**:
- Repetitive sort criteria descriptions
- Verbose implications section

**Optimization**:
- Streamline criteria explanations
- Consolidate implications
- Keep all functionality
- **Target**: ~55 lines

#### Method: `buildMetadataGuidance()` (Lines 381-446)
**Current**: 66 lines  
**Issues**:
- Verbose raw Dataview syntax explanation
- Repetitive field descriptions

**Optimization**:
- Consolidate syntax explanation
- Streamline field reference
- **Target**: ~40 lines

#### Methods to Keep As-Is:
- `buildPriorityMapping()` (22 lines) - Concise ✅
- `buildPriorityMappingForParser()` (44 lines) - Good structure ✅
- `buildDateFormats()` (7 lines) - Minimal ✅
- `buildDateFieldNamesForParser()` (14 lines) - Concise ✅
- `buildRecommendationLimits()` (9 lines) - Perfect ✅

**Total Reduction**: ~195 lines → keep functionality, remove verbosity

---

## Phase 3: aiPropertyPromptService.ts 📋 PENDING

**Current**: 144 lines  
**Target**: ~120 lines (~17% reduction)

### Files to Optimize:

#### Method: `buildDueDateValueMapping()` (Lines 53-84)
**Current**: 32 lines  
**Issues**:
- Verbose KEY DISTINCTION section
- Examples could be more concise

**Optimization**:
- Streamline distinction explanation
- Consolidate examples
- **Target**: ~20 lines

#### Method: `buildStatusValueMapping()` (Lines 91-144)
**Current**: 54 lines  
**Issues**:
- Some redundancy with promptBuilder's status mapping

**Optimization**:
- Remove duplicate explanations
- Keep dynamic status generation
- **Target**: ~40 lines

**Note**: This file is relatively small and well-structured. Main optimization is removing redundancy.

---

## Phase 4: aiService.ts Task Analysis Prompt 📋 PENDING

**Current**: Lines 1162-1249 = 88 lines  
**Target**: ~55 lines (~38% reduction)

### Section to Optimize:

#### System Prompt Construction (Lines 1166-1249)
**Issues**:
- Multiple "CRITICAL" warnings are repetitive
- [TASK_X] ID explanation is verbose (36 lines, could be 15 lines)
- Some redundant instructions about not listing tasks

**Optimization**:
- Consolidate CRITICAL warnings (reduce from 5 sections to 2)
- Streamline [TASK_X] ID explanation (keep examples, reduce verbiage)
- Remove redundant instructions
- Keep all:
  - User settings integration
  - Filter context
  - Sort order explanation
  - Metadata guidance
  - Recommendation limits

**Sections to Keep**:
- Language instruction ✅
- Priority/date/status mappings ✅  
- Metadata guidance ✅
- Recommendation limits ✅
- Sort order explanation ✅

**Target Structure**:
```
1. Critical rules (10 lines, down from 25)
2. Task reference format (15 lines, down from 36)
3. Query understanding (5 lines, down from 7)
4. User settings integration (calls to PromptBuilder methods)
```

---

## Summary of Expected Improvements

| File | Current | Target | Reduction | Status |
|------|---------|--------|-----------|--------|
| aiQueryParserService.ts | 2216 | 1200 | 47% | ✅ Complete |
| aiPromptBuilderService.ts | 545 | ~350 | 36% | 📋 Pending |
| aiPropertyPromptService.ts | 144 | ~120 | 17% | 📋 Pending |
| aiService.ts (prompt) | 88 | ~55 | 38% | 📋 Pending |
| **TOTAL** | **2993** | **~1725** | **42%** | **1/4 Done** |

---

## Optimization Principles (Same as Phase 1)

✅ **KEEP**:
- All user settings integration
- All functionality
- All features
- All specifications
- Complete feature parity

✨ **IMPROVE**:
- Remove verbosity
- Consolidate repetitive sections
- Streamline examples
- Clearer structure
- More concise language

❌ **AVOID**:
- Removing features
- Changing functionality
- Breaking existing behavior
- Compromising user settings

---

## Next Steps

1. ✅ **Phase 1**: aiQueryParserService.ts optimization (COMPLETE)
2. 📋 **Phase 2**: Optimize aiPromptBuilderService.ts methods
3. 📋 **Phase 3**: Optimize aiPropertyPromptService.ts methods  
4. 📋 **Phase 4**: Optimize aiService.ts task analysis prompt
5. 🧪 **Phase 5**: Test all optimizations maintain feature parity

**Expected Timeline**: Phases 2-4 can be done systematically, one method at a time, ensuring each optimization maintains complete functionality while reducing verbosity.

**Testing Strategy**: After each phase, verify:
- All user settings still respected
- All features still work
- Prompts are clearer and more concise
- AI responses maintain quality
