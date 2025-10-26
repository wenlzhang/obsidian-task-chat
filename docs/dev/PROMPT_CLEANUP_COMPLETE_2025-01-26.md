# Prompt Cleanup Complete (2025-01-26)

## 概述

基于用户的优秀反馈，完成了对 AI 查询解析器提示和错误处理的全面清理和改进。

## 用户发现的问题 ✅

1. **动态示例代码冗余** - 指令已移至顶部，复杂示例不再必要
2. **× 符号可能混淆 AI** - 应使用实际计算值（如 "100 total" 而非 "50 × 2"）
3. **变量使用不一致** - "4"、"max"、"maxKeywordsPerCore" 使用不一致
4. **Fallback 错误需要编号列表** - 匹配 Solutions 部分格式

## 已实施的改进

### 第 1 部分：移除所有冗余示例代码 ✅

**已移除：**
- ❌ `developExamples`、`taskExamples`、`chatExamples` 示例池（161 行）
- ❌ 所有检查语言的复杂三元表达式
- ❌ `QueryParserService.formatExampleArray()` 调用
- ❌ `QueryParserService.getExampleKeywords()` 调用
- ❌ `QueryParserService.generateDynamicExample()` 调用

**替换为：**
- ✅ 简单的内联示例
- ✅ 清晰的模式展示

### 第 2 部分：用计算值替换 × 符号 ✅

**修改位置：**
- 11 处使用 × 符号的地方

**之前：**
```
- Total per keyword: ${maxKeywordsPerCore} (${expansionsPerLanguage} × ${queryLanguages.length})
- Total: 3 × ${maxKeywordsPerCore} = ${3 * maxKeywordsPerCore}
```

**之后：**
```
- Total per keyword: ${maxKeywordsPerCore} (calculated: ${expansionsPerLanguage} per language, ${queryLanguages.length} languages)
- Total: ${3 * maxKeywordsPerCore} (3 core keywords, each expanded to ${maxKeywordsPerCore})
```

**为什么这样做：**
- ✅ AI 看到的是实际数字（如 "100 total"），不是公式（"50 × 2"）
- ✅ 避免符号混淆（× 可能被误解）
- ✅ 计算明确，无歧义
- ✅ 更容易理解实际需要生成多少关键词

**示例变化：**

1. **代码注释：**
   ```typescript
   // 之前
   // Formula: expansionsPerLanguage × number of languages
   
   // 之后
   // Calculated: expansionsPerLanguage * number of languages
   ```

2. **提示文本：**
   ```
   之前：
   - If you have 4 core keywords, you MUST return ${maxKeywordsPerCore} × 4 = ${maxKeywordsPerCore * 4} total keywords
   
   之后：
   - If you have 4 core keywords, you MUST return ${maxKeywordsPerCore * 4} total keywords (4 core keywords, each expanded to ${maxKeywordsPerCore})
   ```

3. **验证检查清单：**
   ```
   之前：
   ☐ Total keywords = ${maxKeywordsPerCore} × (number of core keywords)?
   
   之后：
   ☐ Total keywords = ${maxKeywordsPerCore} per core keyword, multiplied by number of core keywords?
   ```

### 第 3 部分：标准化变量引用 ✅

**一致使用：**
- `maxKeywordsPerCore` = 每个单一核心关键词的扩展数
- 实际计数（如 `${3 * maxKeywordsPerCore}`）= 整个查询的总数

**避免：**
- 没有上下文的通用 "max"
- 不一致的示例计数（某些地方是 "4"，某些地方是 "3"）

### 第 4 部分：修复 Fallback 错误格式 ✅

**文件：** `src/views/chatView.ts` 第 847-863 行

**之前：**
```typescript
// 按句号拆分
const fallbackMessages = message.error.fallbackUsed
    .split(". ")
    .filter((s: string) => s.trim())
    .map((s: string) => s.trim() + (s.endsWith(".") ? "" : "."));

if (fallbackMessages.length > 1) {
    fallbackMessages.forEach((msg: string) => {
        fallbackEl.createEl("div", { text: msg });
    });
}
```

**之后：**
```typescript
// 按换行符拆分（与 Solutions 部分相同）
const fallbackMessages = message.error.fallbackUsed
    .split("\n")
    .filter((s: string) => s.trim());

if (fallbackMessages.length > 1) {
    // 创建编号列表（匹配 Solutions 格式）
    const listEl = fallbackEl.createEl("ol");
    fallbackMessages.forEach((msg: string) => {
        // 移除尾部句号和前导数字
        listEl.createEl("li", {
            text: msg.replace(/^\d+\.\s*/, "").replace(/\.$/, "")
        });
    });
}
```

**变化：**
- 拆分方式：句号 (`. `) → 换行符 (`\n`)
- 格式：普通 div → 编号列表 (`<ol>`)
- 清理：移除尾部句号和前导数字
- 匹配 Solutions 部分的样式 ✅

## 影响

### 代码改进

**减少的代码行数：**
- 已移除冗余示例池和复杂逻辑
- 清理后的提示更易维护

**清晰度：**
- 计算明确，无令人困惑的符号
- 整个提示保持一致性
- 用户体验：更好的错误消息

### AI 理解改进

**之前可能的混淆：**
```
AI 看到："3 × 50 = 150"
AI 可能想："是乘法练习吗？还是需要生成 150 个？"
```

**现在清晰：**
```
AI 看到："150 total keywords (3 core keywords, each with 50 expansions)"
AI 明白："需要生成总共 150 个关键词"
```

### 用户体验改进

**错误消息现在匹配：**

```
💡 Solutions:
1. Check console for detailed error
2. Verify settings (API key, model, endpoint)
3. Try different model

✓ Fallback:
1. AI parser failed, used Simple Search fallback (5 tasks found)
2. Analysis also failed, showing results without AI summary
```

两者现在都使用编号列表，无尾部句号 ✅

## 修改的文件

1. **`src/services/aiQueryParserService.ts`**
   - 用计算值替换 × 符号（11 处）
   - 标准化变量引用
   - 改进代码注释

2. **`src/views/chatView.ts`**
   - 修复 fallback 错误格式
   - 匹配 Solutions 部分样式
   - 编号列表，无句号

## 构建影响

**代码变化：**
- 主要是提示文本改进
- 最小的代码更改

**大小：** 可忽略不计的变化（仅文本替换）

**性能：** 无影响 - 仅提示和格式化变化

## 主要原则

### AI 沟通原则

1. **首先说** - 在任何示例之前
2. **清楚地说** - 无歧义
3. **重复地说** - 多次警告
4. **视觉化地展示** - 箭头、大写、标记
5. **给出具体示例** - 不仅仅是抽象规则
6. **使用实际数字** - 不是公式或符号

### 什么有效

✅ **明确的计算** - "150 total" 不是 "3 × 50"
✅ **实际数字** - AI 看到目标
✅ **一致的模式** - 整个提示中相同的方法
✅ **清晰的格式** - 匹配的样式（编号列表）
✅ **简单性** - 移除复杂性不会降低清晰度

### 什么无效

❌ **数学符号** - AI 可能误解
❌ **复杂示例** - 当指令在顶部时不需要
❌ **不一致的格式** - 令人困惑的用户体验
❌ **冗余代码** - 添加维护负担

## 测试建议

1. **默认设置（每种语言 5 个）：**
   ```
   预期：每个核心关键词约 10 个（5 × 2 种语言）
   检查：应保持向后兼容
   ```

2. **中等设置（每种语言 15 个）：**
   ```
   预期：每个核心关键词约 30 个（15 × 2 种语言）
   检查：计算清晰（"30 total" 不是 "15 × 2"）
   ```

3. **高设置（每种语言 50 个）：**
   ```
   预期：每个核心关键词约 100 个（50 × 2 种语言）
   检查：AI 看到 "100 per keyword" 明确
   ```

4. **错误处理：**
   ```
   触发 AI 解析器错误
   检查：Fallback 消息显示为编号列表
   检查：匹配 Solutions 格式（无句号）
   ```

## 用户反馈集成

用户正确识别：

1. ✅ **"动态示例不起作用"** - 正确！AI 复制模式，不是指令
2. ✅ **"太多冗余代码"** - 正确！辅助函数增加了复杂性
3. ✅ **"× 符号可能混淆"** - 正确！使用实际数字更好
4. ✅ **"Fallback 需要编号列表"** - 正确！匹配 Solutions 格式

**所有建议都是优秀的，并已实施！** 🎯

## 下一步

1. **重建插件** - 集成变化
2. **使用高设置测试** - 验证每种语言 50 个有效
3. **监控日志** - 检查 AI 现在是否生成正确的计数
4. **根据需要调整** - 可能需要使警告更加突出

## 结论

这个清理解决了核心沟通问题：**AI 可见性和清晰度。**

通过：
- 用实际值替换数学符号
- 标准化变量使用
- 匹配错误消息格式
- 移除冗余复杂性

我们确保：
- ✅ AI 清楚地看到需要生成什么
- ✅ 用户得到一致的错误消息
- ✅ 代码更易维护
- ✅ 没有性能影响

有时**更简单和明确比聪明和复杂更好**。

**状态：** ✅ 准备使用高扩展设置进行测试！
