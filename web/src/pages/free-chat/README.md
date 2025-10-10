# FreeChat 模块开发指南

> 本文档提供 FreeChat 模块的开发指南和最佳实践

## 📁 目录结构

```
free-chat/
├── README.md                          # 本文档
├── index.tsx                          # 主入口组件
├── chat-interface.tsx                 # 聊天界面组件
├── unauthorized.tsx                   # 未授权页面
│
├── types/                             # ⭐ 类型定义
│   └── free-chat.types.ts             # 完整的 TS 类型定义
│
├── hooks/                             # 自定义 Hooks
│   ├── use-free-chat-settings-query.ts  # ⭐ React Query Hooks（推荐）
│   ├── use-free-chat-settings-api.ts    # 旧 API（兼容）
│   ├── use-free-chat.ts                 # 核心对话逻辑
│   ├── use-free-chat-session.ts         # 会话管理
│   ├── use-free-chat-user-id.ts         # 用户 ID
│   ├── use-kb-toggle.ts                 # 知识库切换
│   ├── use-auto-create-dialog.ts        # 自动创建对话
│   └── use-dynamic-params.ts            # 动态参数
│
├── components/                        # 组件
│   ├── session-list.tsx               # 会话列表
│   ├── knowledge-base-selector.tsx    # 知识库选择器
│   ├── dialog-selector.tsx            # 对话选择器
│   └── control-panel.tsx              # 控制面板
│
├── contexts/                          # Context
│   └── kb-context.tsx                 # 知识库 Context
│
└── utils/                             # 工具函数
    └── error-handler.ts               # 错误处理
```

---

## 🚀 快速开始

### 1. 使用 React Query Hooks（推荐）⭐

```typescript
import { useFreeChatSettings, useSaveFreeChatSettings } from './hooks/use-free-chat-settings-query';

function MyComponent() {
  const userId = 'user_123';
  
  // 查询设置（自动缓存，5分钟内复用）
  const { data: settings, isLoading, error } = useFreeChatSettings(userId);
  
  // 保存设置（乐观更新）
  const { mutate: saveSettings, isPending: isSaving } = useSaveFreeChatSettings(userId);
  
  if (isLoading) return <Spin />;
  if (error) return <ErrorDisplay error={error} />;
  
  const handleSave = () => {
    saveSettings({
      ...settings,
      dialog_id: 'new_dialog_id'
    });
  };
  
  return (
    <div>
      <p>Dialog: {settings?.dialog_id}</p>
      <Button onClick={handleSave} loading={isSaving}>保存</Button>
    </div>
  );
}
```

### 2. 自动保存（防抖）

```typescript
import { useAutoSaveSettings } from './hooks/use-free-chat-settings-query';

function MyComponent() {
  const userId = 'user_123';
  const autoSave = useAutoSaveSettings(userId, {
    debounceMs: 30000, // 30秒防抖
    onSave: (settings) => console.log('已保存', settings),
    onError: (error) => console.error('保存失败', error)
  });
  
  const handleChange = (newSettings) => {
    autoSave(newSettings); // 30秒后自动保存
  };
  
  return <MyForm onChange={handleChange} />;
}
```

### 3. 单字段更新

```typescript
import { useUpdateSettingsField } from './hooks/use-free-chat-settings-query';

function MyComponent() {
  const userId = 'user_123';
  const updateField = useUpdateSettingsField(userId);
  
  const handleDialogChange = (dialogId: string) => {
    // 立即保存
    updateField('dialog_id', dialogId, { immediate: true });
    
    // 或自动保存（30秒后）
    updateField('dialog_id', dialogId);
    
    // 或静默更新（不触发"未保存"提示）
    updateField('sessions', newSessions, { silent: true });
  };
  
  return <DialogSelector onChange={handleDialogChange} />;
}
```

### 4. 手动保存

```typescript
import { useManualSaveSettings } from './hooks/use-free-chat-settings-query';

function MyComponent() {
  const userId = 'user_123';
  const { manualSave, isSaving } = useManualSaveSettings(userId);
  
  const handleSaveClick = async () => {
    const success = await manualSave();
    if (success) {
      message.success('保存成功');
    } else {
      message.error('保存失败');
    }
  };
  
  return (
    <Button onClick={handleSaveClick} loading={isSaving}>
      保存设置
    </Button>
  );
}
```

---

## 📘 类型定义使用

### 导入类型

```typescript
import {
  FreeChatSettings,
  ModelParams,
  FreeChatSession,
  UserInfo,
  Dialog,
  ApiResponse,
  UseFreeChatReturn,
} from './types/free-chat.types';
```

### 使用类型

```typescript
// Props 类型
interface MyComponentProps {
  settings: FreeChatSettings;
  onUpdate: (params: ModelParams) => void;
}

// 函数返回类型
function getDefaultSettings(userId: string): FreeChatSettings {
  return {
    user_id: userId,
    dialog_id: '',
    model_params: DEFAULT_MODEL_PARAMS,
    kb_ids: [],
    role_prompt: '',
    sessions: []
  };
}

// API 响应类型
async function fetchSettings(userId: string): Promise<ApiResponse<FreeChatSettings>> {
  const response = await request<ApiResponse<FreeChatSettings>>(api.getFreeChatSettings, {
    params: { user_id: userId }
  });
  return response.data;
}
```

---

## 🎯 最佳实践

### 1. 优先使用 React Query Hooks

**✅ 推荐**:
```typescript
const { data: settings } = useFreeChatSettings(userId);
```

**❌ 不推荐**（除非兼容旧代码）:
```typescript
const { settings } = useFreeChatSettingsApi(userId);
```

### 2. 使用类型定义

**✅ 推荐**:
```typescript
import { FreeChatSettings } from './types/free-chat.types';

interface Props {
  settings: FreeChatSettings;
}
```

**❌ 不推荐**:
```typescript
interface Props {
  settings: any; // 避免使用 any
}
```

### 3. 错误处理

**✅ 推荐**:
```typescript
const { data, error, isLoading } = useFreeChatSettings(userId);

if (isLoading) return <Spin />;
if (error) return <ErrorDisplay error={error} />;
```

**❌ 不推荐**:
```typescript
const { data } = useFreeChatSettings(userId);
// 没有错误处理
```

### 4. 查询键管理

**✅ 推荐**:
```typescript
import { freeChatKeys } from './hooks/use-free-chat-settings-query';

// 使用工厂函数
queryClient.invalidateQueries({ queryKey: freeChatKeys.settings(userId) });
```

**❌ 不推荐**:
```typescript
// 硬编码查询键
queryClient.invalidateQueries({ queryKey: ['freeChat', 'settings', userId] });
```

---

## 🔧 常见任务

### 获取设置

```typescript
const { data: settings } = useFreeChatSettings(userId);
```

### 更新单个字段

```typescript
const updateField = useUpdateSettingsField(userId);
updateField('dialog_id', 'new_id');
```

### 保存所有设置

```typescript
const { mutate: saveSettings } = useSaveFreeChatSettings(userId);
saveSettings(newSettings);
```

### 手动触发保存

```typescript
const { manualSave } = useManualSaveSettings(userId);
await manualSave();
```

### 使缓存失效

```typescript
const queryClient = useQueryClient();
queryClient.invalidateQueries({ queryKey: freeChatKeys.settings(userId) });
```

### 预取数据

```typescript
const queryClient = useQueryClient();
await queryClient.prefetchQuery({
  queryKey: freeChatKeys.settings(userId),
  queryFn: () => fetchSettings(userId)
});
```

---

## 🐛 调试技巧

### 1. 查看 React Query DevTools

```typescript
import { ReactQueryDevtools } from '@tanstack/react-query-devtools';

<ReactQueryDevtools initialIsOpen={false} />
```

### 2. 查看缓存状态

```typescript
const queryClient = useQueryClient();
const cachedData = queryClient.getQueryData(freeChatKeys.settings(userId));
console.log('Cached data:', cachedData);
```

### 3. 查看查询状态

```typescript
const { data, isLoading, isFetching, isError, error } = useFreeChatSettings(userId);
console.log({
  data,
  isLoading,    // 首次加载
  isFetching,   // 后台重新获取
  isError,
  error
});
```

---

## 📚 相关文档

### 方案书
- `FREECHAT_IMPROVEMENT_PLAN.md`: 完整改进方案
- `FREECHAT_IMPROVEMENTS_SUMMARY.md`: 实施总结
- `FREECHAT_INDEX.md`: 文档索引

### 分析文档
- `.memory/04-freechat-improvements.md`: 改进详细记录
- `.memory/03-frontend-architecture.md`: 前端架构

### 外部文档
- [React Query 文档](https://tanstack.com/query/v5)
- [TypeScript 文档](https://www.typescriptlang.org/)

---

## 🤝 贡献指南

### 添加新的 Hook

1. 在 `hooks/` 目录创建文件
2. 使用 React Query（如果涉及 API）
3. 添加完整的 TypeScript 类型
4. 更新本 README

### 添加新的类型

1. 在 `types/free-chat.types.ts` 添加类型
2. 使用 `export interface` 导出
3. 添加 JSDoc 注释

### 修改现有代码

1. 保持向后兼容
2. 更新类型定义
3. 添加测试用例
4. 更新文档

---

**维护者**: Claude Code  
**最后更新**: 2025-01-15  
**版本**: v1.0
