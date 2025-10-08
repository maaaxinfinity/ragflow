# 修复 model_card_id 错误 - 完整指南

## 问题描述

前端调用 `/v1/conversation/set` 接口时报错：

```json
{
    "code": 100,
    "data": "Unknown column 'model_card_id' in 'field list'",
    "message": "1054"
}
```

**根本原因**：数据库表 `conversation` 缺少 `model_card_id` 列。

---

## 快速修复（3种方案）

### 🔧 方案 1：自动化迁移脚本（推荐）

#### 步骤 1：启动数据库服务

确保 Docker 服务正在运行：

```bash
# Windows
# 启动 Docker Desktop

# Linux/Mac
sudo systemctl start docker

# 启动 RAGFlow 的数据库服务
cd d:\workspace\ragflow\docker
docker compose up -d mysql
```

#### 步骤 2：运行迁移脚本（预览模式）

```bash
# 先预览将要执行的操作
cd d:\workspace\ragflow
.venv\Scripts\python.exe simple_migrate.py --dry-run --host localhost --port 5455 --user root --password infini_rag_flow --database rag_flow
```

**预期输出**：
```
============================================================
RAGFlow Model Card 数据库迁移
============================================================

数据库配置:
  主机: localhost:5455
  用户: root
  数据库: rag_flow

✓ 数据库连接成功

============================================================
步骤 1: 添加 model_card_id 列到 conversation 表
============================================================
[DRY RUN] 将执行以下操作:
  - ALTER TABLE conversation ADD COLUMN model_card_id INT NULL
  - CREATE INDEX idx_conversation_model_card_id ON conversation(model_card_id)

============================================================
步骤 2: 清理未迁移的对话数据
============================================================
找到 XX 条 model_card_id 为 NULL 的对话记录
[DRY RUN] 将删除以下记录:
  ...

✓ 所有操作完成
```

#### 步骤 3：执行实际迁移

```bash
# 自动确认所有操作
.venv\Scripts\python.exe simple_migrate.py --yes --host localhost --port 5455 --user root --password infini_rag_flow --database rag_flow

# 或者手动确认每一步
.venv\Scripts\python.exe simple_migrate.py --host localhost --port 5455 --user root --password infini_rag_flow --database rag_flow
```

#### 步骤 4：重启后端服务

```bash
# Docker 环境
cd docker
docker compose restart ragflow-server

# 本地开发环境
# Windows PowerShell
Stop-Process -Name "python" -Force
bash docker/launch_backend_service.sh

# Linux/Mac
pkill -f "ragflow_server.py"
bash docker/launch_backend_service.sh
```

---

### 🐘 方案 2：直接执行 SQL（快速）

#### 步骤 1：连接数据库

```bash
# 使用 Docker exec 进入 MySQL 容器
cd d:\workspace\ragflow\docker
docker compose exec mysql mysql -u root -pinfini_rag_flow rag_flow

# 或者使用 MySQL 客户端
mysql -h localhost -P 5455 -u root -pinfini_rag_flow rag_flow
```

#### 步骤 2：执行迁移 SQL

```sql
-- 添加 model_card_id 列
ALTER TABLE conversation ADD COLUMN model_card_id INT NULL;

-- 添加索引
CREATE INDEX idx_conversation_model_card_id ON conversation(model_card_id);

-- 验证
DESCRIBE conversation;
-- 应该看到 model_card_id | int | YES | MUL | NULL |

-- 查看统计
SELECT 
    COUNT(*) as total,
    SUM(CASE WHEN model_card_id IS NULL THEN 1 ELSE 0 END) as null_count,
    SUM(CASE WHEN model_card_id IS NOT NULL THEN 1 ELSE 0 END) as with_card
FROM conversation;
```

#### 步骤 3：清理旧数据（可选）

```sql
-- ⚠️ 警告：这会删除所有未关联 Model Card 的对话
-- 请先备份数据

-- 查看将要删除的记录
SELECT id, dialog_id, user_id, name 
FROM conversation 
WHERE model_card_id IS NULL 
LIMIT 10;

-- 确认后删除
DELETE FROM conversation WHERE model_card_id IS NULL;

-- 查看删除结果
SELECT ROW_COUNT() as deleted_count;
```

#### 步骤 4：退出并重启服务

```sql
EXIT;
```

```bash
# 重启后端
cd docker
docker compose restart ragflow-server
```

---

### 📄 方案 3：使用现有的 SQL 文件

项目已经包含了迁移 SQL 文件。

#### 步骤 1：连接数据库

```bash
cd d:\workspace\ragflow
docker compose -f docker/docker-compose.yml exec mysql bash
```

#### 步骤 2：执行 SQL 文件

```bash
# 在容器内执行
mysql -u root -pinfini_rag_flow rag_flow < /workspace/api/db/migrations/002_add_model_card_id_to_conversation.sql

# 或者从宿主机执行
mysql -h localhost -P 5455 -u root -pinfini_rag_flow rag_flow < api/db/migrations/002_add_model_card_id_to_conversation.sql
```

#### 步骤 3：验证

```bash
docker compose -f docker/docker-compose.yml exec mysql mysql -u root -pinfini_rag_flow rag_flow -e "DESCRIBE conversation;"
```

---

## 验证迁移成功

### 1. 检查数据库表结构

```sql
DESCRIBE conversation;
```

**预期输出**（包含以下行）：
```
+---------------+-------------+------+-----+---------+-------+
| Field         | Type        | Null | Key | Default | Extra |
+---------------+-------------+------+-----+---------+-------+
| ...           | ...         | ...  | ... | ...     | ...   |
| model_card_id | int         | YES  | MUL | NULL    |       |
+---------------+-------------+------+-----+---------+-------+
```

### 2. 检查索引

```sql
SHOW INDEX FROM conversation WHERE Key_name = 'idx_conversation_model_card_id';
```

**预期输出**：
```
+---------------+------------+----------------------------------+
| Table         | Key_name   | Column_name                      |
+---------------+------------+----------------------------------+
| conversation  | idx_conv...| model_card_id                    |
+---------------+------------+----------------------------------+
```

### 3. 测试 API 请求

使用 curl 或 Postman 测试：

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

**预期响应（成功）**：
```json
{
  "code": 0,
  "message": "success",
  "data": {
    "id": "44f91620f8074d438f9b1e47b7d685d9",
    "dialog_id": "6736839ca04111f0b54acaa48f96c61c",
    "model_card_id": 2,
    "name": "测试对话",
    ...
  }
}
```

---

## 数据备份（强烈推荐）

**在执行任何迁移前，请备份数据库！**

### MySQL 备份

```bash
# 完整数据库备份
docker compose -f docker/docker-compose.yml exec mysql mysqldump -u root -pinfini_rag_flow rag_flow > backup_$(date +%Y%m%d_%H%M%S).sql

# 或者从宿主机
mysqldump -h localhost -P 5455 -u root -pinfini_rag_flow rag_flow > backup_$(date +%Y%m%d_%H%M%S).sql

# 仅备份 conversation 表
mysqldump -h localhost -P 5455 -u root -pinfini_rag_flow rag_flow conversation > backup_conversation_$(date +%Y%m%d_%H%M%S).sql
```

### 恢复备份

```bash
# 恢复完整数据库
mysql -h localhost -P 5455 -u root -pinfini_rag_flow rag_flow < backup_20250115_120000.sql

# 恢复单表
mysql -h localhost -P 5455 -u root -pinfini_rag_flow rag_flow < backup_conversation_20250115_120000.sql
```

---

## 常见问题排查

### ❌ 问题 1：数据库连接失败

**错误信息**：
```
Can't connect to MySQL server on 'localhost'
```

**解决方法**：

1. 检查 Docker 是否运行：
   ```bash
   docker ps
   ```

2. 检查 MySQL 容器状态：
   ```bash
   cd docker
   docker compose ps mysql
   ```

3. 启动 MySQL 容器：
   ```bash
   docker compose up -d mysql
   ```

4. 检查端口映射：
   ```bash
   docker compose port mysql 3306
   # 应该输出: 0.0.0.0:5455
   ```

---

### ❌ 问题 2：权限不足

**错误信息**：
```
Access denied for user 'root'@'localhost'
```

**解决方法**：

1. 检查密码是否正确（在 `docker/.env` 文件中）：
   ```bash
   type docker\.env | Select-String "MYSQL_PASSWORD"
   ```

2. 使用正确的密码：
   ```bash
   # 默认密码是 infini_rag_flow
   mysql -h localhost -P 5455 -u root -pinfini_rag_flow rag_flow
   ```

---

### ❌ 问题 3：索引已存在

**错误信息**：
```
Duplicate key name 'idx_conversation_model_card_id'
```

**解决方法**：

这是正常的，说明索引已经存在。可以忽略此错误，或者先删除再创建：

```sql
-- 删除旧索引
DROP INDEX idx_conversation_model_card_id ON conversation;

-- 重新创建
CREATE INDEX idx_conversation_model_card_id ON conversation(model_card_id);
```

---

### ❌ 问题 4：迁移后前端仍报错

**可能原因**：

1. **后端未重启** → 重启 ragflow-server
2. **Redis 缓存未清除** → 清除 Redis 缓存
3. **前端缓存问题** → 硬刷新浏览器（Ctrl+Shift+R）

**解决步骤**：

```bash
# 1. 重启后端
cd docker
docker compose restart ragflow-server

# 2. 清除 Redis 缓存（可选）
docker compose exec redis redis-cli FLUSHDB

# 3. 清除浏览器缓存
# 按 Ctrl+Shift+Delete 或 Ctrl+Shift+R
```

---

## 脚本选项说明

### simple_migrate.py 参数

```bash
# 预览模式（不修改数据）
python simple_migrate.py --dry-run

# 仅执行迁移（不清理旧数据）
python simple_migrate.py --migrate-only --yes

# 仅清理数据（假设已迁移）
python simple_migrate.py --cleanup-only --yes

# 完整迁移+清理（自动确认）
python simple_migrate.py --yes

# 手动指定数据库连接
python simple_migrate.py \
  --host localhost \
  --port 5455 \
  --user root \
  --password infini_rag_flow \
  --database rag_flow \
  --yes
```

---

## 数据影响评估

### 迁移对现有数据的影响

| 操作 | 影响 | 风险 | 耗时 |
|------|------|------|------|
| 添加 model_card_id 列 | 无数据丢失，新列默认 NULL | 🟢 低 | < 1秒 |
| 创建索引 | 短暂锁表（秒级） | 🟢 低 | < 5秒 |
| 删除 NULL 记录 | 删除未迁移的旧对话 | 🟡 中 | 取决于数据量 |

### 清理数据的后果

如果执行 `DELETE FROM conversation WHERE model_card_id IS NULL`：

- ✅ 优点：
  - 数据库保持干净
  - 所有对话都有明确的 Model Card 关联
  - 避免前端显示"未选择助手"的旧对话

- ❌ 缺点：
  - 旧对话将被永久删除
  - 用户需要重新创建对话

**建议**：
- 如果是测试环境 → 直接清理
- 如果是生产环境 → 保留旧数据（`--migrate-only`）

---

## 后续测试清单

迁移完成后，请验证以下功能：

- [ ] 创建新对话并选择 Model Card
- [ ] 发送消息验证对话流程
- [ ] 切换 Model Card 并验证参数更新
- [ ] 刷新页面验证会话恢复
- [ ] 检查旧对话（如果保留）是否可访问
- [ ] 验证参数优先级（Session > Card > Bot）
- [ ] 测试多用户场景（团队隔离）

---

## 技术细节

### 表结构变更

```sql
-- 新增字段
model_card_id INT NULL

-- 新增索引
INDEX idx_conversation_model_card_id (model_card_id)
```

### 代码层面支持

代码已经完全支持 `model_card_id`：

- ✅ `api/db/db_models.py` - Conversation 模型已定义字段
- ✅ `api/apps/conversation_app.py` - `/set` 端点已处理
- ✅ `api/db/services/conversation_service.py` - 服务层已支持
- ✅ 前端 - 已传递 `model_card_id` 参数

**唯一的问题**：数据库表结构未更新。

---

## 获取帮助

如果遇到问题：

1. 查看后端日志：
   ```bash
   docker compose logs -f ragflow-server
   ```

2. 查看 MySQL 日志：
   ```bash
   docker compose logs -f mysql
   ```

3. 检查数据库状态：
   ```sql
   SHOW PROCESSLIST;
   SHOW ENGINE INNODB STATUS;
   ```

4. 联系技术支持并提供：
   - 错误信息截图
   - 迁移脚本输出
   - 数据库版本：`SELECT VERSION();`

---

## 相关文件

- `simple_migrate.py` - 简化版迁移脚本（推荐使用）
- `migrate_and_cleanup.py` - 完整版迁移脚本（需要项目依赖）
- `api/db/migrations/002_add_model_card_id_to_conversation.sql` - SQL 迁移文件
- `MIGRATION_GUIDE.md` - 详细迁移指南

---

**最后更新**: 2025-01  
**适用版本**: RAGFlow v0.20.5+  
**作者**: AI Agent
