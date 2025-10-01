# Free Chat 功能使用说明

## 功能概述

Free Chat 是 RAGFlow 的高级对话功能,支持:

1. **动态模型参数调整**: 实时调整 temperature、top_p 等参数
2. **动态知识库选择**: 每条消息可以选择不同的知识库进行检索
3. **多对话会话管理**: 创建和管理多个独立的对话
4. **完整对话历史**: 支持对话上下文和历史记录

## 新的使用流程

### 架构说明

RAGFlow 现在采用"配置-使用"分离的架构:

```
┌─────────────────────────────────────────────┐
│    /next-chats (Bot/助手配置中心)           │
│  ✓ 创建和配置对话助手(Dialog)               │
│  ✓ 设置LLM模型、提示词、知识库等            │
│  ✓ 管理所有Bot                              │
│  ✓ 点击Bot卡片 → 跳转到Free Chat对话       │
└─────────────────────────────────────────────┘
                    ↓ 点击Bot
┌─────────────────────────────────────────────┐
│         /free-chat (对话界面)               │
│  ✓ 自动加载选中的Bot                        │
│  ✓ 动态调整参数和知识库                     │
│  ✓ 管理多个对话会话                         │
│  ✓ 完整的对话历史                           │
└─────────────────────────────────────────────┘
```

### 使用步骤

#### 1. 创建/配置 Bot (在 /next-chats)

1. 访问 **`/next-chats`** (Chat Apps 页面)
2. 点击 **"Create Chat"** 创建新的 Bot
3. 配置 Bot:
   - **Name**: Bot名称（例如: "技术助手"、"写作助手"等）
   - **Description**: Bot描述
   - **LLM Model**: 选择使用的大语言模型
   - **System Prompt**: 设置Bot的人格和行为
   - **Knowledge Bases**: 选择默认的知识库（可选）
   - **其他参数**: top_n、rerank等高级设置

#### 2. 开始对话 (在 /free-chat)

**方法一：从 next-chats 跳转**
- 在 `/next-chats` 页面，点击任意 Bot 卡片
- 自动跳转到 `/free-chat` 并加载该 Bot

**方法二：直接访问 free-chat**
- 访问 `/free-chat`
- 在右侧控制面板顶部的下拉菜单中选择Bot

#### 3. 对话中的动态调整

在 Free Chat 对话过程中，可以随时:

**切换Bot**
- 右侧面板顶部下拉菜单选择不同的Bot
- 切换后新对话会使用新Bot的配置

**调整模型参数**
- Temperature: 控制回答的创造性
- Top P: 核心采样阈值
- Frequency Penalty: 减少重复词汇
- Presence Penalty: 鼓励新话题
- Max Tokens: 控制回答长度

**切换知识库**
- 选择要使用的知识库（可多选）
- "Select All" 全选
- "Clear" 清除所有选择
- 选择后下一条消息生效

**管理会话**
- 左侧面板: 查看所有对话会话
- "New Chat": 创建新会话
- 点击会话切换
- 悬停删除按钮删除会话

## 技术实现

### 后端修改

**`api/apps/conversation_app.py`** 的 `completion` 函数:

```python
# Line 183-185: 提取 kb_ids 参数
kb_ids = req.get("kb_ids", [])
req.pop("kb_ids", None)

# Line 223-225: 临时覆盖 dialog.kb_ids
if kb_ids:
    dia.kb_ids = kb_ids
```

这使得每次请求可以临时覆盖 Dialog 的知识库配置,实现动态切换。

### 前端架构

**路由跳转逻辑**

1. **`web/src/pages/next-chats/chat-card.tsx`**
   ```typescript
   // 点击Bot卡片时:
   localStorage.setItem('free_chat_dialog_id', data.id);
   navigate(Routes.FreeChat);
   ```

2. **`web/src/pages/home/chat-list.tsx`**
   ```typescript
   // 首页Bot卡片同样跳转到free-chat
   ```

3. **`web/src/pages/free-chat/hooks/use-free-chat.ts`**
   ```typescript
   // 自动加载localStorage中的dialogId
   useEffect(() => {
     const savedDialogId = localStorage.getItem('free_chat_dialog_id');
     if (savedDialogId) {
       setDialogId(savedDialogId);
     }
   }, []);
   ```

**核心Hooks**

- `use-free-chat-session.ts`: 管理多个对话会话
- `use-free-chat.ts`: 核心对话逻辑
- `use-dynamic-params.ts`: 管理模型参数
- `use-kb-toggle.ts`: 管理知识库选择

**API调用**

每次发送消息时调用 `/api/conversation/completion`:

```typescript
{
  conversation_id: string,
  messages: Message[],
  // 动态参数 (会临时覆盖Dialog默认值)
  temperature?: number,
  top_p?: number,
  frequency_penalty?: number,
  presence_penalty?: number,
  max_tokens?: number,
  // 动态知识库 (会临时覆盖Dialog默认知识库)
  kb_ids?: string[]
}
```

## Dialog 的作用

### 为什么需要Dialog？

Dialog 不仅仅是配置，它提供:

1. **LLM配置** (`llm_id`) - 决定使用哪个模型
2. **租户信息** (`tenant_id`) - 权限验证和计费
3. **系统提示词** (`prompt_config`) - Bot的人格和行为
4. **默认知识库** (`kb_ids`) - 可被动态覆盖
5. **检索配置** (`top_n`, `rerank_id`等) - 影响知识库检索质量

### Dialog vs 动态参数

| 配置项 | 来源 | 可否动态覆盖 |
|--------|------|--------------|
| LLM模型 | Dialog | ✅ 可以 (通过llm_id参数) |
| 租户ID | Dialog | ❌ 不可以 (安全限制) |
| 系统提示词 | Dialog | ❌ 不可以 |
| 知识库 | Dialog | ✅ 可以 (通过kb_ids参数) |
| Temperature等 | Dialog | ✅ 可以 (直接传参) |

## 数据持久化

所有数据保存在 localStorage:

- `free_chat_dialog_id`: 当前选中的Dialog ID
- `free_chat_sessions`: 所有对话会话
- `free_chat_current_session`: 当前会话ID
- `free_chat_model_params`: 模型参数设置
- `free_chat_enabled_kbs`: 选中的知识库

## 故障排除

### Bot列表为空

**原因**: 还没有创建任何Bot
**解决**: 访问 `/next-chats` 创建Bot

### 无法选择Dialog

**原因**: DialogSelector组件加载失败
**解决**:
1. 检查 `/api/dialog/list` API是否正常
2. 查看浏览器控制台错误信息

### 消息发送失败

**检查项**:
- Dialog是否存在且有效
- 网络连接是否正常
- 查看浏览器控制台错误信息
- 确认LLM服务是否可用

### 知识库检索无效

**检查项**:
- 确认右侧面板显示已选中知识库数量
- 知识库是否包含相关内容
- 知识库文档是否已完成解析

## 与传统Chat的区别

### 传统模式 (/next-chat/:id)

- 一个Dialog = 一个专属对话页面
- 固定的Bot配置
- 无法动态切换参数和知识库

### Free Chat模式 (/free-chat)

- 可以选择任意Bot进行对话
- 动态调整参数和知识库
- 管理多个独立会话
- 更灵活的对话体验

## 最佳实践

### 1. Bot设计

**创建专门用途的Bot**:
- 技术助手: 配置技术文档知识库
- 客服Bot: 配置产品手册知识库
- 写作助手: 设置创造性的system prompt
- 代码助手: 配置代码库和API文档

### 2. 参数调整

**根据场景调整**:
- 事实性任务: 低Temperature (0.1-0.3)
- 创造性任务: 高Temperature (0.7-0.9)
- 长文本生成: 增加Max Tokens

### 3. 知识库使用

**按需选择**:
- 通用问题: 不选择知识库
- 专业问题: 选择相关知识库
- 跨领域问题: 多选知识库

## 未来规划

- [ ] 对话导出功能
- [ ] 对话分享功能
- [ ] 参数预设模板
- [ ] 知识库组合预设
- [ ] Bot使用统计
- [ ] 对话收藏和标签
