# FreeChat 功能增强待办事项

## 已完成 ✅

### 存储架构优化 (2025-10-05)
- [x] 实现 Redis 缓存层 (L1 缓存，7天TTL)
- [x] MySQL 持久化存储 (L2 持久层)
- [x] Write-through 缓存策略：同步写入 Redis + MySQL
- [x] 缓存失效机制：MySQL 失败时清除 Redis
- [x] Sessions 防抖保存：5秒
- [x] 其他设置防抖保存：30秒
- [x] Role Prompt 改为 onBlur 触发
- [x] 手动保存按钮 + 自动保存提示
- [x] 未保存更改视觉指示器

### UI 美化 (2025-10-05)
- [x] SessionList 渐变背景和阴影效果
- [x] ControlPanel 卡片式参数展示
- [x] 用户信息卡片（底部右侧，带头像）
- [x] RAGFlowAvatar 默认头像集成
- [x] 高级参数折叠面板

### Bug 修复 (2025-10-05)
- [x] 修复路由重复前缀问题 (`/v1/free_chat/free_chat/settings` → `/v1/free_chat/settings`)
- [x] 修复非标准主键 `user_id` 的 SQL 更新问题
- [x] 修复参数调整时的 API 洪流（500ms 防抖）
- [x] 修复字体名称（"京华老宋体" → "KingHwa_OldSong"）
- [x] 添加 user_id 访问控制

---

## 待实现 🚧

### 优先级 P0 (必须完成)

#### 1. LLM 自动生成对话标题
**需求来源**: A2 requirement
**描述**: 使用 LLM 自动提取对话内容并生成有意义的标题

**实现要点**:
- 在用户发送第一条消息后，自动调用 LLM 生成标题
- 标题长度限制：15-50 字符
- 提示词模板：`根据以下对话内容，生成一个简洁的标题（15-50字）：\n\n{first_messages}`
- 使用当前 dialog 的 LLM 配置
- 标题生成失败时回退到默认命名（"Chat {n}" 或前 50 字符）

**技术方案**:
```typescript
// web/src/pages/free-chat/hooks/use-auto-title.ts
export const useAutoTitle = () => {
  const generateTitle = async (messages: Message[], dialogId: string) => {
    // 取前 3 条消息作为上下文
    const context = messages.slice(0, 3).map(m => m.content).join('\n');

    // 调用 LLM API 生成标题
    const response = await request(api.completeConversation, {
      method: 'POST',
      data: {
        dialog_id: dialogId,
        messages: [{
          role: 'user',
          content: `根据以下对话内容，生成一个简洁的标题（15-50字）：\n\n${context}`
        }],
        temperature: 0.3, // 低温度保证稳定性
        max_tokens: 50,
      }
    });

    return response.data.answer || null;
  };

  return { generateTitle };
};
```

**调用时机**:
- 在 `useFreeChat` 的 `sendMessage` 函数中
- 当 `currentSession.messages.length === 0` 时（第一条消息）
- 消息发送成功后异步调用，不阻塞用户交互

**文件修改**:
- `web/src/pages/free-chat/hooks/use-free-chat.ts` (集成自动标题生成)
- `web/src/pages/free-chat/hooks/use-auto-title.ts` (新建)

---

#### 2. 支持手动重命名对话
**需求来源**: A2 requirement
**描述**: 用户可以在 SessionList 中手动编辑对话标题

**实现要点**:
- 双击标题进入编辑模式
- Enter 保存，Esc 取消
- 标题长度限制：1-100 字符
- 空标题回退到原标题
- 编辑时显示字符计数

**技术方案**:
```typescript
// web/src/pages/free-chat/components/session-list.tsx
const [editingSessionId, setEditingSessionId] = useState<string | null>(null);
const [editingName, setEditingName] = useState('');

const handleDoubleClick = (session: IFreeChatSession) => {
  setEditingSessionId(session.id);
  setEditingName(session.name);
};

const handleSaveEdit = () => {
  if (editingName.trim().length > 0 && editingName.length <= 100) {
    onSessionRename(editingSessionId!, editingName);
  }
  setEditingSessionId(null);
};

// 在列表项中渲染
{editingSessionId === session.id ? (
  <Input
    value={editingName}
    onChange={(e) => setEditingName(e.target.value)}
    onKeyDown={(e) => {
      if (e.key === 'Enter') handleSaveEdit();
      if (e.key === 'Escape') setEditingSessionId(null);
    }}
    onBlur={handleSaveEdit}
    autoFocus
    maxLength={100}
  />
) : (
  <h3 onDoubleClick={() => handleDoubleClick(session)}>
    {session.name}
  </h3>
)}
```

**文件修改**:
- `web/src/pages/free-chat/components/session-list.tsx` (添加编辑模式)

---

### 优先级 P1 (重要但非紧急)

#### 3. Elasticsearch 集成 (30天热数据)
**需求来源**: 架构设计 - Phase 2
**描述**: 为 30 天内的对话数据提供全文搜索能力

**实现要点**:
- 索引结构设计
- 异步索引更新（不阻塞保存）
- 搜索 API 端点
- 前端搜索 UI（SessionList 顶部搜索框）
- 高亮搜索结果

**技术方案**:
```python
# api/db/services/elasticsearch_service.py
from elasticsearch import Elasticsearch

ES_INDEX = "freechat_sessions"

class ElasticsearchService:
    @staticmethod
    def index_session(user_id: str, session: dict):
        """异步索引会话到 Elasticsearch"""
        es.index(
            index=ES_INDEX,
            id=f"{user_id}_{session['id']}",
            document={
                "user_id": user_id,
                "session_id": session["id"],
                "name": session["name"],
                "messages": [m["content"] for m in session["messages"]],
                "created_at": session["created_at"],
                "updated_at": session["updated_at"],
            }
        )

    @staticmethod
    def search_sessions(user_id: str, query: str, limit=20):
        """搜索用户的会话"""
        result = es.search(
            index=ES_INDEX,
            query={
                "bool": {
                    "must": [
                        {"match": {"user_id": user_id}},
                        {"multi_match": {
                            "query": query,
                            "fields": ["name^3", "messages"]
                        }}
                    ]
                }
            },
            size=limit,
            highlight={
                "fields": {
                    "messages": {},
                    "name": {}
                }
            }
        )
        return result["hits"]["hits"]
```

**API 端点**:
```python
# api/apps/free_chat_app.py
@manager.route("/sessions/search", methods=["GET"])
@login_required
def search_sessions():
    user_id = request.args.get("user_id")
    query = request.args.get("q")
    results = ElasticsearchService.search_sessions(user_id, query)
    return get_json_result(data=results)
```

**文件修改**:
- `api/db/services/elasticsearch_service.py` (新建)
- `api/apps/free_chat_app.py` (添加搜索端点)
- `api/apps/free_chat_app.py` (在保存时异步索引)
- `web/src/pages/free-chat/components/session-list.tsx` (添加搜索框)

---

#### 4. MinIO 冷归档 (>30天数据)
**需求来源**: 架构设计 - Phase 3
**描述**: 将超过 30 天的对话数据归档到对象存储，压缩后保存

**实现要点**:
- 定时任务：每天凌晨 2 点执行
- 归档条件：`updated_at < now() - 30 days`
- 压缩格式：gzip
- 文件路径：`freechat/{user_id}/{session_id}.json.gz`
- MySQL 标记归档状态：`archived=true, archive_path=...`
- 归档后从 Redis 和 Elasticsearch 清除

**技术方案**:
```python
# api/tasks/archive_sessions.py
from rag.utils import MINIO
from datetime import datetime, timedelta
import gzip
import json

def archive_old_sessions():
    """归档超过 30 天的会话"""
    cutoff_date = datetime.now() - timedelta(days=30)

    # 查询需要归档的会话
    old_sessions = FreeChatUserSettings.select().where(
        FreeChatUserSettings.updated_at < cutoff_date,
        FreeChatUserSettings.archived == False
    )

    for setting in old_sessions:
        sessions = setting.sessions
        archived_sessions = []
        active_sessions = []

        for session in sessions:
            if session["updated_at"] < cutoff_date.timestamp() * 1000:
                # 归档到 MinIO
                archive_path = f"freechat/{setting.user_id}/{session['id']}.json.gz"
                compressed = gzip.compress(json.dumps(session).encode())
                MINIO.put_object(
                    bucket_name="ragflow-archive",
                    object_name=archive_path,
                    data=compressed,
                    length=len(compressed)
                )
                archived_sessions.append({
                    "id": session["id"],
                    "name": session["name"],
                    "archive_path": archive_path,
                    "archived_at": datetime.now().timestamp() * 1000
                })
            else:
                active_sessions.append(session)

        # 更新数据库：只保留活跃会话，归档会话单独记录
        FreeChatUserSettings.update(
            sessions=active_sessions,
            archived_sessions=archived_sessions
        ).where(
            FreeChatUserSettings.user_id == setting.user_id
        ).execute()

        # 清除 Redis 缓存
        invalidate_sessions_cache(setting.user_id)

        # 从 Elasticsearch 删除
        for session in archived_sessions:
            es.delete(index=ES_INDEX, id=f"{setting.user_id}_{session['id']}")

# 添加定时任务
# 使用 APScheduler 或 Celery Beat
scheduler.add_job(
    archive_old_sessions,
    'cron',
    hour=2,
    minute=0
)
```

**恢复归档会话**:
```python
@manager.route("/sessions/<session_id>/restore", methods=["POST"])
@login_required
def restore_archived_session(session_id):
    """从 MinIO 恢复归档会话"""
    user_id = request.json.get("user_id")

    # 查找归档路径
    setting = FreeChatUserSettings.get_by_user_id(user_id)
    archived = next((s for s in setting.archived_sessions if s["id"] == session_id), None)

    if not archived:
        return get_data_error_result("Session not found in archives")

    # 从 MinIO 下载
    obj = MINIO.get_object("ragflow-archive", archived["archive_path"])
    compressed = obj.read()
    session_data = json.loads(gzip.decompress(compressed))

    # 恢复到活跃会话
    active_sessions = setting.sessions + [session_data]
    archived_sessions = [s for s in setting.archived_sessions if s["id"] != session_id]

    FreeChatUserSettings.update(
        sessions=active_sessions,
        archived_sessions=archived_sessions
    ).where(
        FreeChatUserSettings.user_id == user_id
    ).execute()

    return get_json_result(data=session_data)
```

**文件修改**:
- `api/tasks/archive_sessions.py` (新建)
- `api/apps/free_chat_app.py` (添加恢复端点)
- `api/db/db_models.py` (添加 `archived_sessions` 字段)
- `web/src/pages/free-chat/components/session-list.tsx` (添加归档会话查看)

---

### 优先级 P2 (优化改进)

#### 5. 性能监控和指标
**描述**: 监控 Redis 缓存命中率、API 响应时间等关键指标

**实现要点**:
- Prometheus metrics 集成
- 监控指标：
  - Redis 缓存命中率
  - API 响应时间（P50, P95, P99）
  - 会话保存频率
  - MySQL 查询耗时
- Grafana 仪表板

**文件修改**:
- `api/apps/free_chat_app.py` (添加 metrics 采集)
- `docker/grafana/dashboards/freechat.json` (新建)

---

#### 6. 批量操作
**描述**: 支持批量删除、归档会话

**实现要点**:
- SessionList 多选模式
- 批量删除确认对话框
- 批量归档（手动触发）

**文件修改**:
- `web/src/pages/free-chat/components/session-list.tsx` (添加多选)
- `api/apps/free_chat_app.py` (添加批量操作端点)

---

## 测试计划 🧪

### 单元测试
- [ ] Redis 缓存读写测试
- [ ] MySQL upsert 测试
- [ ] 防抖函数测试
- [ ] LLM 标题生成测试

### 集成测试
- [ ] 完整的保存-读取流程
- [ ] 缓存失效和回退逻辑
- [ ] 并发保存测试
- [ ] 跨浏览器标签同步测试

### 性能测试
- [ ] Redis 缓存命中率 > 95%
- [ ] API 响应时间 < 100ms (缓存命中)
- [ ] API 响应时间 < 500ms (缓存未命中)
- [ ] 1000 个会话加载性能

### 用户验收测试
- [ ] 创建新会话流畅无阻塞
- [ ] Role Prompt 输入不中断
- [ ] 参数调整无 API 洪流
- [ ] 手动保存按钮正常工作
- [ ] 自动保存提示正确显示

---

## 部署清单 📦

### 依赖检查
- [ ] Redis 服务运行正常
- [ ] MySQL 数据库版本 >= 5.7
- [ ] Elasticsearch (可选，P1 优先级)
- [ ] MinIO (可选，P1 优先级)

### 配置更新
- [ ] `conf/service_conf.yaml` 添加 Redis 配置
- [ ] 环境变量：`REDIS_HOST`, `REDIS_PORT`, `REDIS_PASSWORD`

### 数据迁移
- [ ] 备份现有 `free_chat_user_settings` 表
- [ ] 运行数据迁移脚本（如有需要）

### 监控告警
- [ ] 添加 Redis 连接失败告警
- [ ] 添加 MySQL 保存失败告警
- [ ] 添加缓存命中率低于 90% 告警

---

## 文档更新 📚

- [ ] API 文档：添加 FreeChat 端点说明
- [ ] 架构文档：更新存储架构图
- [ ] 用户手册：FreeChat 功能使用指南
- [ ] 运维手册：Redis 缓存管理

---

## 注意事项 ⚠️

### 数据一致性
- ✅ **已确保**: 所有聊天数据都持久化到 MySQL
- ✅ Redis 仅作为缓存层，失败时不影响数据持久性
- ✅ Write-through 策略：同时写入 Redis 和 MySQL

### 性能考虑
- ✅ Sessions 使用 5 秒防抖（高频更新）
- ✅ 其他设置使用 30 秒防抖（低频更新）
- ⚠️ Redis TTL 设置为 7 天，需根据实际使用调整

### 安全考虑
- ✅ user_id 访问控制已实现
- ✅ 团队成员隔离已实现
- ⚠️ Redis 数据加密（待评估）

---

**最后更新**: 2025-10-05
**负责人**: Claude
**状态**: 核心功能已完成，待测试部署
