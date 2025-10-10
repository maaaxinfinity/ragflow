# FreeChat 文档索引

> RAGFlow FreeChat 功能相关文档总览
> 最后更新: 2025-01-15

## 📖 文档结构

```
ragflow/
├── FREECHAT_IMPROVEMENT_PLAN.md        # 完整改进方案书（70000+ 字）⭐
├── FREECHAT_IMPROVEMENTS_SUMMARY.md    # 实施总结（本次完成工作）⭐ 
├── FREECHAT_INDEX.md                   # 本文档
├── FREE_CHAT_SETUP.md                  # 功能使用说明
│
├── .memory/                            # 项目分析文档
│   ├── 01-project-overview.md          # 项目概览
│   ├── 02-backend-architecture.md      # 后端架构
│   ├── 03-frontend-architecture.md     # 前端架构
│   └── 04-freechat-improvements.md     # FreeChat 改进详细记录 ⭐
│
├── web/src/pages/free-chat/            # 前端代码
│   ├── types/
│   │   └── free-chat.types.ts          # ⭐ 新增：完整类型定义
│   ├── hooks/
│   │   ├── use-free-chat-settings-query.ts  # ⭐ 新增：React Query Hooks
│   │   ├── use-free-chat-settings-api.ts    # 原有（待迁移）
│   │   └── ...
│   └── ...
│
└── api/                                # 后端代码
    ├── exceptions/
    │   └── free_chat_exceptions.py     # ⭐ 新增：自定义异常
    ├── utils/
    │   └── redis_lock.py               # ⭐ 新增：分布式锁
    └── apps/
        └── free_chat_app.py            # API 端点
```

---

## 📋 文档说明

### 1. 方案书类

#### `FREECHAT_IMPROVEMENT_PLAN.md` ⭐ 核心文档
- **字数**: 70000+
- **内容**: 完整的代码完善方案
- **章节**:
  - 一、项目概述
  - 二、现有代码分析
  - 三、最佳实践对比
  - 四、完善方案
  - 五、实施计划
  - 六、预期成果
  - 七、总结

**适用场景**: 
- 了解完整改进思路
- 查看技术选型依据
- 学习最佳实践对比
- 制定后续开发计划

#### `FREECHAT_IMPROVEMENTS_SUMMARY.md` ⭐ 实施总结
- **字数**: 5000+
- **内容**: 本次实施完成的工作总结
- **章节**:
  - 实施概览（完成度统计）
  - 已完成工作（详细说明）
  - 性能预期
  - .memory 文档更新
  - 下一步计划

**适用场景**:
- 快速了解已完成工作
- 查看代码改进效果
- 了解下一步计划

#### `FREE_CHAT_SETUP.md`
- **字数**: 8000+
- **内容**: FreeChat 功能使用说明
- **章节**:
  - 功能概述
  - 使用流程
  - 技术实现
  - 故障排除

**适用场景**:
- 学习如何使用 FreeChat
- 了解功能特性
- 排查使用问题

---

### 2. 分析文档类 (.memory/)

#### `.memory/01-project-overview.md`
- **内容**: RAGFlow 项目整体概览
- **包含**: 技术栈、目录结构、核心依赖、架构模式

#### `.memory/02-backend-architecture.md`
- **内容**: 后端架构详细分析
- **包含**: API 层、服务层、数据库层、RAG 引擎、Agent 系统
- **更新**: 添加 FreeChat 错误处理和分布式锁说明

#### `.memory/03-frontend-architecture.md`
- **内容**: 前端架构详细分析
- **包含**: 技术栈、目录结构、路由系统、状态管理、Agent Canvas
- **更新**: 添加 React Query 最佳实践说明

#### `.memory/04-freechat-improvements.md` ⭐ 改进记录
- **内容**: FreeChat 改进详细记录
- **包含**: 
  - 改进概述
  - 第一阶段实施详情
  - 技术栈分析
  - 架构模式
  - 核心改进点
  - 最佳实践应用
  - 性能指标预期
  - 下一步计划

**适用场景**:
- 了解改进历史
- 查看技术细节
- 学习最佳实践
- 参考实施经验

---

### 3. 代码文件类

#### 前端新增文件

**`web/src/pages/free-chat/types/free-chat.types.ts`**
- **内容**: 完整的 TypeScript 类型定义
- **包含**: 
  - API 响应类型
  - 设置相关类型
  - 用户信息类型
  - 对话相关类型
  - Props 类型
  - Hook 返回类型
  - Store 类型
  - 常量定义

**`web/src/pages/free-chat/hooks/use-free-chat-settings-query.ts`**
- **内容**: React Query Hooks
- **包含**:
  - 查询键工厂函数 `freeChatKeys`
  - `useFreeChatSettings`: 查询设置
  - `useSaveFreeChatSettings`: 保存设置（乐观更新）
  - `useAutoSaveSettings`: 自动保存（防抖）
  - `useUpdateSettingsField`: 字段更新
  - `useManualSaveSettings`: 手动保存
  - `useFreeChatSettingsApi`: 兼容旧 API

#### 后端新增文件

**`api/exceptions/free_chat_exceptions.py`**
- **内容**: 自定义异常体系
- **包含**:
  - `FreeChatError`: 基础异常类
  - `SettingsNotFoundError`: 404 错误
  - `UnauthorizedAccessError`: 403 权限错误
  - `InvalidSettingsError`: 400 参数错误
  - `DatabaseError`: 数据库错误
  - `CacheError`: 缓存错误
  - `LockTimeoutError`: 锁超时错误

**`api/utils/redis_lock.py`**
- **内容**: Redis 分布式锁
- **包含**:
  - `RedisLock`: 锁类实现
  - `redis_lock`: 上下文管理器

---

## 🎯 快速导航

### 我想了解...

**FreeChat 是什么？**
→ 阅读 `FREE_CHAT_SETUP.md` - 功能概述章节

**如何使用 FreeChat？**
→ 阅读 `FREE_CHAT_SETUP.md` - 使用流程章节

**FreeChat 有哪些改进？**
→ 阅读 `FREECHAT_IMPROVEMENTS_SUMMARY.md`

**改进方案的技术细节？**
→ 阅读 `FREECHAT_IMPROVEMENT_PLAN.md`

**如何使用新的 React Query Hooks？**
→ 查看 `web/src/pages/free-chat/hooks/use-free-chat-settings-query.ts`
→ 参考 `.memory/04-freechat-improvements.md` - 最佳实践应用

**如何使用自定义异常？**
→ 查看 `api/exceptions/free_chat_exceptions.py`
→ 参考 `.memory/04-freechat-improvements.md` - Flask 最佳实践

**如何使用分布式锁？**
→ 查看 `api/utils/redis_lock.py`
→ 参考 `FREECHAT_IMPROVEMENT_PLAN.md` - 后端改进方案

**后续还有哪些改进计划？**
→ 阅读 `FREECHAT_IMPROVEMENTS_SUMMARY.md` - 下一步计划
→ 阅读 `FREECHAT_IMPROVEMENT_PLAN.md` - 实施计划

---

## 📊 改进统计

### 已完成（第一阶段 60%）

| 任务 | 状态 | 文件 |
|-----|------|------|
| React Query 迁移 | ✅ | `use-free-chat-settings-query.ts` |
| TypeScript 类型完善 | ✅ | `free-chat.types.ts` |
| 后端错误处理 | ✅ | `free_chat_exceptions.py` |
| 分布式锁 | ✅ | `redis_lock.py` |
| 文档更新 | ✅ | `.memory/*.md` |

### 待完成

| 任务 | 优先级 | 预计时间 |
|-----|-------|---------|
| Zustand 会话管理 | 高 | 3 天 |
| 结构化日志 | 中 | 2 天 |
| 单元测试 | 高 | 5 天 |
| 虚拟滚动 | 中 | 3 天 |
| 缓存优化 | 中 | 3 天 |

---

## 🔗 相关链接

### 内部文档
- [项目概览](.memory/01-project-overview.md)
- [后端架构](.memory/02-backend-architecture.md)
- [前端架构](.memory/03-frontend-architecture.md)
- [改进记录](.memory/04-freechat-improvements.md)

### 方案书
- [完整方案](FREECHAT_IMPROVEMENT_PLAN.md)
- [实施总结](FREECHAT_IMPROVEMENTS_SUMMARY.md)
- [使用说明](FREE_CHAT_SETUP.md)

### 外部参考
- [React Query 官方文档](https://tanstack.com/query/v5)
- [React 官方文档](https://react.dev)
- [Flask 官方文档](https://flask.palletsprojects.com)

---

## 📝 更新日志

### 2025-01-15
- ✅ 创建完整改进方案书
- ✅ 实施第一阶段基础重构（60%）
- ✅ 新增 4 个代码文件
- ✅ 更新 3 个 .memory 文档
- ✅ 新增 1 个改进记录文档
- ✅ 创建实施总结文档
- ✅ 创建本索引文档

---

**维护者**: Claude Code  
**创建日期**: 2025-01-15  
**最后更新**: 2025-01-15  
**版本**: v1.0
