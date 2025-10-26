# Testing Guide: Error Handling & Fallback Improvements

## Quick Verification Checklist

### ✅ Build & Compile
```bash
npm run build
# Expected: 0 TypeScript errors, ~102kb output
```

### ✅ Error Display in Chat UI

**Test 1: Context Length Error (Task Chat)**
1. Open settings → AI Provider → Max response tokens
2. Set to 10000 (very high)
3. In Task Chat mode, send a query
4. **Expected Result:**
   ```
   ⚠️ Context length exceeded
   
   Model: openai/gpt-4o-mini
   Error: Maximum context: 8192 tokens, but you requested: 10000 tokens
   
   💡 Solutions:
   1. Reduce 'Max response tokens' in settings (try 2000-4000)
   2. Clear chat history or start new session
   3. Switch to model with larger context window
   
   📖 Documentation: Troubleshooting Guide [clickable link]
   ```

**Test 2: Model Not Found (Smart Search)**
1. Open settings → AI Provider → Model
2. Enter invalid model name (e.g., "gpt-99-turbo")
3. In Smart Search mode, send a query
4. **Expected Result:**
   - Warning box appears in results
   - Shows "⚠️ AI Query Parser Failed"
   - Shows "✓ Using fallback: Simple Search mode"
   - Still displays filtered tasks

**Test 3: Invalid API Key (Task Chat)**
1. Open settings → AI Provider → API Key
2. Enter invalid key (e.g., "sk-invalid")
3. In Task Chat mode, send a query
4. **Expected Result:**
   - Error in chat UI
   - Shows "⚠️ Invalid or missing API key"
   - Lists solutions (check key, regenerate, verify provider)
   - Documentation link present

### ✅ Chat History Cleaning

**Test: Error Messages Not Sent to AI**
1. Trigger any error (e.g., invalid API key)
2. Error message appears in chat
3. Fix the issue (correct API key)
4. Send another query
5. **Expected Result:**
   - AI responds normally
   - AI does NOT mention previous error
   - Check console logs: "Skipping system error message"

**Verification in Console:**
```
[Chat History] Message 3: Skipping system error message (not sent to AI)
```

### ✅ Fallback Mechanisms

**Test 1: Simple Search (No Fallback)**
1. Switch to Simple Search mode
2. Send any query
3. **Expected Result:**
   - Always works (no AI dependency)
   - No error messages
   - Consistent results

**Test 2: Smart Search Fallback**
1. Set invalid model name
2. Switch to Smart Search mode
3. Send query: "urgent tasks"
4. **Expected Result:**
   - Warning: "⚠️ AI Query Parser Failed"
   - Message: "✓ Using fallback: Simple Search mode"
   - Tasks still displayed (filtered)
   - Console shows: "falling back to Simple Search module"

**Test 3: Task Chat Two-Tier Fallback**

**Tier 1 (Parser Failure):**
1. Set invalid model name
2. Switch to Task Chat mode
3. Send query
4. **Expected Result:**
   - Parser fails → Falls back to Simple Search
   - Tasks still filtered
   - Shows parser warning
   - AI analysis still attempted (if parser settings separate from analysis)

**Tier 2 (Analysis Failure):**
1. Set valid model but invalid API key
2. Switch to Task Chat mode
3. Send query
4. **Expected Result:**
   - Parser works (if using separate model)
   - Analysis fails → Shows error (NO fallback)
   - Structured error displayed
   - User must fix issue

### ✅ Terminology Verification

**Check Settings:**
1. Open settings → Query Parser → Semantic Expansion
2. Look for "Keyword expansions" slider
3. **Expected:** Description says "Variations per keyword per language"
4. Hover over slider
5. **Expected:** Tooltip shows current value (e.g., "5")

**Check Logs:**
1. Send query with Smart Search or Task Chat
2. Open console (Ctrl/Cmd + Shift + I)
3. Search for "expansionsPerLanguage"
4. **Expected:** Logs show "expansionsPerLanguage: 5" (not "maxExpansions")

### ✅ Error Types Coverage

Test each error type to verify proper handling:

**1. Context Length Exceeded**
- Set max tokens too high
- Expected: Shows token numbers, lists 3 solutions

**2. Model Not Found**
- Use invalid model name
- Expected: Shows model name, lists verification steps

**3. Invalid API Key**
- Use invalid key
- Expected: Shows authentication error, lists key check steps

**4. Rate Limit Exceeded**
- Make many rapid requests (or mock)
- Expected: Shows rate limit message, suggests waiting

**5. Server Error (500/503)**
- Mock or wait for provider outage
- Expected: Shows server error, suggests retry/alternative

**6. Connection Failed (Ollama)**
- Set provider to Ollama without running it
- Expected: Shows connection error, lists Ollama startup steps

### ✅ CSS Styling Verification

**Check Error Box Appearance:**
1. Trigger any API error
2. Error box should have:
   - ✅ Red left border
   - ✅ Light red background
   - ✅ Header in bold red text
   - ✅ Details in gray text
   - ✅ Solutions in secondary background box
   - ✅ Numbered list properly formatted
   - ✅ Documentation link in accent color
   - ✅ Link underlines on hover

**Theme Compatibility:**
1. Switch to dark theme
2. Trigger error
3. **Expected:** Colors adapt to theme

### ✅ Documentation Links

**Verify All Links Work:**
1. Trigger each error type
2. Click documentation link
3. **Expected:** Opens correct section in TROUBLESHOOTING.md

**Link Targets:**
- Context length → `#1-context-length-exceeded`
- Model not found → `#2-model-not-found`
- Invalid API key → `#3-invalid-api-key`
- Rate limit → `#4-rate-limit-exceeded`
- Server error → `#5-server-error-500503`
- Ollama connection → `#6-ollama-connection-failed`

## Common Issues During Testing

### Issue: Errors not showing in chat
**Cause:** Old cache  
**Fix:** Reload Obsidian (Ctrl/Cmd + R)

### Issue: Imports not found
**Cause:** Build needed  
**Fix:** Run `npm run build`

### Issue: TypeScript errors
**Cause:** Outdated node_modules  
**Fix:** `npm install` then `npm run build`

### Issue: Styling looks wrong
**Cause:** CSS not loaded  
**Fix:** Reload Obsidian, check styles.css updated

## Success Criteria

**All Tests Pass When:**
- ✅ Errors appear in chat UI (not just console)
- ✅ Solutions are specific and helpful
- ✅ Documentation links work
- ✅ Error messages filtered from AI context
- ✅ Fallbacks work for each mode
- ✅ Terminology uses `expansionsPerLanguage`
- ✅ CSS styling looks professional
- ✅ Theme compatibility works

## Performance Check

**Before Improvements:**
- Errors: Console only ❌
- Fallback: Unclear ❌
- Chat history: Polluted with errors ❌

**After Improvements:**
- Errors: Chat UI with solutions ✅
- Fallback: Clear indication ✅
- Chat history: Clean (filtered) ✅

**Size Impact:**
- Before: ~100kb
- After: ~102kb (+2kb)
- Acceptable overhead for better UX ✅

## Regression Testing

**Ensure Existing Features Still Work:**
1. ✅ Simple Search still works
2. ✅ Smart Search still works (when AI available)
3. ✅ Task Chat still works (when AI available)
4. ✅ Task reference replacement still works
5. ✅ Token usage tracking still works
6. ✅ Chat history still works
7. ✅ Session management still works

## Next Steps After Testing

1. **If all tests pass:**
   - Document any edge cases found
   - Update README with error handling section
   - Consider adding screenshots to docs

2. **If tests fail:**
   - Note which test failed
   - Check console for errors
   - Verify imports correct
   - Ensure build completed successfully

3. **User Feedback:**
   - Collect feedback on error message clarity
   - Refine solutions based on common issues
   - Add more error types if needed

## Quick Test Commands

```bash
# Build and verify
npm run build

# Check for TypeScript errors
npx tsc --noEmit

# Search for old terminology (should find none)
grep -r "maxKeywordExpansions" src/

# Search for correct imports (should find 2)
grep -r "import.*errorHandler" src/

# Check error handler exists
ls -lh src/utils/errorHandler.ts
```

## Final Verification

Run this checklist before considering testing complete:

- [ ] Build succeeds with 0 errors
- [ ] Context length error shows in UI
- [ ] Model not found error shows in UI
- [ ] API key error shows in UI
- [ ] Error messages filtered from AI context
- [ ] Simple Search works without AI
- [ ] Smart Search falls back properly
- [ ] Task Chat shows clear errors
- [ ] Documentation links work
- [ ] CSS styling looks good
- [ ] No old terminology in code
- [ ] All imports correct
- [ ] Performance acceptable

---

**When all tests pass, the improvements are ready for production! 🚀**
