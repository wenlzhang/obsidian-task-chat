# Three-Mode System Redesign Proposal

## 当前问题

现有的"Smart search"和"Direct search"命名让用户困惑：
- "Smart search"既可能只做AI解析，也可能做AI分析
- 用户不清楚什么时候会使用AI
- 设置项名称"Enable smart search mode"含义模糊

## 用户提出的三模式系统

### Mode 1: Simple Search（简单搜索）
**目的**: 快速、免费的关键词搜索

**功能**:
- ✅ 移除停用词后的关键词匹配
- ✅ 按用户设置排序（相关性、优先级、截止日期等）
- ❌ 不使用AI
- **成本**: $0
- **角色名**: Simple Search

### Mode 2: Smart Search（智能搜索）
**目的**: AI增强的关键词搜索（语义扩展）

**功能**:
- ✅ AI扩展关键词为多语言同义词
- ✅ 更广泛的搜索范围
- ✅ 按用户设置排序（相关性、优先级、截止日期等）
- ❌ 不做AI分析和总结
- **成本**: ~$0.0001
- **角色名**: Smart Search

### Mode 3: Task Chat（任务对话）
**目的**: 完整的AI助手体验

**功能**:
- ✅ AI扩展关键词（同Smart Search）
- ✅ AI分析和总结任务
- ✅ AI提供执行建议
- ✅ 支持Auto排序模式（AI驱动）
- ✅ 对话式交互
- **成本**: ~$0.0021
- **角色名**: Task Chat

## 实施方案

### 1. 数据模型
```typescript
type SearchMode = "simple" | "smart" | "chat";

interface Settings {
    defaultSearchMode: SearchMode;
    // 移除 useAIQueryParsing
}
```

### 2. Settings UI
```
Search mode:
○ Simple Search - Fast, free keyword search
○ Smart Search - AI-enhanced keyword expansion (~$0.0001/query)  
○ Task Chat - Full AI assistant with analysis (~$0.0021/query)
```

### 3. Chat UI
下拉菜单显示三个选项，当前选择的模式高亮

### 4. Message Roles
- Simple Search → role: "simple"
- Smart Search → role: "smart"  
- Task Chat → role: "chat"

### 5. Token Usage Display
```
📊 Mode: Simple Search • $0
📊 Mode: Smart Search • AI: Keyword expansion • gpt-4o-mini • 234 tokens • ~$0.0001
📊 Mode: Task Chat • AI: Keyword expansion + Analysis • gpt-4o-mini • 1,234 tokens • ~$0.0021
```

## 实施步骤

1. 更新Settings接口和默认值
2. 更新SettingsTab UI
3. 更新ChatView下拉菜单
4. 重构aiService逻辑以支持三模式
5. 更新消息角色名称
6. 更新token usage显示
7. 更新文档和README

## 优势

✅ **清晰的目的导向**: 每个模式有明确的使用场景
✅ **可预测性**: 用户知道每个模式会做什么
✅ **成本透明**: 每个模式的成本固定且明确
✅ **简化决策**: 无需复杂的自动判断逻辑
