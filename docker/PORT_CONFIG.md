# RAGFlow 端口配置指南

## 📋 端口配置文件

所有端口配置统一在 **`docker/.env`** 文件中管理。

```bash
# 主配置文件
docker/.env
```

---

## 🔌 端口映射表

### RAGFlow 主服务

| 服务 | 环境变量 | 默认端口 | 容器内端口 | 说明 |
|------|---------|----------|-----------|------|
| RAGFlow API | `SVR_HTTP_PORT` | 9380 | 9380 | 主要 HTTP API 服务 |
| Nginx HTTP | - | 10080 | 80 | HTTP 访问入口 |
| Nginx HTTPS | - | 10443 | 443 | HTTPS 访问入口 |
| Debugpy | - | 5678 | 5678 | Python 远程调试 |
| Debugpy (Executor) | - | 5679 | 5679 | Task Executor 调试 |
| MCP Server | - | 9382 | 9382 | Model Context Protocol |

### 基础服务

| 服务 | 环境变量 | 默认端口 | 容器内端口 | 说明 |
|------|---------|----------|-----------|------|
| Elasticsearch | `ES_PORT` | 1200 | 9200 | 文档向量存储 |
| Kibana | `KIBANA_PORT` | 6601 | 5601 | ES 可视化界面 |
| OpenSearch | `OS_PORT` | 1201 | 9201 | 文档向量存储（备选） |
| Infinity | `INFINITY_HTTP_PORT` | 23820 | 23820 | 向量数据库（备选） |
| MySQL | `MYSQL_PORT` | 5455 | 3306 | 关系型数据库 |
| Redis | `REDIS_PORT` | 6379 | 6379 | 缓存和消息队列 |
| MinIO API | `MINIO_PORT` | 9000 | 9000 | 对象存储 API |
| MinIO Console | `MINIO_CONSOLE_PORT` | 9001 | 9001 | MinIO 管理界面 |

### 开发模式专用

| 服务 | 端口 | 说明 |
|------|------|------|
| **前端热重载** | 8000 | UmiJS 开发服务器（仅热重载模式） |

---

## 🔧 修改端口配置

### 方法1：修改 .env 文件（推荐）

```bash
# 编辑配置文件
vim docker/.env

# 修改 RAGFlow 主端口（例如改成 8080）
SVR_HTTP_PORT=8080

# 重启服务生效
cd docker
docker compose down
docker compose up -d
```

**支持的模式**：
- ✅ 生产模式 (`docker-compose.yml`)
- ✅ 开发模式 (`docker-compose-dev.yml`)
- ✅ 自动同步，无需分别配置

---

### 方法2：命令行覆盖（临时）

```bash
# 临时使用不同端口启动
cd docker
SVR_HTTP_PORT=8080 docker compose up -d

# 仅本次生效，重启后恢复 .env 配置
```

---

## 📍 访问地址

### 生产模式 / 构建模式

**使用默认端口（9380）**：
```bash
# Web UI
http://localhost:9380

# 或 Nginx 入口
http://localhost:10080
https://localhost:10443

# API 端点
http://localhost:9380/v1/conversation/list

# MinIO 控制台
http://localhost:9001
```

**自定义端口（例如改成 8080）**：
```bash
# Web UI
http://localhost:8080

# API 端点
http://localhost:8080/v1/conversation/list
```

---

### 热重载开发模式

**前端开发服务器（固定 8000 端口）**：
```bash
# 启动热重载
bash build-and-run-dev.sh --hot

# 前端访问（实时热重载）
http://localhost:8000

# API 自动代理到后端（使用 .env 的 SVR_HTTP_PORT）
http://localhost:8000/v1/conversation/list
  ↓ 自动代理到
http://localhost:9380/v1/conversation/list
```

**后端服务（使用 .env 的 SVR_HTTP_PORT）**：
```bash
# 后端 API（Docker 容器）
http://localhost:${SVR_HTTP_PORT}

# 例如默认配置
http://localhost:9380
```

---

## 🔄 端口冲突解决

### 场景1：9380 端口被占用

**检查占用**：
```bash
# Windows
netstat -ano | findstr 9380

# Linux/MacOS
lsof -i :9380
```

**解决方法1：修改 RAGFlow 端口**
```bash
# 编辑 docker/.env
SVR_HTTP_PORT=8080

# 重启服务
cd docker
docker compose down
docker compose up -d
```

**解决方法2：关闭占用进程**
```bash
# Windows
taskkill /PID <PID> /F

# Linux/MacOS
kill -9 <PID>
```

---

### 场景2：前端热重载 8000 端口被占用

**检查占用**：
```bash
# Windows
netstat -ano | findstr 8000

# Linux/MacOS
lsof -i :8000
```

**解决方法1：修改前端端口**
```bash
# 编辑 web/.umirc.ts
export default defineConfig({
  // 添加 port 配置
  port: 8001,
  
  // 其他配置...
});

# 重启热重载
Ctrl+C
bash build-and-run-dev.sh --hot
```

**解决方法2：使用环境变量**
```bash
# 临时使用不同端口
PORT=8001 bash build-and-run-dev.sh --hot
```

---

### 场景3：所有端口被占用（端口范围冲突）

**批量修改端口**：
```bash
# 编辑 docker/.env，修改所有端口到空闲范围
vim docker/.env

# 例如：将所有端口 +10000
SVR_HTTP_PORT=19380
ES_PORT=11200
MYSQL_PORT=15455
MINIO_PORT=19000
MINIO_CONSOLE_PORT=19001
REDIS_PORT=16379

# 重启服务
cd docker
docker compose down
docker compose up -d
```

---

## 🌐 网络访问配置

### 局域网访问（其他设备访问开发服务器）

**场景**：手机/平板访问开发中的 RAGFlow

**步骤**：
```bash
# 1. 查看本机 IP
# Windows
ipconfig

# Linux/MacOS
ifconfig

# 例如：192.168.1.100

# 2. 启动热重载（会自动监听所有网络接口）
bash build-and-run-dev.sh --hot

# 3. 其他设备访问
# 前端：http://192.168.1.100:8000
# 后端：http://192.168.1.100:9380
```

**注意**：
- ✅ Docker 容器已配置端口映射到 `0.0.0.0`
- ✅ 前端开发服务器（UmiJS）默认监听所有接口
- ⚠️ 防火墙可能阻止访问，需要开放对应端口

---

### 云服务器部署

**场景**：在云服务器上开发，本地浏览器访问

**步骤**：
```bash
# 1. 确保安全组/防火墙开放端口
# 需要开放：9380, 8000（如果使用热重载）

# 2. 启动服务
bash build-and-run-dev.sh --hot

# 3. 本地浏览器访问
# 前端：http://<服务器公网IP>:8000
# 后端：http://<服务器公网IP>:9380
```

**安全建议**：
- ⚠️ 不要在生产环境使用开发模式
- ⚠️ 使用 Nginx 反向代理 + HTTPS
- ⚠️ 配置访问控制（IP 白名单）

---

## 📊 端口使用检查

### 检查当前占用端口

```bash
# 查看 RAGFlow 相关容器的端口映射
docker ps --filter "name=ragflow" --format "table {{.Names}}\t{{.Ports}}"

# 输出示例：
# NAMES                  PORTS
# ragflow-server-dev     0.0.0.0:9380->9380/tcp, 0.0.0.0:10080->80/tcp, ...
# ragflow-mysql          0.0.0.0:5455->3306/tcp
# ragflow-redis          0.0.0.0:6379->6379/tcp
# ragflow-minio          0.0.0.0:9000->9000/tcp, 0.0.0.0:9001->9001/tcp
# ragflow-es-01          0.0.0.0:1200->9200/tcp
```

---

### 验证端口可访问性

```bash
# 测试 RAGFlow API
curl http://localhost:9380/api/health

# 测试 Elasticsearch
curl http://localhost:1200

# 测试 MySQL（需要 mysql 客户端）
mysql -h 127.0.0.1 -P 5455 -u root -p

# 测试 Redis（需要 redis-cli）
redis-cli -h 127.0.0.1 -p 6379 -a infini_rag_flow ping

# 测试 MinIO
curl http://localhost:9000/minio/health/live
```

---

## 🔐 端口安全最佳实践

### 1. 生产环境端口配置

```bash
# 仅暴露必要的端口
# docker/.env

# 仅暴露 RAGFlow 主服务
SVR_HTTP_PORT=9380

# 其他服务不暴露到宿主机（注释掉端口映射）
# ES_PORT=1200        # 注释掉，仅容器内访问
# MYSQL_PORT=5455     # 注释掉
# REDIS_PORT=6379     # 注释掉
```

**修改 docker-compose.yml**：
```yaml
services:
  mysql:
    # 注释掉端口映射
    # ports:
    #   - ${MYSQL_PORT}:3306
```

---

### 2. 开发环境端口隔离

```bash
# 开发环境使用不同端口段
# 避免与生产环境冲突

# 开发环境 .env
SVR_HTTP_PORT=19380  # 19xxx 段
ES_PORT=11200        # 11xxx 段
MYSQL_PORT=15455     # 15xxx 段
```

---

### 3. 使用 Nginx 反向代理

```nginx
# nginx.conf
server {
    listen 80;
    server_name ragflow.example.com;

    location / {
        proxy_pass http://localhost:9380;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
    }
}
```

**优势**：
- ✅ 隐藏真实端口
- ✅ 统一入口
- ✅ 支持 HTTPS
- ✅ 负载均衡

---

## 🆘 常见问题

### Q1：修改 .env 后端口没变化

**原因**：容器未重启

**解决**：
```bash
cd docker
docker compose down
docker compose up -d
```

---

### Q2：热重载模式 API 调用 404

**原因**：前端代理配置的后端端口与 .env 不一致

**解决**：
```bash
# 检查 .env 的 SVR_HTTP_PORT
cat docker/.env | grep SVR_HTTP_PORT

# 检查前端代理配置
cat web/.umirc.ts | grep target

# 确保两者一致
# 例如 .env 中 SVR_HTTP_PORT=8080
# 则 .umirc.ts 中 target 应为 http://127.0.0.1:8080/
```

**快速修复**：
```bash
# 编辑 web/.umirc.ts
vim web/.umirc.ts

# 修改 proxy target
proxy: [
  {
    context: ['/api', '/v1'],
    target: 'http://127.0.0.1:8080/',  // 改成 .env 的端口
    changeOrigin: true,
    ws: true,
  },
],

# 重启热重载
Ctrl+C
bash build-and-run-dev.sh --hot
```

---

### Q3：容器启动失败，提示端口被占用

**错误示例**：
```
Error response from daemon: driver failed programming external connectivity on endpoint ragflow-server (xxx): Bind for 0.0.0.0:9380 failed: port is already allocated
```

**解决**：
```bash
# 方法1：查找并关闭占用进程
# Windows
netstat -ano | findstr 9380
taskkill /PID <PID> /F

# Linux/MacOS
lsof -i :9380
kill -9 <PID>

# 方法2：修改 .env 使用其他端口
vim docker/.env
# SVR_HTTP_PORT=9381

# 重启
cd docker
docker compose up -d
```

---

## 📚 参考资源

- **Docker 端口映射文档**：https://docs.docker.com/config/containers/container-networking/
- **UmiJS 配置文档**：https://umijs.org/docs/api/config#port
- **Nginx 反向代理**：https://nginx.org/en/docs/http/ngx_http_proxy_module.html

---

## ✅ 配置检查清单

部署前检查：

- [ ] 确认 `docker/.env` 中所有端口未被占用
- [ ] 确认防火墙已开放必要端口
- [ ] 确认 `docker-compose.yml` 和 `docker-compose-dev.yml` 端口映射正确
- [ ] 确认前端代理配置（`web/.umirc.ts`）与 `.env` 一致
- [ ] 测试所有服务可访问性（健康检查）
- [ ] 生产环境仅暴露必要端口
- [ ] 启用 HTTPS（生产环境）

---

**最后更新**：2025-01

**维护者**：AI Agent (Claude)
