# FreeChat 架构重构与改进记录

> 实施时间: 2025-01-10
> 状态: Phase 1 完成 ✅，Phase 2 待实施

## 1. 重构概述

### 1.1 核心目标

**SQL 作为唯一可信数据源** - 彻底分离消息存储和设置存储，消除数据一致性问题。

### 1.2 完成的工作

#### Phase 1: 后端架构重构 ✅
- 新增数据库表（`free_chat_session`, `free_chat_message`）
- 服务层实现（SessionService, MessageService）
- 8个新 API 端点（RESTful 设计）
- 数据迁移脚本（自动创建表、处理重复ID、类型转换）
- 认证系统修复（session cookie + API key 双认证）
- Redis 锁修复（SETNX + EXPIRE）

### 1.3 最新前端更新（2025-10-13）
- FreeChat 会话栏新增“草稿欢迎卡片”，首次进入或点击“新建对话”时默认进入草稿模式，参考 Claude/GPT 欢迎页体验
- 草稿模式下不会立即创建正式会话，用户提交首条消息后才写入历史记录，左侧会话保持高亮提示
- 新增 `isDraftMode` 状态管理，支持随时切换回空白草稿且不影响既有会话内容
- 新增 `/free-chat/test` 测试模式页面：页面内置静态 Session/消息数据，可离线预览 FreeChat 样式，无需后端 API
- 登录拦截增加白名单，`/free-chat/test` 支持匿名访问，开发时无需后端即可进入测试页
  - 测试页左侧“草稿欢迎卡片”仅保留引导视觉，不再呈现“新建/清空”按钮；添加分隔线与列表分区，正式会话选中态使用更明显的视觉强调
  - 测试页复用生产 `SessionList`/`ChatInterface`/`ControlPanel` 组件，通过 mock props 注入数据并禁止所有 hooks 发起网络请求
  - 会话侧边栏文案更新为「来聊点啥」，并将草稿卡片与正式会话条目在配色和高亮状态上彻底区分
  - Control Panel 滑杆重新设计（细轨道 + 渐变填充 + 悬浮发光圆点），统一生产与测试模式的外观
  - 桌面端默认折叠配置面板，使用右下角浮动按钮展开；面板内部新增关闭按钮，可快速收起
- 会话列表支持收藏会话：新增金色描边/徽标、高亮背景，并在“清除全部”时自动保留收藏项；收藏状态在测试页与正式页保持一致
- 聊天头像统一加上浅蓝色描边，助手头像固定使用 `lawyer-message.svg`，用户头像使用上传头像或渐变首字母
- 助手气泡操作区精简，仅保留复制与反馈（旗帜图标）按钮，移除点赞与转语音功能
- 输入框的“新建对话”按钮调整为描边样式，以区别主要操作

#### 测试模式使用方法
1. 本地或预览环境访问 `http://localhost:8000/#/free-chat/test`
2. 左侧“草稿欢迎卡片”用于展示默认空白对话效果，可通过输入框实时查看气泡样式
3. 右侧参数卡片展示模型与知识库占位文案，便于校对布局与主题
4. 测试模式不触发任何 API 请求，刷新页面即可回到初始状态

## 2. 认证系统修复 ✅

### 2.1 问题与根因

**现象**: 所有 API 返回 109 错误 "Authentication required"

**根因**:
1. Flask-Login 缺少 `@login_manager.user_loader` 回调
2. 前端生成 `Authorization: Bearer null`
3. 后端未过滤无效 token

### 2.2 修复方案

#### 后端修复

**文件**: `api/apps/__init__.py`

```python
# 添加 user_loader（处理 session cookie）
@login_manager.user_loader
def load_user_from_session(user_id):
    """从 session cookie 加载用户"""
    user = UserService.query(id=user_id, status=StatusEnum.VALID.value)
    return user[0] if user else None

# 保留 request_loader（处理 Authorization header）
@login_manager.request_loader  
def load_user_from_request(web_request):
    """从 Authorization header 加载用户（API token）"""
    # ... 处理 Bearer token
```

**文件**: `api/utils/auth_decorator.py`

```python
# 过滤无效 token
if beta_token and beta_token not in ('null', 'undefined', ''):
    tokens = APIToken.query(beta=beta_token)
```

#### 前端修复

**文件**: `web/src/pages/free-chat/index.tsx`

```typescript
// 只有有效 token 才添加 Authorization header
const authToken = searchParams.get('auth');
if (authToken && authToken !== 'null') {
  headers.Authorization = `Bearer ${authToken}`;
}

// 添加 credentials 支持 session cookie
credentials: 'include'
```

**文件**: `web/src/utils/authorization-util.ts`

```typescript
// 修复 getAuthorization() 避免生成 "Bearer null"
const authorization = (auth && auth !== 'null')
  ? 'Bearer ' + auth
  : storage.getAuthorization() || '';
```

### 2.3 效果

- ✅ Session cookie 认证正常工作
- ✅ API key 认证正常工作
- ✅ 无效 token 被正确过滤

## 3. 数据库架构重构 ✅

### 3.1 旧架构问题

```
❌ 问题：
free_chat_user_settings
├─ sessions (JSON 字段)
    └─ [{id, name, messages: [...]}]

缺陷：
- 消息混在设置里（违反单一职责）
- JSON 难以查询、索引、分页
- Redis 缓存和 MySQL 可能不一致
- 数据量大时性能差
```

### 3.2 新架构设计

```sql
-- 设置表（只存设置）
CREATE TABLE free_chat_user_settings (
  user_id VARCHAR(255) PRIMARY KEY,
  dialog_id VARCHAR(32),
  model_params JSON,
  kb_ids JSON,
  role_prompt LONGTEXT,
  sessions JSON  -- DEPRECATED
);

-- 会话表（独立存储）
CREATE TABLE free_chat_session (
  id VARCHAR(64) PRIMARY KEY,  -- 支持带横杠的UUID
  user_id VARCHAR(255) NOT NULL,
  name VARCHAR(255) NOT NULL,
  conversation_id VARCHAR(32),
  created_at BIGINT NOT NULL,
  updated_at BIGINT NOT NULL,
  INDEX idx_user_created (user_id, created_at)
);

-- 消息表（独立存储）
CREATE TABLE free_chat_message (
  id VARCHAR(64) PRIMARY KEY,
  session_id VARCHAR(64) NOT NULL,
  role VARCHAR(16) NOT NULL,
  content LONGTEXT NOT NULL,
  reference JSON,
  seq INT NOT NULL,
  created_at BIGINT NOT NULL,
  INDEX idx_session_seq (session_id, seq),
  INDEX idx_session_time (session_id, created_at)
);
```

### 3.3 实现文件

**数据模型**: `api/db/db_models.py`
- `FreeChatSession` - 会话模型
- `FreeChatMessage` - 消息模型
- 字段长度 64（支持带横杠和不带横杠的 UUID）

**服务层**:
- `api/db/services/free_chat_session_service.py` - 会话 CRUD
- `api/db/services/free_chat_message_service.py` - 消息 CRUD

**API 层**: `api/apps/free_chat_session_app.py`
- `GET /api/v1/free_chat_session/sessions` - 获取会话列表
- `POST /api/v1/free_chat_session/sessions` - 创建会话
- `PUT /api/v1/free_chat_session/sessions/<id>` - 更新会话
- `DELETE /api/v1/free_chat_session/sessions/<id>` - 删除会话
- `GET /api/v1/free_chat_session/sessions/<id>/messages` - 获取消息（支持分页）
- `POST /api/v1/free_chat_session/sessions/<id>/messages` - 创建消息
- `PUT /api/v1/free_chat_session/messages/<id>` - 更新消息
- `DELETE /api/v1/free_chat_session/messages/<id>` - 删除消息

### 3.4 优势

- ✅ SQL 是唯一可信源
- ✅ 支持分页和懒加载
- ✅ 支持复杂查询（按时间、按角色等）
- ✅ 支持单条消息操作
- ✅ 索引优化性能
- ✅ 易于扩展（消息编辑历史、审计等）

## 4. 数据迁移脚本 ✅

### 4.1 功能特性

**文件**: `api/db/migrations/migrate_freechat_to_sql.py`

**自动化处理**:
1. ✅ 检测表是否存在，不存在则自动创建
2. ✅ 检查消息 ID 有效性（长度 < 32），无效则生成新 UUID
3. ✅ 处理重复 ID（检测冲突，自动生成新 ID）
4. ✅ 类型转换（created_at float→int，reference dict→list）
5. ✅ 批量创建失败时逐条重试
6. ✅ 增量迁移（不重复迁移已存在数据）
7. ✅ 迁移验证功能

### 4.2 执行方式

```bash
# 在 Docker 容器内执行
docker exec -it ragflow-server python -m api.db.migrations.migrate_freechat_to_sql

# 或使用便捷脚本（Linux/Mac）
bash scripts/migrate_freechat.sh

# 仅验证
bash scripts/migrate_freechat.sh --verify-only
```

### 4.3 边界情况处理

```python
# 1. 自动创建表
def ensure_tables_exist():
    try:
        DB.execute_sql("SELECT 1 FROM free_chat_session LIMIT 1")
    except:
        FreeChatSession.create_table()

# 2. 处理无效 ID
msg_id = msg.get('id', '')
if not msg_id or len(msg_id) < 32:
    msg_id = str(uuid.uuid4()).replace('-', '')

# 3. 处理重复 ID
exists, _ = FreeChatMessageService.get_by_id(msg_id)
if exists:
    old_id = msg_id
    msg_id = str(uuid.uuid4()).replace('-', '')
    logger.warning(f"ID conflict: {old_id} -> {msg_id}")

# 4. 类型转换
created_at = int(msg.get('created_at', 0))  # float -> int
reference = [ref] if isinstance(ref, dict) else ref  # dict -> list
```

## 5. Redis 锁修复 ✅

### 5.1 问题

`RedisDB.set()` 不支持 `nx` 参数，导致 `redis_lock()` 报错：
```
Unexpected error: RedisDB.set() got an unexpected keyword argument 'nx'
```

### 5.2 修复方案

**文件**: `api/utils/redis_lock.py`

```python
# 修复前（错误）
if REDIS_CONN.set(self.lock_name, identifier, nx=True, ex=self.timeout):
    ...

# 修复后（正确）
if REDIS_CONN.REDIS.setnx(self.lock_name, identifier):
    REDIS_CONN.REDIS.expire(self.lock_name, self.timeout)
    self.identifier = identifier
    return True
```

**原因**: `RedisDB` 是封装类，不支持原生 Redis 的 `nx`/`ex` 参数，需要使用 `setnx()` + `expire()`。

### 5.3 效果

- ✅ Settings 保存正常
- ✅ 分布式锁正常工作
- ✅ 防止并发冲突

## 6. 前端优化 ✅

### 6.1 关闭调试日志

**文件**: `web/src/pages/free-chat/index.tsx`

```typescript
// 删除所有 console.log 调试信息
// ❌ console.log('[UserInfo] Fetching from:', url);
// ❌ console.log('[UserInfo] Response:', data);
// ❌ console.log('[UserInfo] Display conditions:', {...});
```

### 6.2 凭证支持

```typescript
// 添加 credentials: 'include' 支持 session cookie
const response = await fetch(url, {
  headers,
  credentials: 'include',
});
```

## 7. 文档更新 ✅

### 7.1 新增文档

**架构重构说明**: `FREECHAT_SQL_REFACTOR.md`
- 重构目标和架构设计
- 新旧架构对比
- API 端点说明
- 部署步骤
- 回退方案

**迁移指南**: `scripts/MIGRATION_GUIDE.md`
- 快速开始
- 常见问题 FAQ
- 故障排查
- Windows 用户指南

**迁移脚本**: `scripts/migrate_freechat.sh`
- 自动查找容器
- 交互式确认
- 彩色输出
- 错误处理

### 7.2 更新文档

- `.memory/freechat/01-architecture.md` - 更新架构说明
- `.memory/freechat/02-backend-api.md` - 更新 API 文档
- `.memory/04-freechat-improvements.md` - 本文档（架构重构记录）

## 8. 下一步：前端改造（Phase 2）

### 8.1 需要改造的部分

**会话管理**:
- 改用 `GET /sessions?user_id=xxx` 获取会话列表
- 不再从 settings 中读取 sessions
- 创建会话：`POST /sessions`
- 删除会话：`DELETE /sessions/<id>`
- 重命名会话：`PUT /sessions/<id>`

**消息管理**:
- 按需加载：`GET /sessions/<id>/messages?limit=50&offset=0`
- 支持分页和虚拟滚动
- 发送消息：`POST /sessions/<id>/messages`
- 不再保存整个 sessions 数组

**性能优化**:
- 会话列表只返回元数据（不包含 messages）
- 消息懒加载（滚动到顶部时加载历史）
- React Query 缓存优化

### 8.2 需要创建的 Hooks

```typescript
// 会话管理
useFreeChatSessions(userId)
useCreateSession(userId)
useUpdateSession(sessionId)
useDeleteSession(sessionId)

// 消息管理
useFreeChatMessages(sessionId, { limit, offset })
useCreateMessage(sessionId)
useDeleteMessage(messageId)

// 分页
useInfiniteMessages(sessionId)  // 无限滚动
```

### 8.3 需要修改的组件

- `SessionList.tsx` - 改用新 API
- `ChatInterface.tsx` - 消息分页加载
- `use-free-chat-session.ts` - 重构会话逻辑
- `use-free-chat.ts` - 重构消息逻辑

## 9. 总结

### 9.1 已完成 ✅

1. **认证系统** - Session cookie + API key 双认证
2. **数据库架构** - 分离会话和消息表
3. **服务层** - Session/Message CRUD
4. **API 层** - 8个 RESTful 端点
5. **数据迁移** - 自动化脚本（处理所有边界情况）
6. **Redis 锁** - 修复参数错误
7. **前端优化** - 清理调试日志，添加 credentials

### 9.2 待完成 📋

1. **前端改造** - 使用新 API 端点
2. **消息分页** - 实现懒加载
3. **性能测试** - 验证分页性能提升
4. **废弃旧字段** - 移除 `sessions` JSON 字段
5. **清理代码** - 删除旧的缓存逻辑

### 9.3 核心价值

- ✅ **数据一致性**: SQL 唯一可信源，无缓存不一致
- ✅ **性能提升**: 支持分页、索引、懒加载
- ✅ **功能扩展**: 易于添加消息搜索、编辑历史、审计
- ✅ **代码质量**: RESTful 设计，职责清晰
- ✅ **维护性**: 易于调试，日志完整

---

**最后更新**: 2025-01-10
**下一步**: 前端改造（Phase 2）
