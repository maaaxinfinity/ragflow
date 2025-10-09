# CORS 配置修复指南

## 🔍 问题诊断

**症状**：
```
浏览器错误：已阻止 CORS 请求
发起程序：https://law.workspace.limitee.cn/
允许的 Origin（来自响应头）：http://127.0.0.1:9380
```

**原因**：
1. 后端返回了错误的 `Access-Control-Allow-Origin` 头
2. Flask-CORS 不能同时使用 `origins=["*"]` 和 `supports_credentials=True`
3. 后端服务可能没有重启，旧配置还在生效

---

## ✅ 解决方案

### 步骤 1：修复 Flask-CORS 配置（已完成）

**文件**：`api/apps/__init__.py`

**修改前**（错误）：
```python
CORS(app, 
     supports_credentials=True,
     origins=["*"],  # ← 不能和 credentials=True 一起用
     ...)
```

**修改后**（正确）：
```python
CORS(app, 
     supports_credentials=True,
     origins=[
         "https://law.workspace.limitee.cn",
         "https://rag.limitee.cn",
         "http://localhost:8000",
         "http://localhost:8001",
         # 注意：移除了 "*"
     ],
     allow_headers=["Content-Type", "Authorization", "X-Requested-With", "Accept"],
     expose_headers=["Authorization"],
     methods=["GET", "POST", "PUT", "DELETE", "OPTIONS", "PATCH"])
```

---

### 步骤 2：重启 RAGFlow 后端（关键！）

```bash
cd ~/workspace/ragflow

# 停止容器
docker stop ragflow-server-dev

# 启动容器
docker start ragflow-server-dev

# 或者直接重启
docker restart ragflow-server-dev

# 等待服务启动（约 10 秒）
sleep 10

# 查看日志确认启动成功
docker logs --tail 100 ragflow-server-dev | grep -i "running on"
```

**重要**：必须完全重启 Docker 容器，才能应用新的 CORS 配置！

---

### 步骤 3：验证 CORS 配置

#### 测试 1：检查 CORS 头

```bash
# 测试 OPTIONS 预检请求
curl -X OPTIONS \
     -H "Origin: https://law.workspace.limitee.cn" \
     -H "Access-Control-Request-Method: POST" \
     -H "Access-Control-Request-Headers: Authorization, Content-Type" \
     -v https://rag.limitee.cn/v1/user/info

# 应该看到：
# Access-Control-Allow-Origin: https://law.workspace.limitee.cn
# Access-Control-Allow-Credentials: true
```

#### 测试 2：检查实际请求

```bash
curl -H "Origin: https://law.workspace.limitee.cn" \
     -H "Authorization: Bearer your-token" \
     -v https://rag.limitee.cn/v1/system/status

# 检查响应头中的：
# Access-Control-Allow-Origin: https://law.workspace.limitee.cn
```

#### 测试 3：浏览器测试

1. 访问：https://law.workspace.limitee.cn
2. 打开开发者工具（F12）→ Network 标签
3. 刷新页面
4. 查看任意 API 请求（如 `/v1/user/info`）
5. 检查 Response Headers：
   ```
   Access-Control-Allow-Origin: https://law.workspace.limitee.cn
   Access-Control-Allow-Credentials: true
   ```

---

## 🔍 故障排查

### 问题 1：后端仍然返回错误的 Origin

**症状**：`Access-Control-Allow-Origin: http://127.0.0.1:9380`

**排查**：
```bash
# 1. 确认容器是否重启
docker ps | grep ragflow-server-dev

# 2. 检查容器启动时间（应该是最近）
docker inspect ragflow-server-dev | grep StartedAt

# 3. 检查配置文件是否挂载正确
docker exec ragflow-server-dev cat /ragflow/api/apps/__init__.py | grep "CORS(app"
```

**解决**：
- 确保 Docker 容器完全重启
- 检查是否有挂载问题（开发模式应该挂载了 `../api:/ragflow/api`）

---

### 问题 2：仍然有 CORS 错误

**症状**：浏览器控制台仍然显示 CORS 错误

**排查**：
```bash
# 检查外部 Nginx 是否添加了冲突的 CORS 头
curl -I https://rag.limitee.cn/v1/system/status | grep -i "access-control"

# 如果看到多个 Access-Control-Allow-Origin 头，说明 Nginx 也在添加
```

**解决**：
- 确保外部 Nginx **不要**添加 CORS 头
- 让后端 Flask-CORS 统一处理 CORS

**外部 Nginx 正确配置**：
```nginx
location / {
    proxy_pass http://49.232.140.181:19012;
    # ... 其他配置
    
    # 不要添加这些！让后端处理 CORS
    # add_header Access-Control-Allow-Origin ...  # ← 删除
    # add_header Access-Control-Allow-Methods ... # ← 删除
}
```

---

### 问题 3：OPTIONS 预检请求失败

**症状**：浏览器发送 OPTIONS 请求，返回 404 或其他错误

**排查**：
```bash
curl -X OPTIONS \
     -H "Origin: https://law.workspace.limitee.cn" \
     -H "Access-Control-Request-Method: POST" \
     -v https://rag.limitee.cn/v1/user/info
```

**解决**：
- Flask-CORS 应该自动处理 OPTIONS 请求
- 检查后端日志是否有错误
- 确保 Nginx 不会拦截 OPTIONS 请求

---

## 📊 CORS 工作原理

### 简单请求（无预检）

```
浏览器 → 服务器
  GET /v1/system/status
  Origin: https://law.workspace.limitee.cn

服务器 → 浏览器
  Access-Control-Allow-Origin: https://law.workspace.limitee.cn
  Access-Control-Allow-Credentials: true
```

### 复杂请求（有预检）

```
1. 预检请求（OPTIONS）
浏览器 → 服务器
  OPTIONS /v1/user/info
  Origin: https://law.workspace.limitee.cn
  Access-Control-Request-Method: POST
  Access-Control-Request-Headers: Authorization

服务器 → 浏览器
  Access-Control-Allow-Origin: https://law.workspace.limitee.cn
  Access-Control-Allow-Methods: POST, GET, ...
  Access-Control-Allow-Headers: Authorization, ...
  Access-Control-Allow-Credentials: true

2. 实际请求
浏览器 → 服务器
  POST /v1/user/info
  Origin: https://law.workspace.limitee.cn
  Authorization: Bearer xxx

服务器 → 浏览器
  Access-Control-Allow-Origin: https://law.workspace.limitee.cn
  Access-Control-Allow-Credentials: true
```

---

## ✅ 检查清单

- [ ] `api/apps/__init__.py` 的 CORS 配置已修改
- [ ] 移除了 `origins=["*"]`（不能和 credentials 一起用）
- [ ] 添加了所有需要的域名到 `origins` 列表
- [ ] Docker 容器已完全重启
- [ ] 使用 `docker logs` 确认服务启动成功
- [ ] 使用 curl 测试 CORS 头正确
- [ ] 浏览器中 API 请求不再有 CORS 错误
- [ ] 外部 Nginx 没有添加冲突的 CORS 头

---

## 🎯 最终配置

### 后端 CORS（api/apps/__init__.py）

```python
CORS(app, 
     supports_credentials=True,  # 允许携带 Cookie/认证信息
     max_age=2592000,  # 预检请求缓存 30 天
     origins=[
         "https://law.workspace.limitee.cn",  # 生产环境前端
         "https://rag.limitee.cn",           # API 域名
         "http://localhost:8000",            # 本地开发
         "http://localhost:8001",
         "http://127.0.0.1:8000",
         "http://127.0.0.1:8001",
     ],
     allow_headers=["Content-Type", "Authorization", "X-Requested-With", "Accept"],
     expose_headers=["Authorization"],  # 允许前端读取的响应头
     methods=["GET", "POST", "PUT", "DELETE", "OPTIONS", "PATCH"])
```

### 外部 Nginx（rag.limitee.cn）

```nginx
server {
    listen 443 ssl;
    server_name rag.limitee.cn;
    
    location / {
        proxy_pass http://49.232.140.181:19012;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        
        # 不要添加 CORS 头，让后端处理！
    }
}
```

---

**最后更新**：2025-01-10  
**状态**：等待用户重启后端服务并验证
