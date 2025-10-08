# Model Card 错误修复 - 文件说明

## 📋 问题总结

前端访问 `/v1/conversation/set` 时报错：`Unknown column 'model_card_id' in 'field list'`

**根本原因**：数据库表 `conversation` 缺少 `model_card_id` 列。

**解决方案**：执行数据库迁移，添加缺失的列。

---

## 📁 已创建的文件

### 1. 🔧 `simple_migrate.py` - 简化版迁移脚本（推荐）

**特点**：
- ✅ 独立脚本，不依赖 RAGFlow 其他模块
- ✅ 仅需要 `pymysql` 依赖
- ✅ 支持 dry-run 预览模式
- ✅ 自动检测列是否已存在
- ✅ 支持清理旧数据
- ✅ Windows 控制台编码友好

**使用方法**：

```bash
# 安装依赖
.venv\Scripts\pip.exe install pymysql

# 预览迁移操作
.venv\Scripts\python.exe simple_migrate.py --dry-run --host localhost --port 5455 --user root --password infini_rag_flow --database rag_flow

# 执行迁移
.venv\Scripts\python.exe simple_migrate.py --yes --host localhost --port 5455 --user root --password infini_rag_flow --database rag_flow
```

---

### 2. 🛠️ `migrate_and_cleanup.py` - 完整版迁移脚本

**特点**：
- ✅ 集成 RAGFlow 的 ORM 层
- ✅ 支持 MySQL 和 PostgreSQL
- ✅ 自动处理 FreeChat 会话清理
- ✅ 完整的数据验证

**限制**：
- ⚠️ 需要安装完整的项目依赖
- ⚠️ 需要正确配置环境变量

**使用方法**：

```bash
# 需要先安装项目依赖
cd d:\workspace\ragflow
uv sync --python 3.10 --all-extras

# 运行脚本
python migrate_and_cleanup.py --dry-run
python migrate_and_cleanup.py --yes
```

---

### 3. 📖 `FIX_MODEL_CARD_ERROR.md` - 快速修复指南

**包含内容**：
- ✅ 3 种修复方案（自动化脚本 / 手动 SQL / 使用现有 SQL 文件）
- ✅ 详细的步骤说明
- ✅ 数据备份方法
- ✅ 常见问题排查
- ✅ 验证步骤

**适合人群**：需要快速修复问题的运维人员或开发者

---

### 4. 📘 `MIGRATION_GUIDE.md` - 完整迁移指南

**包含内容**：
- ✅ 详细的迁移流程
- ✅ 技术细节说明
- ✅ API 变更说明
- ✅ 安全考虑
- ✅ 回滚方案

**适合人群**：需要深入了解迁移细节的开发者

---

## 🚀 快速开始（推荐步骤）

### 步骤 1：启动数据库

```bash
cd d:\workspace\ragflow\docker
docker compose up -d mysql
```

### 步骤 2：执行迁移

**方案 A：使用 Python 脚本（推荐）**

```bash
cd d:\workspace\ragflow

# 安装依赖
.venv\Scripts\pip.exe install pymysql

# 预览
.venv\Scripts\python.exe simple_migrate.py --dry-run --host localhost --port 5455 --user root --password infini_rag_flow --database rag_flow

# 执行
.venv\Scripts\python.exe simple_migrate.py --yes --host localhost --port 5455 --user root --password infini_rag_flow --database rag_flow
```

**方案 B：直接执行 SQL（最快）**

```bash
# 连接数据库
mysql -h localhost -P 5455 -u root -pinfini_rag_flow rag_flow

# 或者使用 Docker
docker compose -f docker/docker-compose.yml exec mysql mysql -u root -pinfini_rag_flow rag_flow
```

```sql
-- 执行迁移
ALTER TABLE conversation ADD COLUMN model_card_id INT NULL;
CREATE INDEX idx_conversation_model_card_id ON conversation(model_card_id);

-- 验证
DESCRIBE conversation;

-- 清理旧数据（可选）
DELETE FROM conversation WHERE model_card_id IS NULL;

-- 退出
EXIT;
```

### 步骤 3：重启后端

```bash
cd docker
docker compose restart ragflow-server
```

### 步骤 4：验证

使用浏览器或 curl 测试前端功能，确认错误已解决。

---

## 📊 迁移脚本对比

| 特性 | simple_migrate.py | migrate_and_cleanup.py | 手动 SQL |
|------|------------------|----------------------|---------|
| **依赖** | 仅 pymysql | 完整项目依赖 | 无 |
| **易用性** | ⭐⭐⭐⭐⭐ | ⭐⭐⭐ | ⭐⭐⭐⭐ |
| **功能完整性** | ⭐⭐⭐⭐ | ⭐⭐⭐⭐⭐ | ⭐⭐⭐ |
| **执行速度** | 快 | 中等 | 最快 |
| **错误处理** | 完善 | 最完善 | 需手动 |
| **适用场景** | 生产环境迁移 | 开发环境测试 | 紧急修复 |

**推荐顺序**：
1. 🥇 `simple_migrate.py` - 最平衡的选择
2. 🥈 手动 SQL - 最快速的修复
3. 🥉 `migrate_and_cleanup.py` - 需要完整测试时

---

## ⚠️ 重要提醒

### 备份数据

**在执行任何迁移前，务必备份数据库！**

```bash
# MySQL 备份
mysqldump -h localhost -P 5455 -u root -pinfini_rag_flow rag_flow > backup_$(date +%Y%m%d_%H%M%S).sql

# 恢复
mysql -h localhost -P 5455 -u root -pinfini_rag_flow rag_flow < backup_20250115_120000.sql
```

### 数据清理影响

执行 `DELETE FROM conversation WHERE model_card_id IS NULL` 会：
- ✅ 删除所有未关联 Model Card 的旧对话
- ❌ 用户需要重新创建这些对话

**建议**：
- 测试环境：直接清理
- 生产环境：使用 `--migrate-only` 保留旧数据

---

## 🔍 验证迁移成功

### 1. 检查数据库

```sql
-- 查看表结构
DESCRIBE conversation;
-- 应该看到 model_card_id 列

-- 查看索引
SHOW INDEX FROM conversation WHERE Key_name = 'idx_conversation_model_card_id';
-- 应该看到索引

-- 统计数据
SELECT 
    COUNT(*) as total,
    SUM(CASE WHEN model_card_id IS NULL THEN 1 ELSE 0 END) as null_count,
    SUM(CASE WHEN model_card_id IS NOT NULL THEN 1 ELSE 0 END) as with_card
FROM conversation;
```

### 2. 测试 API

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
    "conversation_id":"test-conversation-id"
  }'
```

**成功响应**：
```json
{
  "code": 0,
  "message": "success",
  "data": {
    "id": "test-conversation-id",
    "model_card_id": 2,
    ...
  }
}
```

---

## 🆘 故障排查

### 问题 1：数据库连接失败

```bash
# 检查 Docker 容器
docker ps | grep mysql

# 启动 MySQL
cd docker
docker compose up -d mysql

# 检查端口映射
docker compose port mysql 3306
```

### 问题 2：权限不足

```bash
# 检查密码
type docker\.env | Select-String "MYSQL_PASSWORD"

# 使用正确的密码连接
mysql -h localhost -P 5455 -u root -p<正确的密码> rag_flow
```

### 问题 3：迁移后前端仍报错

```bash
# 重启后端
cd docker
docker compose restart ragflow-server

# 清除 Redis 缓存
docker compose exec redis redis-cli FLUSHDB

# 清除浏览器缓存（Ctrl+Shift+R）
```

---

## 📞 获取帮助

查看日志：

```bash
# 后端日志
docker compose logs -f ragflow-server

# MySQL 日志
docker compose logs -f mysql

# 查看数据库进程
docker compose exec mysql mysql -u root -p -e "SHOW PROCESSLIST;"
```

---

## 📚 相关文档

- `FIX_MODEL_CARD_ERROR.md` - 快速修复指南（推荐首先阅读）
- `MIGRATION_GUIDE.md` - 完整迁移指南
- `api/db/migrations/README.md` - 迁移系统说明
- `api/db/migrations/002_add_model_card_id_to_conversation.sql` - SQL 迁移文件

---

## ✅ 完成清单

迁移完成后，请确认：

- [ ] 数据库表包含 `model_card_id` 列
- [ ] 索引 `idx_conversation_model_card_id` 已创建
- [ ] 后端服务已重启
- [ ] 前端可以正常创建对话
- [ ] API 请求返回正确的 `model_card_id`
- [ ] 旧对话（如果保留）仍可访问
- [ ] 参数覆盖逻辑正常工作

---

**最后更新**: 2025-01  
**状态**: ✅ 就绪  
**作者**: AI Agent

---

## 📝 技术说明

### 为什么需要这个迁移？

RAGFlow 引入了 Model Card 系统，允许用户为每个对话关联特定的模型配置。这需要在 `conversation` 表中添加 `model_card_id` 字段来跟踪这个关联。

### 代码层面已支持

- ✅ `api/db/db_models.py:811` - Conversation 模型已定义字段
- ✅ `api/apps/conversation_app.py` - `/set` 和 `/completion` 端点已处理
- ✅ `api/db/services/conversation_service.py` - 服务层已支持
- ✅ 前端代码已传递 `model_card_id` 参数

**唯一缺失**：数据库表结构未更新 → 本迁移修复此问题。

---

**祝迁移顺利！** 🎉
