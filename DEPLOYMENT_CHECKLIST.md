# 🚀 部署检查清单

## ❌ 你当前遇到的问题

**症状**: 仍然看到 "ERROR: list index out of range"

**原因**: **代码已修复，但远程服务器未重启**

---

## ✅ 部署步骤（必须按顺序执行）

### 步骤1：确认代码已同步到服务器

```bash
# 在远程服务器上执行
cd /path/to/ragflow

# 检查关键行是否正确
sed -n '610,615p' api/apps/conversation_app.py

# 应该看到：
# ConversationService.update_by_id(conv.id, conv.to_dict())
# logging.info(f"[completion] Saved user messages...")
# (空行)
# def stream():
```

**如果看不到空行**：
```bash
# 从本地上传最新代码
scp api/apps/conversation_app.py user@server:/path/to/ragflow/api/apps/
```

---

### 步骤2：重启Python服务（**关键！**）

```bash
# 在远程服务器上执行

# 方法A：如果使用systemd
sudo systemctl restart ragflow-server
sudo systemctl restart ragflow-task-executor

# 方法B：手动重启
pkill -f "ragflow_server.py|task_executor.py"
bash docker/launch_backend_service.sh

# 方法C：如果在Docker中
docker-compose restart ragflow-server
```

**验证服务已重启**：
```bash
# 检查进程
ps aux | grep ragflow_server.py

# 检查日志（应该看到新的启动日志）
tail -f /var/log/ragflow/server.log
```

---

### 步骤3：验证修复生效

**测试1：检查API响应**

```bash
curl -X POST 'https://rag.limitee.cn/v1/conversation/completion' \
  -H 'Authorization: Bearer Q4OTk4ODM2OWVjNTExZjBiMTA2ZjY4YT' \
  -H 'Content-Type: application/json' \
  -d '{
    "conversation_id":"7728c8161bc6441eada0d58c45514b2d",
    "messages":[{"id":"verify-fix","role":"user","content":"验证修复"}],
    "model_card_id":1,
    "kb_ids":[]
  }'
```

**预期结果**（SSE流）：
```
data:{"code":0,"message":"","data":{"answer":"已进入专业模式...
data:{"code":0,"message":"","data":true}
```

**不应该看到**：
```json
{"code":100,"message":"UnboundLocalError..."}
```

---

**测试2：检查响应头**

```bash
curl -I -X POST 'https://rag.limitee.cn/v1/conversation/completion' \
  -H 'Authorization: Bearer Q4OTk4ODM2OWVjNTExZjBiMTA2ZjY4YT' \
  -H 'Content-Type: application/json' \
  -d '{...}'
```

**预期**：
```
HTTP/1.1 200 OK
Content-Type: text/event-stream; charset=utf-8
```

**不应该是**：
```
Content-Type: application/json
```

---

## 🔍 故障排查

### 问题A：仍然返回ERROR

**可能原因**：
1. ❌ 服务未重启
2. ❌ 代码未同步到服务器
3. ❌ Python缓存未清理

**解决**：
```bash
# 清理Python缓存
find . -type d -name __pycache__ -exec rm -rf {} +
find . -name "*.pyc" -delete

# 强制重启
pkill -9 -f ragflow_server.py
sleep 2
bash docker/launch_backend_service.sh
```

---

### 问题B：请求超时

**可能原因**：
1. ❌ chat()函数仍然抛出异常
2. ❌ 知识库加载失败
3. ❌ LLM API超时

**检查日志**：
```bash
tail -f /var/log/ragflow/server.log | grep -E "completion|ERROR|chat"
```

**应该看到**：
```
[completion] Saved user messages before streaming for conv xxx
[chat] Entering chat function - dialog.kb_ids: []
[completion] Saved assistant response after streaming for conv xxx
```

---

### 问题C：语法错误

**验证Python语法**：
```bash
cd /path/to/ragflow
python -m py_compile api/apps/conversation_app.py

# 如果有错误，会显示行号和错误信息
```

---

## 📋 关键代码检查点

**Line 599-614** 应该是：

```python
req["model_card_id"] = model_card_id
req.update(chat_model_config)

# Determine if this is an embedded chat
is_embedded = bool(chat_model_id)

# CRITICAL FIX: Save user message BEFORE starting chat stream
if not is_embedded:
    ConversationService.update_by_id(conv.id, conv.to_dict())
    logging.info(f"[completion] Saved user messages...")

def stream():  # ← 这里必须有空行！
    nonlocal dia, msg, req, conv
```

**关键**：
- ✅ `is_embedded` 在使用前定义
- ✅ `def stream():` 前有空行
- ✅ 缩进正确（8个空格）

---

## ⚠️ 重要提醒

### 1. 代码在本地修改，服务器上运行

- 本地修改 ≠ 服务器上生效
- **必须同步代码到服务器**
- **必须重启服务**

### 2. Python不支持热加载

- 修改`.py`文件后**必须重启**
- 不像前端JS可以自动刷新
- **进程必须完全重新启动**

### 3. 缓存可能导致问题

- Python `.pyc` 缓存
- 浏览器HTTP缓存
- **都需要清理**

---

## ✅ 验证成功的标志

1. ✅ **API返回SSE流**（不是JSON错误）
2. ✅ **Content-Type: text/event-stream**
3. ✅ **响应包含`data:{...}`格式**
4. ✅ **无"UnboundLocalError"或"list index out of range"**
5. ✅ **日志显示"Saved user messages before streaming"**

---

## 🎯 快速验证命令（在服务器上）

```bash
# 一键检查并修复
cd /path/to/ragflow && \
grep -n "def stream()" api/apps/conversation_app.py | head -1 && \
pkill -f ragflow_server.py && \
sleep 2 && \
bash docker/launch_backend_service.sh && \
sleep 5 && \
curl -s -X POST 'https://rag.limitee.cn/v1/conversation/completion' \
  -H 'Authorization: Bearer Q4OTk4ODM2OWVjNTExZjBiMTA2ZjY4YT' \
  -H 'Content-Type: application/json' \
  -d '{"conversation_id":"test","messages":[{"id":"test","role":"user","content":"test"}],"model_card_id":1,"kb_ids":[]}' \
  | head -n 2
```

**成功的输出**：
```
614:        def stream():
data:{"code":0,...
```

---

**下一步**：请在你的**远程服务器**上执行"步骤2：重启Python服务"，然后告诉我结果！
