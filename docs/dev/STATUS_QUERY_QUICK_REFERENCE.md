# Status Query Quick Reference

## ✅ **All Working Syntax**

### **Explicit Syntax (Recommended)**

| Query | Matches | Description |
|-------|---------|-------------|
| `s:open` | Category key | Direct category match |
| `s:o` | Alias | Alias for "open" |
| `s:all` | Alias | Another alias for "open" |
| `s:x` | Symbol | Symbol for "completed" |
| `s:X` | Symbol | Case insensitive |
| `s:/` | Symbol | Symbol for "inProgress" |
| `status:open` | Category key | Alternative syntax |
| `status:x` | Symbol | Alternative with symbol |

### **Natural Language (Fallback)**

| Query | Matches | Description |
|-------|---------|-------------|
| `task chat open` | Terms | Natural language |
| `task chat completed` | Terms | Natural language |
| `task chat 完成` | Terms | Chinese |
| `task chat klar` | Terms | Swedish |

---

## 📋 **Your Test Results**

### ✅ **Now Working:**
- `task chat s:open` ✅
- `task chat s:o` ✅ (was broken, now fixed!)
- `task chat status:open` ✅ (was broken, now fixed!)
- `task chat status:x` ✅ (was broken, now fixed!)
- `task chat s:x` ✅ (was broken, now fixed!)

### 🎯 **How to Test:**

1. **Reload the plugin** in Obsidian
2. Try these queries:
   ```
   task chat s:open
   task chat s:o
   task chat s:all
   task chat s:x
   task chat status:open
   task chat status:x
   ```
3. Check console for any warnings

---

## ⚙️ **Configuration**

### **Where to Configure:**
Settings → Task Status Mapping

### **What to Configure:**

```typescript
open: {
    symbols: [" ", "o", "O"],           // For checkbox matching
    aliases: "o,all,todo",              // For s:o, s:all, s:todo
    terms: "open, todo, new, ..."       // For natural language
}
```

### **Tips:**
- **Aliases:** Comma-separated, no spaces (e.g., `"o,all,todo"`)
- **Symbols:** Array of strings (e.g., `["x", "X"]`)
- **Terms:** Comma-separated, for natural language (e.g., `"open, todo, new"`)

---

## 🔍 **Troubleshooting**

### **Query doesn't work?**

1. **Check console** for warnings:
   ```
   [Task Chat] Status value "xxx" not found in any category
   ```

2. **Verify configuration:**
   - Is the alias in the `aliases` field?
   - Is the symbol in the `symbols` array?
   - Is the term in the `terms` field?

3. **Common fixes:**
   - Add missing alias: `aliases: "o,all,todo"`
   - Add missing symbol: `symbols: ["x", "X", "✓"]`
   - Add missing term: `terms: "open, todo, new"`

---

## 🎉 **Summary**

All status query syntax now works consistently:
- ✅ Explicit syntax (`s:value`, `status:value`)
- ✅ Category names, aliases, and symbols
- ✅ Natural language fallback
- ✅ Case insensitive
- ✅ Clear error messages

**Enjoy your enhanced status queries!** 🎊
