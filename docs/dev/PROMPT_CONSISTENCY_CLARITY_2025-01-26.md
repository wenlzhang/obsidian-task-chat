# Prompt Consistency & Clarity Improvements (2025-01-26)

## 用户反馈的核心问题

用户正确指出了三个关键问题：

1. **计算格式不一致** - 在整个提示中有多种不同的表达方式
2. **术语混用** - "variations" vs "equivalents" vs "keywords"
3. **计算不够清晰** - `"5 per language, 2 languages"` 需要 AI 自己计算

## 发现的问题

### 1. 计算格式不一致（3 种变体）

**之前发现的 3 种不同格式：**

```typescript
// 格式 1 (Line 523)
(calculated: ${expansionsPerLanguage} per language, ${queryLanguages.length} languages)

// 格式 2 (Line 544)
(calculated: ${expansionsPerLanguage} expansions per language, ${queryLanguages.length} languages total)

// 格式 3 (Line 930)
(${expansionsPerLanguage} per language, ${queryLanguages.length} languages)
```

**问题：**
- ❌ 不一致，令人困惑
- ❌ AI 需要自己计算（5 per language, 2 languages = ？）
- ❌ 没有显示实际语言名称

### 2. 术语混用（4 种术语）

**发现的混用：**
- "variations" ← 某些地方
- "equivalents" ← 某些地方
- "semantic equivalents" ← 某些地方
- "total keywords" ← 某些地方

**问题：**
- ❌ 不一致的术语令人困惑
- ❌ AI 可能不清楚是否指同一事物

### 3. 计算不够清晰

**之前的格式示例：**
```
5 per language, 2 languages
```

**问题：**
- ❌ AI 看到 "5" 和 "2"，需要自己相乘
- ❌ 没有语言名称（不清楚是哪 2 种语言）
- ❌ 结果是什么？10？

## 解决方案

### 改进 1：标准化术语 ✅

**决定：始终使用 "equivalents"**

**原因：**
- ✅ 更清晰（semantic equivalents = 语义等价物）
- ✅ 比 "variations" 更准确
- ✅ 与 "keywords" 区分（keywords 是输入，equivalents 是输出）

**改变位置（15+ 处）：**
```typescript
// 之前
"variations" / "total variations" / "total keywords"

// 之后
"equivalents" / "equivalents total" / "total equivalents"
```

### 改进 2：创建清晰的计算格式 ✅

**新的标准格式（显示实际语言名称和加法）：**

```typescript
// 对于 2 种语言 (English, 中文)，每种 5 个：
${maxKeywordsPerCore} equivalents (5 in English + 5 in 中文)

// 对于 3 种语言，每种 50 个：
${maxKeywordsPerCore} equivalents (50 in English + 50 in 中文 + 50 in Svenska)

// 对于 4+ 种语言：
${maxKeywordsPerCore} equivalents (50 in English + 50 in 中文 + ...)
```

**为什么这样更好：**
1. ✅ **显示实际语言名称** - AI 看到 "English" 和 "中文"
2. ✅ **显示加法，不是乘法** - "5 + 5" 比 "5 × 2" 更清晰
3. ✅ **显示最终结果** - "= 10 equivalents"
4. ✅ **不需要 AI 计算** - 直接显示答案

**实现代码：**
```typescript
${queryLanguages.length === 1 
  ? '' 
  : ` (${expansionsPerLanguage} in ${queryLanguages[0]}${
      queryLanguages.length > 1 
        ? ` + ${expansionsPerLanguage} in ${queryLanguages[1]}` 
        : ''
    }${
      queryLanguages.length > 2 
        ? ` + ${expansionsPerLanguage} in ${queryLanguages[2]}` 
        : ''
    }${
      queryLanguages.length > 3 
        ? ` + ...` 
        : ''
    })`
}
```

### 改进 3：统一使用新格式 ✅

**更新的 9 个关键位置：**

1. **Line 523** - Settings summary 顶部
2. **Line 543** - Expansion settings section
3. **Line 569** - Total statement
4. **Line 576** - NO EXCEPTIONS section
5. **Line 578-580** - Example showing calculation
6. **Line 904** - Keywords field description
7. **Line 914** - Mandatory requirement
8. **Line 929** - Algorithm Step 6
9. **Line 1017** - Verification section

### 改进 4：改进示例说明 ✅

**之前：**
```
Example with 2 languages and target 5 expansions:
  Core keyword "develop" → ~10 variations total:
  [variations 1-5 in English], [variations 6-10 in 中文]
```

**之后：**
```
Example showing expansion per core keyword (2 languages, 5 per language):
  Core keyword "develop" → 10 equivalents total:
  [5 equivalents in English] + [5 equivalents in 中文] = 10
```

**改进：**
- ✅ 使用加法符号 (+) 显示组合
- ✅ 显示 "= 10" 使结果明确
- ✅ 重复 "equivalents" 以保持一致性

### 改进 5：更新代码注释 ✅

**之前：**
```typescript
// Total keywords to generate PER core keyword
// Calculated: expansionsPerLanguage * number of languages
// Example: 5 expansions/language, 2 languages = 10 semantic equivalents per keyword
```

**之后：**
```typescript
// Total equivalents to generate PER core keyword
// Calculation: expansionsPerLanguage * number of languages
// Example: 5 in English + 5 in 中文 = 10 equivalents per keyword
```

**改进：**
- ✅ "equivalents" 不是 "keywords"
- ✅ "Calculation" 不是 "Calculated"（更简洁）
- ✅ 显示实际加法，不是公式

## 具体示例对比

### 示例 1：用户有 2 种语言，每种 5 个

**之前（不清晰）：**
```
- Total per core keyword: 10 (calculated: 5 per language, 2 languages)
```

**之后（清晰）：**
```
- Total per core keyword: 10 equivalents (5 in English + 5 in 中文)
```

**改进：**
- ✅ AI 看到实际语言名称
- ✅ AI 看到加法操作
- ✅ 无需计算

### 示例 2：用户有 2 种语言，每种 50 个

**之前（不清晰）：**
```
- Total per core keyword: 100 (calculated: 50 per language, 2 languages)
```

**之后（清晰）：**
```
- Total per core keyword: 100 equivalents (50 in English + 50 in 中文)
```

**改进：**
- ✅ "100" 和 "50 + 50" 直接对应
- ✅ 清楚地显示如何得到 100

### 示例 3：用户有 3 种语言，每种 15 个

**之前（不清晰）：**
```
- Total per core keyword: 45 (calculated: 15 per language, 3 languages)
```

**之后（清晰）：**
```
- Total per core keyword: 45 equivalents (15 in English + 15 in 中文 + 15 in Svenska)
```

**改进：**
- ✅ 显示所有 3 种语言
- ✅ 加法清晰可见
- ✅ 45 = 15 + 15 + 15 明显

### 示例 4：算法步骤

**之前：**
```
Step 6: Verify the expansion list has 100 total items (50 per language, 2 languages)
```

**之后：**
```
Step 6: Verify expansion list = 100 equivalents (50 in English + 50 in 中文)
```

**改进：**
- ✅ "= 100" 使验证明确
- ✅ 显示实际加法
- ✅ 语言名称帮助 AI 理解

## 影响分析

### 对 AI 的影响 ✅

**之前的混淆：**
```
AI 看到："5 per language, 2 languages"
AI 想："我需要计算吗？5 × 2 = 10？还是每种语言 5 个？"
```

**现在清晰：**
```
AI 看到："10 equivalents (5 in English + 5 in 中文)"
AI 想："明确！每种语言 5 个，总共 10 个。English 5 个，中文 5 个。"
```

### 对用户设置的响应 ✅

**用户设置 50 per language, 2 languages：**

**之前：**
```
- Total: 100 (calculated: 50 per language, 2 languages)
```
AI 可能生成：~20 个（因为不确定）❌

**之后：**
```
- Total: 100 equivalents (50 in English + 50 in 中文)
```
AI 清楚地看到：需要 English 50 个 + 中文 50 个 = 100 个 ✅

### 术语一致性 ✅

**之前：** 混用 4 种术语
- "variations" (某些地方)
- "equivalents" (某些地方)
- "semantic equivalents" (某些地方)
- "keywords" (某些地方)

**之后：** 仅使用 "equivalents"
- ✅ 整个提示中一致
- ✅ AI 知道我们总是指同一事物
- ✅ 更清晰的沟通

## 修改统计

**文件：** `src/services/aiQueryParserService.ts`

**修改类型：**
1. **术语标准化** - 15+ 次从 "variations/keywords" 改为 "equivalents"
2. **计算格式** - 9 个关键位置更新为新的清晰格式
3. **代码注释** - 1 处更新以匹配
4. **示例说明** - 3 处改进以显示加法

**总修改：** ~30 处改进

## 关键原则

### 1. 一致性 > 多样性
- ✅ 使用一个术语："equivalents"
- ✅ 使用一个格式：`(N in Lang1 + N in Lang2)`
- ❌ 不要在提示中混用术语

### 2. 明确性 > 简洁性
- ✅ 显示实际语言名称
- ✅ 显示实际加法操作
- ✅ 显示最终结果
- ❌ 不要让 AI 计算

### 3. 视觉清晰 > 抽象公式
- ✅ "50 in English + 50 in 中文 = 100"
- ❌ "50 per language × 2 languages"
- ❌ "50 per language, 2 languages"

### 4. 实际值 > 符号
- ✅ 显示计算的实际值（100）
- ✅ 显示实际语言名称（English, 中文）
- ❌ 不使用通用占位符（language1, language2）

## 测试建议

### 测试 1：默认设置
```
Settings: 5 per language, 2 languages (English, 中文)
Query: "Fix bug"

AI 应该看到：
- "10 equivalents (5 in English + 5 in 中文)"

AI 应该生成：
- 5 个 English equivalents: fix, repair, solve, correct, resolve
- 5 个中文 equivalents: 修复, 解决, 修正, 处理, 纠正
- Total: 10 ✅
```

### 测试 2：高设置
```
Settings: 50 per language, 2 languages (English, 中文)
Query: "Improve performance"

AI 应该看到：
- "100 equivalents (50 in English + 50 in 中文)"

AI 应该生成：
- 50 个 English equivalents
- 50 个中文 equivalents
- Total: 100 ✅
```

### 测试 3：多种语言
```
Settings: 15 per language, 3 languages (English, 中文, Svenska)
Query: "Create task"

AI 应该看到：
- "45 equivalents (15 in English + 15 in 中文 + 15 in Svenska)"

AI 应该生成：
- 15 个 English equivalents
- 15 个中文 equivalents
- 15 个 Svenska equivalents
- Total: 45 ✅
```

## 用户反馈集成

用户的观察是**完全正确的**：

1. ✅ **"计算格式不一致"** - 发现 3 种不同格式，全部标准化
2. ✅ **"术语混用"** - 发现 4 种术语，标准化为 "equivalents"
3. ✅ **"计算不够清晰"** - 现在显示实际语言名称和加法

**所有反馈已处理！** 🎯

## 下一步

1. **构建插件** - 集成所有一致性改进
2. **测试清晰度** - 验证 AI 现在理解得更好
3. **监控生成** - 检查 AI 是否生成正确数量
4. **验证日志** - 确认扩展按预期工作

## 结论

通过标准化术语和改进计算格式，我们确保：

### ✅ 一致性
- 整个提示中只使用 "equivalents"
- 所有计算使用相同的清晰格式
- 无混淆的术语

### ✅ 清晰度
- AI 看到实际语言名称（English, 中文）
- AI 看到实际加法（50 + 50）
- AI 看到最终结果（= 100）
- 无需 AI 计算或猜测

### ✅ 可维护性
- 一个格式用于所有位置
- 易于更新和修改
- 代码生成清晰的提示

**用户的反馈导致了根本性的改进 - 感谢您敏锐的观察！** 🙏

**状态：** ✅ 所有一致性和清晰度改进完成，准备测试！
