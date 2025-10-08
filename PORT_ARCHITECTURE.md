# RAGFlow 端口架构说明

## 🏗️ 架构概览

RAGFlow 使用了多种开发模式，每种模式的端口配置不同：

---

## 📊 端口映射关系

### Docker 容器端口映射

```yaml
# docker-compose-dev.yml
ports:
  - ${SVR_HTTP_PORT}:9380    # 9380:9380  (后端 API)
  - 10080:80                  # 10080 → 容器内 Nginx 的 80 端口
  - 10443:443                 # 10443 → 容器内 Nginx 的 443 端口
```

**说明**：
- 容器内：Nginx 监听 **80 端口**
- 宿主机：访问 **10080 端口** → 映射到容器的 80 端口
- Nginx 提供静态文件（`/ragflow/web/dist`）
- Nginx 代理 `/v1` 和 `/api` 到容器内的 9380 端口

---

## 🎯 三种开发模式

### 模式 1：热重载开发（推荐）

```bash
bash build-and-run-dev.sh --hot
```

**端口使用**：
- **前端**：http://localhost:8000 （UmiJS Dev Server）
- **后端**：http://localhost:9380 （Docker 容器）

**工作流程**：
```
浏览器访问 localhost:8000
       ↓
  UmiJS Dev Server
       ↓ (代理 /v1 和 /api)
  localhost:9380 (Docker 后端)
```

**优势**：
- ✅ 前端修改 0 秒生效（HMR）
- ✅ React Fast Refresh（保留状态）
- ✅ Source Maps（TypeScript 调试）
- ✅ 不与 Docker Nginx 冲突

---

### 模式 2：构建模式（宿主机构建）

```bash
bash build-and-run-dev.sh --rebuild-fe
```

**端口使用**：
- **前端**：http://localhost:10080 （Docker Nginx）
- **后端**：http://localhost:9380 （Docker 后端）

**工作流程**：
```
1. 宿主机构建前端：npm run build → web/dist/
2. Docker 挂载：../web/dist:/ragflow/web/dist
3. 浏览器访问 localhost:10080
       ↓
   Docker Nginx (容器内 80 端口)
       ↓ (提供静态文件)
   /ragflow/web/dist
       ↓ (代理 /v1 和 /api)
   localhost:9380 (容器内后端)
```

**优势**：
- ✅ 接近生产环境
- ✅ 测试 Nginx 配置
- ✅ 构建速度：30 秒 (vs 10 分钟完整 Docker 构建)

---

### 模式 3：完整生产构建

```bash
bash build-and-run.sh --rebuild
```

**端口使用**：
- **前端**：http://localhost:10080 （Docker Nginx）
- **后端**：http://localhost:9380 （Docker 后端）

**工作流程**：
```
1. Docker 多阶段构建：
   - builder stage: npm install + npm run build
   - production stage: 复制 dist 到镜像
2. 浏览器访问 localhost:10080
       ↓
   Docker Nginx (容器内 80 端口)
       ↓
   /ragflow/web/dist (内置在镜像中)
       ↓ (代理 /v1 和 /api)
   localhost:9380 (容器内后端)
```

**优势**：
- ✅ 完全独立的 Docker 镜像
- ✅ 可以部署到任何环境
- ⚠️ 构建耗时：10-15 分钟

---

## 🔌 端口冲突处理

### 问题：10080 已被占用

**场景**：同时运行热重载和 Docker Nginx

**原因**：
```
Docker Nginx:  宿主机 10080 → 容器 80
UmiJS Dev:     尝试使用 10080 → 被占用 → 自动改用 10081
```

**解决方案**：
1. **推荐**：热重载使用 8000，Docker Nginx 使用 10080（互不干扰）
2. **备选**：热重载使用 10081，Docker Nginx 使用 10080

---

## 📝 配置文件

### UmiJS Dev Server 端口

**文件**：`web/.env`
```bash
PORT=8000  # UmiJS 开发服务器端口（热重载模式）
```

**优先级**：
1. `.env` 文件（最高）
2. 命令行参数 `PORT=xxx umi dev`
3. 默认值 8000

---

### Docker 端口映射

**文件**：`docker/docker-compose-dev.yml`
```yaml
ports:
  - 10080:80      # 宿主机 10080 → 容器 Nginx 80
  - 10443:443     # 宿主机 10443 → 容器 Nginx 443
  - ${SVR_HTTP_PORT}:9380  # 后端 API（默认 9380:9380）
```

---

## 🎯 推荐的开发流程

### 日常前端开发

```bash
# 1. 启动热重载（一次性）
bash build-and-run-dev.sh --hot

# 2. 访问 http://localhost:8000

# 3. 修改代码，浏览器自动刷新（0 秒）
```

**优势**：最快的迭代速度

---

### 测试生产环境表现

```bash
# 1. 构建前端
bash build-and-run-dev.sh --rebuild-fe

# 2. 访问 http://localhost:10080

# 3. 验证 Nginx 配置、缓存策略等
```

**优势**：接近生产环境

---

### 发布前验证

```bash
# 完整 Docker 构建
bash build-and-run.sh --rebuild

# 访问 http://localhost:10080

# 验证完整镜像可正常工作
```

**优势**：完全模拟生产部署

---

## 🔄 端口使用总结

| 模式 | 前端访问 | 前端服务 | 后端 API | Docker Nginx |
|------|---------|----------|----------|--------------|
| **热重载开发** | :8000 | UmiJS Dev | :9380 | 不使用 |
| **构建模式** | :10080 | Docker Nginx | :9380 | :10080 → :80 |
| **生产构建** | :10080 | Docker Nginx | :9380 | :10080 → :80 |

---

## 💡 关键理解

1. **Docker 端口映射**：`10080:80` 表示 "宿主机 10080 映射到容器内的 80"
2. **UmiJS Dev Server**：运行在宿主机，不在容器内
3. **热重载和 Docker Nginx 是独立的**：可以同时运行，使用不同端口
4. **最佳实践**：
   - 开发时用热重载（8000 端口）
   - 测试时用构建模式（10080 端口）
   - 发布前用完整构建验证

---

**最后更新**：2025-01-10
