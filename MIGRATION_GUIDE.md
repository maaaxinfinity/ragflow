# Model Card 数据库迁移指南

## 问题描述

前端访问 `/v1/conversation/set` 端点时报错：
```
{
    "code": 100,
    "data": "Unknown column 'model_card_id' in 'field list'",
    "message": "1054"
}
```

**原因**：数据库表 `conversation` 缺少 `model_card_id` 列，需要执行迁移。

---

## 快速修复

### 方案一：使用自动化迁移脚本（推荐）

#### 1. 预览迁移操作（安全检查）

```bash
# 在 RAGFlow 根目录执行
python migrate_and_cleanup.py --dry-run
```

这会显示将要执行的操作，但不会修改数据库。

#### 2. 执行完整迁移

```bash
# 自动确认所有操作
python migrate_and_cleanup.py --yes

# 或者手动确认每一步
python migrate_and_cleanup.py
```

**迁移脚本会自动完成**：
- ✅ 添加 `model_card_id` 列到 `conversation` 表
- ✅ 创建索引以提升查询性能
- ✅ 清理无效的对话数据（`model_card_id = NULL` 且无法关联的旧数据）
- ✅ 清理 FreeChat 会话中的无效引用
- ✅ 验证迁移结果

#### 3. 重启后端服务

```bash
# Docker 部署
cd docker
docker compose restart ragflow-server

# 本地开发
pkill -f "ragflow_server.py"
bash docker/launch_backend_service.sh
```

---

### 方案二：手动 SQL 迁移

#### MySQL

```bash
# 1. 连接数据库
mysql -u root -p rag_flow

# 2. 执行迁移
source api/db/migrations/002_add_model_card_id_to_conversation.sql

# 3. 验证
DESCRIBE conversation;
# 应该看到 model_card_id (int, nullable, indexed)
```

#### PostgreSQL

```bash
# 1. 连接数据库
psql -U postgres -d rag_flow

# 2. 执行迁移
\i api/db/migrations/002_add_model_card_id_to_conversation.sql

# 3. 验证
\d conversation
```

---

## 数据清理选项

### 仅执行迁移（保留旧数据）

```bash
python migrate_and_cleanup.py --migrate-only
```

这会添加 `model_card_id` 列，但保留所有现有对话（`model_card_id` 为 `NULL`）。

**影响**：
- ✅ 旧对话仍可访问
- ⚠️  旧对话需要用户重新选择 Model Card
- ⚠️  前端可能显示"未选择助手"

### 执行迁移并清理旧数据（推荐）

```bash
python migrate_and_cleanup.py --yes
```

这会删除所有 `model_card_id = NULL` 的对话记录。

**影响**：
- ✅ 数据库保持干净
- ✅ 所有对话都有明确的 Model Card 关联
- ❌ 旧对话会被删除（用户需要重新创建）

### 仅清理数据（假设已手动迁移）

```bash
python migrate_and_cleanup.py --cleanup-only --yes
```

---

## 迁移前备份（强烈推荐）

### MySQL 备份

```bash
# 完整数据库备份
mysqldump -u root -p rag_flow > backup_ragflow_$(date +%Y%m%d_%H%M%S).sql

# 仅备份相关表
mysqldump -u root -p rag_flow conversation free_chat_user_settings > backup_conversation_$(date +%Y%m%d_%H%M%S).sql
```

### 恢复备份

```bash
mysql -u root -p rag_flow < backup_ragflow_YYYYMMDD_HHMMSS.sql
```

### PostgreSQL 备份

```bash
# 完整数据库备份
pg_dump -U postgres -d rag_flow > backup_ragflow_$(date +%Y%m%d_%H%M%S).sql

# 恢复
psql -U postgres -d rag_flow < backup_ragflow_YYYYMMDD_HHMMSS.sql
```

---

## 验证迁移成功

### 1. 检查数据库表结构

**MySQL:**
```sql
DESCRIBE conversation;
-- 应该看到 model_card_id | int | YES | MUL | NULL |
```

**PostgreSQL:**
```sql
\d conversation
-- 应该看到 model_card_id | integer |  | 
```

### 2. 检查索引

**MySQL:**
```sql
SHOW INDEX FROM conversation WHERE Key_name = 'idx_conversation_model_card_id';
```

**PostgreSQL:**
```sql
\di idx_conversation_model_card_id
```

### 3. 测试前端请求

重新执行之前失败的请求：

```bash
curl 'https://rag.limitee.cn/v1/conversation/set' \
  -H 'Authorization: Bearer YOUR_TOKEN' \
  -H 'Content-Type: application/json' \
  --data-raw '{
    "dialog_id":"6736839ca04111f0b54acaa48f96c61c",
    "name":"测试对话",
    "is_new":true,
    "model_card_id":2,
    "message":[{"role":"assistant","content":""}],
    "conversation_id":"44f91620f8074d438f9b1e47b7d685d9"
  }'
```

**预期响应**：
```json
{
  "code": 0,
  "message": "success",
  "data": {
    "id": "44f91620f8074d438f9b1e47b7d685d9",
    "dialog_id": "6736839ca04111f0b54acaa48f96c61c",
    "name": "测试对话",
    "model_card_id": 2,
    "message": [...],
    ...
  }
}
```

---

## 故障排除

### 错误：模块导入失败

```
ModuleNotFoundError: No module named 'api'
```

**解决**：确保在 RAGFlow 根目录执行脚本

```bash
cd /path/to/ragflow
python migrate_and_cleanup.py
```

### 错误：数据库连接失败

```
Can't connect to MySQL server
```

**解决**：检查数据库配置

```bash
# Docker 环境
cat docker/.env | grep -E "MYSQL|PG"

# 本地开发
echo $DB_TYPE
echo $MYSQL_HOST
```

### 错误：权限不足

```
Access denied for user
```

**解决**：使用 root 用户或具有 ALTER TABLE 权限的用户

```sql
-- MySQL: 授予权限
GRANT ALTER, INDEX ON rag_flow.* TO 'ragflow_user'@'%';
FLUSH PRIVILEGES;
```

### 索引已存在错误

```
Duplicate key name 'idx_conversation_model_card_id'
```

**解决**：索引已存在，可以忽略此错误。迁移脚本会自动处理。

### 清理后前端仍报错

**可能原因**：
1. 后端未重启 → 重启 ragflow-server
2. Redis 缓存未清除 → `redis-cli FLUSHDB`
3. 前端缓存问题 → 清除浏览器缓存或硬刷新（Ctrl+Shift+R）

---

## 数据影响评估

### 迁移对现有数据的影响

| 操作 | 影响 | 风险等级 |
|------|------|---------|
| 添加 `model_card_id` 列 | 无，新列默认 NULL | 🟢 低 |
| 创建索引 | 短暂锁表（秒级） | 🟢 低 |
| 删除 NULL 记录 | 删除未迁移的旧对话 | 🟡 中 |
| 清理 FreeChat 会话 | 删除无效会话引用 | 🟢 低 |

### 预计执行时间

| 数据量 | 迁移时间 | 清理时间 |
|--------|---------|---------|
| < 1万条 | < 1秒 | < 5秒 |
| 1-10万条 | 1-5秒 | 5-30秒 |
| > 10万条 | 5-30秒 | 30-120秒 |

---

## 回滚方案

### 如果迁移出现问题

#### 1. 恢复数据库备份

```bash
# MySQL
mysql -u root -p rag_flow < backup_ragflow_YYYYMMDD_HHMMSS.sql

# PostgreSQL
psql -U postgres -d rag_flow < backup_ragflow_YYYYMMDD_HHMMSS.sql
```

#### 2. 手动删除列（不推荐）

```sql
-- MySQL
ALTER TABLE conversation DROP COLUMN model_card_id;
DROP INDEX idx_conversation_model_card_id ON conversation;

-- PostgreSQL
ALTER TABLE conversation DROP COLUMN model_card_id;
DROP INDEX idx_conversation_model_card_id;
```

**警告**：回滚后将无法使用 Model Card 功能！

---

## 后续步骤

迁移成功后，确保：

1. ✅ 前端能正常创建对话
2. ✅ 对话能正确关联 Model Card
3. ✅ 参数覆盖逻辑正常工作（Session > Card > Bot）
4. ✅ 消息历史正确保存
5. ✅ 会话切换功能正常

### 功能测试清单

- [ ] 创建新对话并选择 Model Card
- [ ] 发送消息并验证参数正确应用
- [ ] 切换 Model Card 并验证参数更新
- [ ] 刷新页面验证会话恢复
- [ ] 检查旧对话（如果保留）是否可访问

---

## 技术细节

### 表结构变更

```sql
-- 新增字段
model_card_id INT NULL

-- 新增索引
INDEX idx_conversation_model_card_id (model_card_id)
```

### 数据模型更新

```python
class Conversation(DataBaseModel):
    # ... 其他字段 ...
    model_card_id = IntegerField(
        null=True, 
        index=True, 
        help_text="current model card ID for this conversation"
    )
```

### API 变更

**`/v1/conversation/set` - 现在接受 `model_card_id`**

请求体：
```json
{
  "dialog_id": "xxx",
  "conversation_id": "xxx",
  "name": "对话名称",
  "is_new": true,
  "model_card_id": 2,  // ← 新增字段（必需）
  "message": [...]
}
```

**`/v1/conversation/completion` - 现在要求 `model_card_id`**

请求体：
```json
{
  "conversation_id": "xxx",
  "messages": [...],
  "model_card_id": 1,  // ← 现在是必需字段
  "temperature": 0.7,
  "top_p": 0.9
}
```

---

## 支持

如有问题，请检查：

1. 日志文件：`logs/ragflow_server.log`
2. 数据库错误日志：`/var/log/mysql/error.log`
3. 迁移脚本输出：详细的步骤和错误信息

---

**文档版本**: 1.0  
**更新时间**: 2024年  
**适用版本**: RAGFlow v0.20.5+
