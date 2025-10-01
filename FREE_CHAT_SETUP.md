# Free Chat 功能使用说明

## 功能概述

Free Chat 是 RAGFlow 的高级对话功能,支持:

1. **动态模型参数调整**: 实时调整 temperature、top_p 等参数
2. **动态知识库选择**: 每条消息可以选择不同的知识库进行检索
3. **多对话会话管理**: 创建和管理多个独立的对话
4. **完整对话历史**: 支持对话上下文和历史记录

## 设置步骤

### 1. 创建 Dialog (可选)

如果您还没有任何 Dialog，需要先创建一个:

1. 进入 **Chat** (对话) 页面
2. 点击 **New Chat** 创建新对话
3. 配置 Dialog:
   - Name: 自定义名称（例如: `My Free Chat`）
   - 选择默认的 LLM 模型
   - 可以选择默认的知识库(可选,因为可以动态切换)
4. 保存 Dialog

### 2. 访问 Free Chat

在浏览器中访问: `http://your-ragflow-url/free-chat`

### 3. 选择 Dialog

在右侧控制面板顶部，从下拉菜单中选择要使用的 Dialog。

- 如果列表为空，说明您还没有创建任何 Dialog，请先按照步骤1创建
- 选择后会自动保存，下次访问会记住您的选择
- Dialog 提供基础的 LLM 配置，但您仍然可以通过右侧面板动态调整参数和知识库

## 功能使用

### 对话会话管理

- **新建对话**: 点击左侧 "New Chat" 按钮
- **切换对话**: 点击左侧对话列表中的任意对话
- **删除对话**: 鼠标悬停在对话上,点击垃圾桶图标

### 动态参数调整

在右侧控制面板中:

1. **Temperature** (0-1): 控制回答的随机性
   - 较低值 (0.1-0.3): 更保守、确定性的回答
   - 较高值 (0.7-0.9): 更有创意、多样性的回答

2. **Top P** (0-1): 核心采样阈值
   - 控制词汇选择的范围

3. **Frequency Penalty** (0-1): 词频惩罚
   - 减少重复使用相同词汇的倾向

4. **Presence Penalty** (0-1): 存在惩罚
   - 鼓励讨论新话题

5. **Max Tokens** (100-8000): 最大回答长度

### 动态知识库选择

在右侧 "Knowledge Bases" 部分:

1. 选择要使用的知识库(可多选)
2. 使用 "Select All" 全选或 "Clear" 清除所有选择
3. 选择后会在下一条消息中生效

### 参数生效提示

当你调整参数或切换知识库后,界面会显示黄色提示:
> "Parameters have been updated and will take effect in the next message."

## 技术实现细节

### 后端修改

在 `api/apps/conversation_app.py` 的 `completion` 函数中添加了对 `kb_ids` 的支持:

```python
# Support dynamic knowledge base selection
kb_ids = req.get("kb_ids", [])
req.pop("kb_ids", None)

# ...

# Temporarily override dialog's kb_ids if provided
if kb_ids:
    dia.kb_ids = kb_ids
```

这使得每次请求可以临时覆盖 Dialog 的知识库配置,而不影响 Dialog 本身的配置。

### 前端架构

1. **use-free-chat-session.ts**: 管理多个对话会话
2. **use-free-chat.ts**: 核心对话逻辑,整合参数、知识库、会话管理
3. **use-dynamic-params.ts**: 管理模型参数,持久化到 localStorage
4. **use-kb-toggle.ts**: 管理知识库选择,持久化到 localStorage

### API 调用

每次发送消息时,会调用 `/conversation/completion` API,传递:
```typescript
{
  conversation_id: string,
  messages: Message[],
  // 动态参数
  temperature?: number,
  top_p?: number,
  frequency_penalty?: number,
  presence_penalty?: number,
  max_tokens?: number,
  // 动态知识库
  kb_ids?: string[]
}
```

## 数据持久化

所有数据都保存在 localStorage 中:

- `free_chat_sessions`: 所有对话会话
- `free_chat_current_session`: 当前活动会话 ID
- `free_chat_model_params`: 模型参数设置
- `free_chat_enabled_kbs`: 选中的知识库
- `free_chat_dialog_id`: Dialog ID 配置

## 注意事项

1. **Dialog 必须存在**: Free Chat 依赖一个已存在的 Dialog,请确保先创建 Dialog
2. **参数范围**: 所有参数都有有效范围,超出范围可能导致错误
3. **知识库权限**: 只能选择有访问权限的知识库
4. **会话独立**: 每个会话有独立的 conversation_id,互不影响

## 故障排除

### "Please select a Dialog..." 提示

- 原因: 未选择 Dialog
- 解决: 在右侧控制面板顶部的下拉菜单中选择一个 Dialog
- 如果下拉菜单为空，需要先在 Chat 页面创建 Dialog

### 消息发送失败

- 检查 Dialog ID 是否正确
- 检查网络连接
- 查看浏览器控制台错误信息

### 知识库检索无效

- 确认知识库已正确选中(右侧面板显示数量)
- 确认知识库包含相关内容
- 检查知识库是否已完成文档解析

## 未来改进

1. 对话导出功能
2. 对话收藏/标签功能
3. 参数预设模板
4. 知识库组合预设
5. 对话分享功能
