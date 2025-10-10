# RAGFlow 开发流程优化指南

## 问题分析

**当前流程痛点**：
1. 本地修改代码
2. 提交到 Git
3. 服务器拉取代码
4. **重新构建 Docker 镜像**（耗时 5-15 分钟，尤其是前端）
5. 启动容器查看效果

**核心问题**：Docker 多阶段构建每次都要重新编译前端，非常耗时。

---

## 🚀 优化方案对比

| 方案 | 优点 | 缺点 | 适用场景 |
|------|------|------|----------|
| **方案1：挂载 + 宿主机构建** | 最快（秒级生效） | 需要宿主机安装 Node.js | 前端频繁修改 |
| **方案2：Docker 分层优化** | 构建缓存加速 | 仍需 1-3 分钟 | 不修改依赖时 |
| **方案3：开发镜像 + 热重载** | 接近原生开发体验 | 初次启动慢 | 全职开发 |
| **方案4：前后端分离部署** | 独立部署，互不影响 | 架构复杂 | 生产环境 |

---

## ⭐ 方案1：挂载前端 + 宿主机构建（推荐）

### 工作原理
```
本地修改 → 宿主机构建 → 挂载到容器 → Nginx 自动服务新文件（无需重启）
   ↓           ↓             ↓
  1秒         30秒          0秒
```

### 快速开始

#### 1. 启动开发环境

```bash
cd docker
docker compose -f docker-compose-dev.yml up -d
```

#### 2. 开发前端（在宿主机，不在容器里）

**Windows 环境**：
```powershell
# 进入前端目录
cd C:\Users\Administrator\Desktop\workspace\ragflow\web

# 安装依赖（首次）
npm install

# 开发模式（实时编译）
npm run dev
# 访问 http://localhost:8000 查看前端（开发服务器）
# 访问 http://localhost:9380 查看完整服务（Docker 后端）

# 或者：生产构建后查看效果
npm run build
# 刷新 http://localhost:9380 即可看到更新
```

**Linux/MacOS 服务器**：
```bash
cd /path/to/ragflow/web

# 安装依赖（首次）
npm install

# 生产构建
npm run build

# 或开发模式（需要暴露 8000 端口）
npm run dev -- --host 0.0.0.0
```

#### 3. 开发后端（Python）

后端代码已挂载，修改后自动生效（Flask debug 模式）：

```bash
# 修改 api/apps/conversation_app.py
# 容器会自动检测并重启 Flask 进程（约 2 秒）
```

如需手动重启：
```bash
docker restart ragflow-server-dev
```

#### 4. 验证效果

前端：
```bash
# 修改 web/src/pages/free-chat/index.tsx
npm run build  # 构建（30秒）
# 刷新浏览器 http://localhost:9380（无需重启容器）
```

后端：
```bash
# 修改 api/apps/conversation_app.py
# 等待 2 秒（Flask 自动重启）
# 测试 API 端点
```

---

## 📦 方案2：Docker 分层优化（次优）

如果服务器不方便安装 Node.js，优化 Dockerfile 构建缓存。

### 创建优化的 Dockerfile

```dockerfile
# Dockerfile.dev
FROM infiniflow/ragflow:v0.20.5-slim AS base

WORKDIR /ragflow

# ===== 前端依赖层（缓存）=====
COPY web/package.json web/package-lock.json ./web/
RUN cd web && npm install

# ===== 前端源码层（频繁变化）=====
COPY web ./web
RUN cd web && npm run build

# ===== Python 代码层（挂载，不复制）=====
# 在 docker-compose 中通过 volumes 挂载
```

### 使用方式

```bash
# 首次构建（慢）
docker build -f Dockerfile.dev -t ragflow:dev .

# 仅修改前端代码时
docker build -f Dockerfile.dev -t ragflow:dev . \
  --build-arg BUILDKIT_INLINE_CACHE=1

# 修改后重启
docker compose -f docker-compose-dev.yml restart
```

**优化效果**：
- 未修改 package.json：构建时间从 10 分钟 → **2 分钟**
- 修改了 package.json：仍需 10 分钟（无法避免）

---

## 🔥 方案3：开发容器 + 热重载（最完善）

类似 VS Code Dev Containers，在容器内开发并实时热重载。

### 配置 docker-compose-devcontainer.yml

```yaml
services:
  ragflow-dev:
    build:
      context: ..
      dockerfile: docker/Dockerfile.devcontainer
    volumes:
      - ../:/ragflow  # 挂载整个项目
      - node_modules:/ragflow/web/node_modules  # 独立的 node_modules
    command: >
      bash -c "
        cd /ragflow/web && npm install &&
        npm run dev &
        cd /ragflow && python api/ragflow_server.py
      "
    ports:
      - "8000:8000"  # 前端开发服务器
      - "9380:9380"  # 后端 API
```

### Dockerfile.devcontainer

```dockerfile
FROM infiniflow/ragflow:v0.20.5-slim

RUN apt-get update && apt-get install -y \
    inotify-tools \
    && rm -rf /var/lib/apt/lists/*

# 安装开发工具
RUN pip install watchdog flask-debugpy

WORKDIR /ragflow
```

### 使用方式

```bash
# 启动开发容器
docker compose -f docker/docker-compose-devcontainer.yml up

# 修改代码，自动重载
# - 前端：HMR（热模块替换）
# - 后端：Flask auto-reload
```

---

## 🌐 方案4：前后端分离部署（生产级）

前端独立部署到 Nginx/CDN，后端独立部署到应用服务器。

### 前端独立部署

```bash
# 宿主机构建前端
cd web
npm run build

# 部署到 Nginx
cp -r dist/* /var/www/ragflow/

# 或上传到 CDN（如阿里云 OSS）
```

### 后端独立部署

```yaml
# docker-compose-backend-only.yml
services:
  ragflow:
    image: ${RAGFLOW_IMAGE}
    volumes:
      # 仅挂载后端代码
      - ../api:/ragflow/api
      - ../rag:/ragflow/rag
```

### Nginx 配置

```nginx
# 前端静态资源
location / {
    root /var/www/ragflow;
    try_files $uri $uri/ /index.html;
}

# 后端 API 代理
location /v1/ {
    proxy_pass http://localhost:9380;
}
```

---

## 📊 方案选择建议

### 场景1：主要改前端
- **推荐：方案1（挂载 + 宿主机构建）**
- 理由：修改立即生效，无需重启容器

### 场景2：主要改后端
- **推荐：方案1（挂载 + Flask debug）**
- 理由：Flask 自动检测文件变化并重启

### 场景3：前后端都频繁改
- **推荐：方案3（开发容器 + 热重载）**
- 理由：完整的热重载体验

### 场景4：团队协作，生产环境
- **推荐：方案4（前后端分离）**
- 理由：独立部署，互不影响

---

## 🛠️ 常见问题

### Q1：宿主机 Node.js 版本不对怎么办？

**方法1：使用 nvm 管理多个版本**
```bash
# Windows: 下载 nvm-windows
# https://github.com/coreybutler/nvm-windows

nvm install 18.20.4
nvm use 18.20.4
```

**方法2：在 Docker 中构建但挂载输出**
```bash
# 启动临时构建容器
docker run --rm -v $(pwd)/web:/app -w /app node:18 npm install
docker run --rm -v $(pwd)/web:/app -w /app node:18 npm run build
```

### Q2：挂载后权限问题（Linux）

```bash
# 容器内文件属于 root，宿主机无法修改
# 解决：指定容器内用户
docker compose -f docker-compose-dev.yml run --user $(id -u):$(id -g) ragflow
```

### Q3：挂载后前端文件不更新

**原因**：Nginx 缓存

**解决**：
```bash
# 浏览器强制刷新
Ctrl + Shift + R (Windows/Linux)
Cmd + Shift + R (Mac)

# 或清除 Nginx 缓存
docker exec ragflow-server-dev nginx -s reload
```

### Q4：后端修改不生效

**检查 Flask debug 模式是否启用**：
```bash
docker exec ragflow-server-dev env | grep FLASK_DEBUG
# 应该输出：FLASK_DEBUG=1

# 如果没有，手动设置
docker compose -f docker-compose-dev.yml down
# 修改 .env 添加：FLASK_DEBUG=1
docker compose -f docker-compose-dev.yml up -d
```

### Q5：想同时用开发服务器（HMR）和 Docker 后端

**前端开发服务器 + Docker 后端 API**：

1. 启动 Docker 后端：
```bash
cd docker
docker compose -f docker-compose-dev.yml up -d
```

2. 启动前端开发服务器（宿主机）：
```bash
cd web
npm run dev
```

3. 配置代理（`web/.umirc.ts` 或 `web/vite.config.ts`）：
```typescript
export default {
  proxy: {
    '/v1': {
      target: 'http://localhost:9380',
      changeOrigin: true,
    },
  },
};
```

4. 访问：
   - 前端 HMR：http://localhost:8000（实时热重载）
   - 后端 API：http://localhost:9380（Docker 提供）

---

## 🎯 推荐的开发工作流（方案1详细版）

### 初始设置（一次性）

```bash
# 1. 拉取代码
git clone https://github.com/your-org/ragflow.git
cd ragflow

# 2. 启动基础服务（MySQL, ES, Redis, MinIO）
cd docker
docker compose -f docker-compose-base.yml up -d

# 3. 启动开发版 RAGFlow（挂载模式）
docker compose -f docker-compose-dev.yml up -d

# 4. 安装前端依赖（宿主机）
cd ../web
npm install
```

### 日常开发流程

**前端开发**：
```bash
# Terminal 1: 启动前端开发服务器（实时预览）
cd web
npm run dev
# 访问 http://localhost:8000

# 修改代码... web/src/pages/free-chat/index.tsx
# 浏览器自动刷新（HMR）

# 当需要测试生产构建时：
npm run build
# 刷新 http://localhost:9380 查看 Docker 版本
```

**后端开发**：
```bash
# 修改代码... api/apps/conversation_app.py
# Flask 自动重启（2秒延迟）

# 查看日志确认重启
docker logs -f ragflow-server-dev

# 如需调试
docker exec -it ragflow-server-dev python -m pdb api/ragflow_server.py
```

**提交代码**：
```bash
# 构建生产版本
cd web
npm run build

# 提交
git add .
git commit -m "feat: update free-chat UI"
git push

# 服务器端：仅需拉取代码（无需重新构建 Docker）
cd /path/to/ragflow
git pull
# 如果挂载了代码，立即生效
# 如果需要重启：docker restart ragflow-server-dev
```

---

## 📈 性能对比

| 操作 | 原流程 | 方案1（挂载） | 优化效果 |
|------|--------|--------------|----------|
| 修改前端代码 | 构建镜像 10分钟 | 构建 30秒 | **20倍** |
| 修改后端代码 | 构建镜像 5分钟 | Flask 重启 2秒 | **150倍** |
| 修改配置文件 | 构建镜像 5分钟 | 重启容器 10秒 | **30倍** |
| 首次启动 | 10分钟 | 1分钟 | **10倍** |

---

## 🔒 安全注意事项

1. **开发模式仅用于开发环境**，生产环境必须使用构建后的镜像
2. **不要在开发模式下处理敏感数据**（Flask debug 模式会暴露堆栈信息）
3. **定期清理 node_modules 和构建缓存**（避免磁盘空间不足）

---

## ✅ 总结

**立即行动**：
1. 复制 `docker-compose-dev.yml` 到 `docker/` 目录
2. 运行 `docker compose -f docker/docker-compose-dev.yml up -d`
3. 在宿主机 `web/` 目录运行 `npm run dev`
4. 开始高效开发！

**预期效果**：
- ✅ 前端修改：从 **10分钟 → 30秒**
- ✅ 后端修改：从 **5分钟 → 2秒**
- ✅ 无需频繁 `git push` 和重新构建
- ✅ 接近原生开发体验
