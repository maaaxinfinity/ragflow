# FreeChat 数据迁移指南

## 快速开始

### 方式 1: 使用便捷脚本（推荐）

```bash
# Linux/Mac
bash scripts/migrate_freechat.sh

# 仅验证不迁移
bash scripts/migrate_freechat.sh --verify-only
```

### 方式 2: 手动在 Docker 容器内执行

```bash
# 1. 查找容器
docker ps | grep ragflow

# 2. 进入容器执行迁移
docker exec -it <container_id> python -m api.db.migrations.migrate_freechat_to_sql

# 或使用容器名称
docker exec -it ragflow-server python -m api.db.migrations.migrate_freechat_to_sql

# 3. 验证迁移
docker exec -it ragflow-server python -m api.db.migrations.migrate_freechat_to_sql --verify-only
```

## 常见问题

### Q1: 为什么不能在宿主机直接运行？

**A**: 迁移脚本依赖 RAGFlow 的运行环境（opensearchpy, elasticsearch 等库），这些库只在 Docker 容器内安装。

### Q2: 迁移会影响现有数据吗？

**A**: 不会！迁移脚本：
- ✅ 只读取旧的 `sessions` JSON 字段
- ✅ 写入新的 `free_chat_session` 和 `free_chat_message` 表
- ✅ 支持增量迁移（不会重复迁移已存在的数据）
- ✅ 旧数据保持不变（用于回退）

### Q3: 迁移失败了怎么办？

**A**: 
1. 检查日志，找到失败原因
2. 修复问题后重新运行（支持增量迁移）
3. 如果需要，可以清空新表重新迁移：
   ```sql
   DELETE FROM free_chat_message;
   DELETE FROM free_chat_session;
   ```

### Q4: 如何验证迁移成功？

**A**:
```bash
# 方式 1: 使用验证命令
docker exec -it ragflow-server python -m api.db.migrations.migrate_freechat_to_sql --verify-only

# 方式 2: 查看数据库
docker exec -it ragflow-mysql mysql -u ragflow -p -e "
  SELECT COUNT(*) as session_count FROM ragflow.free_chat_session;
  SELECT COUNT(*) as message_count FROM ragflow.free_chat_message;
"
```

### Q5: 需要备份数据库吗？

**A**: 强烈建议备份！虽然迁移不会修改旧数据，但为了安全：

```bash
# MySQL 备份
docker exec ragflow-mysql mysqldump -u ragflow -p ragflow > backup_$(date +%Y%m%d).sql

# 恢复（如果需要）
docker exec -i ragflow-mysql mysql -u ragflow -p ragflow < backup_20250110.sql
```

## 迁移流程

```
1. 备份数据库 ✓
   ↓
2. 启动 RAGFlow 容器 ✓
   ↓
3. 执行迁移脚本
   ↓
4. 验证迁移结果
   ↓
5. 测试新 API
   ↓
6. 前端改造
```

## 容器名称参考

可能的容器名称（根据部署方式不同）：
- `ragflow-server`
- `ragflow_ragflow-server_1`
- `ragflow-ragflow-server-1`
- 通过镜像名查找：`docker ps --filter "ancestor=infiniflow/ragflow"`

## 示例：完整迁移流程

```bash
# 1. 进入项目目录
cd /path/to/ragflow

# 2. 备份数据库（可选但推荐）
docker exec ragflow-mysql mysqldump -u ragflow -pinfiniflow ragflow > backup.sql

# 3. 确认容器运行中
docker ps | grep ragflow

# 4. 执行迁移
bash scripts/migrate_freechat.sh

# 5. 验证结果
bash scripts/migrate_freechat.sh --verify-only

# 6. 查看迁移日志
# 日志会实时输出在终端
```

## Windows 用户注意

Windows 用户可以：

**方式 1**: 使用 Git Bash 运行脚本
```bash
bash scripts/migrate_freechat.sh
```

**方式 2**: 直接使用 Docker 命令
```bash
docker exec -it ragflow-server python -m api.db.migrations.migrate_freechat_to_sql
```

**方式 3**: 使用 PowerShell
```powershell
docker exec -it ragflow-server python -m api.db.migrations.migrate_freechat_to_sql
```

## 故障排查

### 错误: ModuleNotFoundError: No module named 'opensearchpy'

**原因**: 在宿主机运行了脚本，而不是在容器内

**解决**: 使用 `docker exec` 在容器内执行

### 错误: connection refused

**原因**: MySQL/Redis/ES 等服务未启动

**解决**: 
```bash
docker compose -f docker/docker-compose.yml up -d
```

### 错误: 找不到容器

**原因**: RAGFlow 未启动或容器名称不同

**解决**: 
```bash
# 查看所有运行中的容器
docker ps

# 使用实际的容器 ID 或名称
docker exec -it <actual_container_id> python -m api.db.migrations.migrate_freechat_to_sql
```

## 联系支持

如遇到问题，请提供：
1. 错误日志
2. Docker 版本：`docker --version`
3. 容器列表：`docker ps`
4. RAGFlow 版本

---

**最后更新**: 2025-01-10
