# FreeChat 架构重构：SQL 作为唯一可信数据源

## 重构目标

**核心原则**：**SQL 是唯一可信数据源**，彻底分离消息存储和设置存储，消除数据一致性问题。

## 架构变更

### 旧架构问题

```
❌ 问题架构：
free_chat_user_settings 表
├─ user_id
├─ dialog_id
├─ model_params
├─ kb_ids
├─ role_prompt
└─ sessions (JSON) ⚠️
    └─ [{id, name, messages: [...], conversation_id, created_at}]

问题：
1. 消息混在设置里，违反单一职责原则
2. JSON 字段难以查询、索引、分页
3. Redis 缓存和 MySQL 可能不一致
4. 数据量大时 JSON 字段膨胀
5. 无法按消息维度做权限控制、审计
```

### 新架构设计

```
✅ 新架构：SQL 作为唯一可信源

free_chat_user_settings (设置表)
├─ user_id (PK)
├─ dialog_id
├─ model_params
├─ kb_ids
├─ role_prompt
└─ sessions (DEPRECATED，保留用于回退)

free_chat_session (会话表)
├─ id (PK, UUID)
├─ user_id (FK, 索引)
├─ name
├─ conversation_id
├─ created_at
└─ updated_at
    │
    │ 1:N
    ▼
free_chat_message (消息表)
├─ id (PK, UUID)
├─ session_id (FK, 索引)
├─ role (user/assistant)
├─ content (LONGTEXT)
├─ reference (JSON)
├─ seq (消息序号)
└─ created_at

索引优化：
- (user_id, created_at) - 按用户查询会话列表
- (session_id, seq) - 按会话按序号查询消息
- (session_id, created_at) - 按会话按时间查询消息
```

## 新增文件

### 1. 数据模型（已添加）

**`api/db/db_models.py`**:
- ✅ `FreeChatSession` - 会话表模型
- ✅ `FreeChatMessage` - 消息表模型
- ✅ 标记 `FreeChatUserSettings.sessions` 为 DEPRECATED

### 2. 服务层（新文件）

**`api/db/services/free_chat_session_service.py`**:
- ✅ `get_by_id()` - 查询单个会话
- ✅ `list_by_user()` - 查询用户的所有会话
- ✅ `create_session()` - 创建新会话
- ✅ `update_session()` - 更新会话（重命名等）
- ✅ `delete_session()` - 删除会话（级联删除消息）
- ✅ `delete_by_user()` - 删除用户的所有会话

**`api/db/services/free_chat_message_service.py`**:
- ✅ `get_by_id()` - 查询单条消息
- ✅ `list_by_session()` - 查询会话的所有消息（支持分页）
- ✅ `count_by_session()` - 统计会话消息数
- ✅ `get_next_seq()` - 获取下一个消息序号
- ✅ `create_message()` - 创建单条消息
- ✅ `batch_create_messages()` - 批量创建消息
- ✅ `update_message()` - 更新消息
- ✅ `delete_message()` - 删除消息
- ✅ `delete_by_session()` - 删除会话的所有消息
- ✅ `delete_after_seq()` - 删除指定序号后的消息（用于重新生成）

### 3. API 层（新文件）

**`api/apps/free_chat_session_app.py`**:

#### 会话 API
- ✅ `GET /api/v1/free_chat_session/sessions?user_id=xxx` - 获取会话列表
- ✅ `POST /api/v1/free_chat_session/sessions` - 创建会话
- ✅ `PUT /api/v1/free_chat_session/sessions/<session_id>` - 更新会话
- ✅ `DELETE /api/v1/free_chat_session/sessions/<session_id>` - 删除会话

#### 消息 API
- ✅ `GET /api/v1/free_chat_session/sessions/<session_id>/messages?limit=50&offset=0` - 获取消息列表（支持分页）
- ✅ `POST /api/v1/free_chat_session/sessions/<session_id>/messages` - 创建消息
- ✅ `PUT /api/v1/free_chat_session/messages/<message_id>` - 更新消息
- ✅ `DELETE /api/v1/free_chat_session/messages/<message_id>` - 删除消息

### 4. 数据迁移脚本（新文件）

**`api/db/migrations/migrate_freechat_to_sql.py`**:
- ✅ 从 `FreeChatUserSettings.sessions` (JSON) 迁移到新表
- ✅ 支持增量迁移（不会重复迁移已存在的数据）
- ✅ 迁移验证功能
- ✅ 详细的迁移日志

## 部署步骤

### 步骤 1: 备份数据库

```bash
# MySQL 备份
mysqldump -u ragflow -p ragflow > ragflow_backup_$(date +%Y%m%d).sql

# 或使用 Docker
docker exec ragflow-mysql mysqldump -u ragflow -p ragflow > backup.sql
```

### 步骤 2: 执行数据库迁移（创建新表）

新表会在应用启动时自动创建（`init_database_tables()`）

### 步骤 3: 数据迁移

**注意**：迁移脚本必须在 **Docker 容器内** 执行（因为依赖项在容器内）

#### 方式 1: 在运行中的容器内执行（推荐）

```bash
# 查找 ragflow-server 容器 ID
docker ps | grep ragflow

# 进入容器执行迁移
docker exec -it <container_id> python -m api.db.migrations.migrate_freechat_to_sql

# 或者使用容器名称
docker exec -it ragflow-server python -m api.db.migrations.migrate_freechat_to_sql

# 仅验证不迁移
docker exec -it ragflow-server python -m api.db.migrations.migrate_freechat_to_sql --verify-only
```

#### 方式 2: 使用便捷脚本（推荐）

```bash
# 使用提供的便捷脚本
bash scripts/migrate_freechat.sh

# 仅验证
bash scripts/migrate_freechat.sh --verify-only
```

#### 方式 3: 本地开发环境（仅开发模式）

如果你使用本地开发环境（非 Docker）：

```bash
# 确保所有依赖已安装
uv sync --all-extras

# 确保服务已启动（ES, MySQL, Redis等）
docker compose -f docker/docker-compose-base.yml up -d

# 执行迁移
source .venv/bin/activate
python -m api.db.migrations.migrate_freechat_to_sql
```

### 步骤 4: 重启服务

```bash
# 重启后端
pkill -f "ragflow_server.py"
bash docker/launch_backend_service.sh

# 或重启 Docker 容器
docker restart ragflow-server
```

### 步骤 5: 更新前端（下一阶段）

前端需要改为调用新的 API 端点。

## 前端改造计划（待实施）

### 当前前端架构

```typescript
// 前端目前使用的数据结构
interface Session {
  id: string;
  name: string;
  messages: Message[];  // ❌ 消息在会话对象里
  conversation_id?: string;
  created_at: number;
}

// 所有数据通过一个端点保存
POST /api/v1/free_chat/settings
{
  user_id: "xxx",
  dialog_id: "xxx",
  sessions: [...]  // ❌ 整个数组一起保存
}
```

### 新前端架构

```typescript
// 新的数据结构：分离会话和消息
interface Session {
  id: string;
  name: string;
  conversation_id?: string;
  created_at: number;
  updated_at: number;
  message_count: number;  // ✅ 只有消息数量
}

interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  reference?: any[];
  seq: number;
  created_at: number;
}

// 会话和消息分别操作
// 获取会话列表
GET /api/v1/free_chat_session/sessions?user_id=xxx

// 获取会话的消息（支持分页）
GET /api/v1/free_chat_session/sessions/{session_id}/messages?limit=50

// 创建新消息
POST /api/v1/free_chat_session/sessions/{session_id}/messages
{
  role: "user",
  content: "你好"
}
```

### 前端改造要点

1. **会话列表加载**：
   - 改为调用 `GET /api/v1/free_chat_session/sessions?user_id=xxx`
   - 不再包含 messages 数组

2. **消息加载**：
   - 切换会话时，调用 `GET /sessions/{session_id}/messages`
   - 支持懒加载/分页（历史消息按需加载）

3. **消息创建**：
   - 发送消息时，调用 `POST /sessions/{session_id}/messages`
   - 不再需要保存整个 sessions 数组

4. **会话操作**：
   - 创建会话：`POST /sessions`
   - 重命名会话：`PUT /sessions/{session_id}`
   - 删除会话：`DELETE /sessions/{session_id}`

5. **性能优化**：
   - ✅ 消息列表虚拟滚动（已实现）
   - ✅ 消息分页加载
   - ✅ 会话列表缓存（React Query）

## API 对比

### 旧 API（当前）

```bash
# 获取所有数据（包括所有消息）
GET /api/v1/free_chat/settings?user_id=xxx
Response: {
  user_id: "xxx",
  dialog_id: "xxx",
  sessions: [
    {
      id: "session1",
      name: "Chat 1",
      messages: [  // ❌ 所有消息都在这里
        {id: "msg1", role: "user", content: "..."},
        {id: "msg2", role: "assistant", content: "..."},
        // ... 可能有上百条消息
      ]
    }
  ]
}

# 保存所有数据（包括所有消息）
POST /api/v1/free_chat/settings
{
  user_id: "xxx",
  sessions: [...]  // ❌ 每次保存都要传整个数组
}
```

### 新 API

```bash
# 获取会话列表（不包含消息）
GET /api/v1/free_chat_session/sessions?user_id=xxx
Response: [
  {
    id: "session1",
    name: "Chat 1",
    conversation_id: "conv1",
    created_at: 1234567890,
    updated_at: 1234567890,
    message_count: 25  // ✅ 只有消息数量
  }
]

# 获取会话的消息（支持分页）
GET /api/v1/free_chat_session/sessions/session1/messages?limit=50&offset=0
Response: [
  {id: "msg1", role: "user", content: "...", seq: 0, created_at: 123456789},
  {id: "msg2", role: "assistant", content: "...", seq: 1, created_at: 123456790}
]

# 创建单条消息
POST /api/v1/free_chat_session/sessions/session1/messages
{
  role: "user",
  content: "你好"
}
Response: {
  id: "msg3",
  role: "user",
  content: "你好",
  seq: 2,
  created_at: 123456791
}
```

## 优势总结

### 1. 数据一致性

✅ **SQL 是唯一可信源**：
- 没有 Redis 缓存不一致问题
- 没有前端本地数据和服务端不一致问题
- 所有操作直接写入 MySQL

### 2. 性能优化

✅ **支持分页和懒加载**：
- 不再一次性加载所有消息
- 历史消息按需加载
- 减少内存占用和网络传输

✅ **索引优化**：
- `(user_id, created_at)` - 快速查询用户的会话列表
- `(session_id, seq)` - 快速查询会话的消息
- 支持复杂查询（按时间范围、按角色等）

### 3. 功能扩展

✅ **支持更多操作**：
- 单条消息编辑/删除
- 消息搜索（全文检索）
- 消息导出
- 消息审计日志
- 消息统计分析

✅ **支持更多特性**：
- 消息编辑历史
- 消息点赞/收藏
- 消息分享
- 多设备同步（自动）

### 4. 维护性

✅ **代码结构清晰**：
- 职责分离：设置是设置，消息是消息
- 服务层独立：`SessionService`、`MessageService`
- API 层 RESTful 设计

✅ **易于调试**：
- SQL 查询可追踪
- 数据库工具可直接查看
- 日志完整（每个操作都有日志）

## 回退方案

如果新架构出现问题，可以快速回退：

1. **数据不会丢失**：
   - `sessions` JSON 字段仍然保留
   - 可以继续使用旧 API (`/api/v1/free_chat/settings`)

2. **代码回退**：
   ```bash
   # 恢复到旧版本
   git revert <commit_hash>
   # 重启服务
   docker restart ragflow-server
   ```

3. **前端回退**：
   - 前端改造是增量的，可以分阶段回退

## 测试计划

### 单元测试
- [ ] `FreeChatSessionService` 测试
- [ ] `FreeChatMessageService` 测试

### 集成测试
- [ ] API 端点测试
- [ ] 数据迁移测试
- [ ] 并发写入测试

### 性能测试
- [ ] 大量消息查询性能
- [ ] 分页加载性能
- [ ] 并发创建消息性能

### E2E 测试
- [ ] 前端完整流程测试
- [ ] 多设备同步测试

## 监控指标

部署后需要监控：
- API 响应时间（P50, P95, P99）
- 数据库查询性能
- 消息创建 TPS
- 数据一致性检查

## 相关文档

- `.memory/freechat/01-architecture.md` - 原架构设计
- `.memory/freechat/02-backend-api.md` - 原 API 文档
- `FREECHAT_SQL_REFACTOR.md` - 本文档（重构说明）

## 后续工作

### Phase 1: 后端完成 ✅
- [x] 数据模型设计
- [x] 服务层实现
- [x] API 层实现
- [x] 数据迁移脚本

### Phase 2: 前端改造 🔄
- [ ] 会话列表改造
- [ ] 消息加载改造
- [ ] 消息创建改造
- [ ] 分页加载实现
- [ ] 性能优化

### Phase 3: 功能增强 📋
- [ ] 消息搜索
- [ ] 消息导出
- [ ] 消息编辑历史
- [ ] 消息统计面板

### Phase 4: 废弃旧架构 🗑️
- [ ] 移除 `sessions` JSON 字段
- [ ] 移除 Redis 缓存逻辑
- [ ] 清理旧代码

---

**最后更新**: 2025-01-10
**状态**: Phase 1 完成，等待前端改造
