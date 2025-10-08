# RAGFlow 快速开发指南

## 🚀 问题 vs 解决方案

### ❌ 原来的流程（慢）
```bash
# 每次修改代码都要：
./build-and-run.sh            # 10-15 分钟重新构建整个 Docker 镜像
# 等待 10 分钟... 😴
# 刷新浏览器查看效果
```

**痛点**：
- ⏱️ **前端改一行代码 = 10分钟等待**（重新构建整个前端）
- ⏱️ **后端改一行代码 = 5分钟等待**（重新构建 Python 环境）
- 🔄 每次都要 `git push` → 服务器 `git pull` → 重新构建

---

### ✅ 新的流程（极速 - 热重载模式）⭐ 推荐

```bash
# 首次设置（一次性，5分钟）
./build-and-run-dev.sh --init

# 启动热重载开发服务器
./build-and-run-dev.sh --hot

# 以后修改代码：
# 前端：编辑代码 → 浏览器自动刷新（0秒！）
# 后端：编辑代码 → 容器自动重启（2秒）
```

**优势**：
- 🔥 **前端：10分钟 → 0秒**（即时生效，无需等待！）
- ⚡ **后端：5分钟 → 2秒**（150倍提速）
- 🎯 **热模块替换（HMR）**：保留页面状态，不刷新整个页面
- 🚀 **React Fast Refresh**：修改组件代码，状态不丢失
- ✅ **无需频繁 git push/pull**
- ✅ **保留原有脚本习惯**

---

### ✅ 备选流程（快 - 构建模式）

```bash
# 首次设置（一次性，5分钟）
./build-and-run-dev.sh --init

# 以后每次修改代码：
# 方式1：改前端
./build-and-run-dev.sh --rebuild-fe   # 30 秒完成

# 方式2：改后端
./build-and-run-dev.sh --restart      # 2 秒完成
```

**优势**：
- ✅ **前端：10分钟 → 30秒**（20倍提速）
- ✅ **后端：5分钟 → 2秒**（150倍提速）
- ✅ **适合服务器环境**（无需本地运行 Node.js 开发服务器）

---

## ⚙️ 端口配置说明

**开发模式和生产模式使用相同的端口配置**，都从 `docker/.env` 文件读取：

| 服务 | 端口变量 | 默认值 | 说明 |
|------|---------|--------|------|
| **RAGFlow API** | `SVR_HTTP_PORT` | 9380 | 主要 API 端口 |
| **Nginx HTTP** | - | 10080 | HTTP 访问端口 |
| **Nginx HTTPS** | - | 10443 | HTTPS 访问端口 |
| **Debugpy** | - | 5678 | Python 远程调试 |
| **MCP** | - | 9382 | MCP 服务端口 |
| **前端开发服务器** | - | 8000 | **仅热重载模式** |

**重要**：
- ✅ `docker-compose.yml` 和 `docker-compose-dev.yml` **共用同一个 `.env` 文件**
- ✅ 修改 `docker/.env` 中的端口，**两种模式自动同步**
- ✅ 热重载模式会额外启动 **8000 端口**（前端开发服务器）

**访问地址**：
- **生产模式/构建模式**：http://localhost:${SVR_HTTP_PORT} （默认 9380）
- **热重载模式**：http://localhost:8000 （前端） + http://localhost:${SVR_HTTP_PORT} （后端）

---

## 📋 完整使用流程

### 第一步：首次设置（5分钟，一次性）

```bash
cd C:\Users\Administrator\Desktop\workspace\ragflow

# 运行初始化脚本
./build-and-run-dev.sh --init
```

**这个命令会做什么？**
1. ✅ 检查 Node.js 是否安装（需要 18.20.4+）
2. ✅ 安装前端依赖 (`npm install`)
3. ✅ 首次构建前端 (`npm run build`)
4. ✅ 启动开发模式容器（挂载本地代码）
5. ✅ 等待服务启动完成

**成功后会显示**：
```
╔════════════════════════════════════════════════════════════════════╗
║              🎉 Development Environment Ready! 🎉                  ║
╚════════════════════════════════════════════════════════════════════╝

Access URLs:
  Web UI:  http://localhost:9380
  API:     http://localhost:9380/v1
```

---

### 第二步：日常开发

#### 🔥 推荐：热重载模式（0 秒生效）

```bash
# 1. 启动热重载开发服务器（一次性）
./build-and-run-dev.sh --hot

# 服务器启动后显示：
# ╔════════════════════════════════════════════════════════════════════╗
# ║              🔥 Frontend Hot Reload Mode (Instant!) 🔥            ║
# ╚════════════════════════════════════════════════════════════════════╝
#
# Access URLs after startup:
#   Frontend (Hot Reload): http://localhost:8000
#   Backend API:           http://localhost:9380

# 2. 打开浏览器访问 http://localhost:8000

# 3. 编辑前端文件（例如：web/src/pages/free-chat/index.tsx）
#    → 保存
#    → 浏览器自动刷新显示最新代码（0 秒！）
#    → 不需要手动刷新，不需要重新构建！

# 4. 修改后端文件（例如：api/apps/conversation_app.py）
#    → 保存
#    → Flask 自动检测并重启（2 秒）
#    → 刷新浏览器测试新 API
```

**优势**：
- ⚡ **即时反馈**：代码保存 → 浏览器立即更新
- 🎯 **保留状态**：修改组件代码，表单输入、滚动位置都不丢失
- 🛠️ **调试友好**：Source maps 支持，可以调试 TypeScript 源码
- 🔄 **自动代理**：前端自动代理 API 到 Docker 后端（无需配置）

**时间对比**：
- ❌ 旧方式：`./build-and-run.sh` = **10 分钟**
- ✅ 热重载：保存代码 = **0 秒**（即时生效！）

---

#### 备选：构建模式（30 秒生效）

```bash
# 1. 编辑前端文件
# 例如：web/src/pages/free-chat/index.tsx

# 2. 重新构建前端（30秒）
./build-and-run-dev.sh --rebuild-fe

# 3. 刷新浏览器（Ctrl+Shift+R 强制刷新）
# 完成！
```

**时间对比**：
- ❌ 旧方式：`./build-and-run.sh` = **10 分钟**
- ✅ 构建模式：`./build-and-run-dev.sh --rebuild-fe` = **30 秒**

---

#### 场景2：修改后端代码

```bash
# 1. 编辑后端文件
# 例如：api/apps/conversation_app.py

# 2. 重启容器（2秒）
./build-and-run-dev.sh --restart

# 3. 测试 API
# 完成！
```

**时间对比**：
- ❌ 旧方式：`./build-and-run.sh` = **5 分钟**
- ✅ 新方式：`./build-and-run-dev.sh --restart` = **2 秒**

---

#### 场景3：同时修改前后端

```bash
# 1. 编辑前端和后端文件

# 2. 先重新构建前端
./build-and-run-dev.sh --rebuild-fe

# 3. 再重启后端
./build-and-run-dev.sh --restart

# 完成！总耗时 ~35 秒
```

---

### 第三步：查看日志和停止服务

```bash
# 查看实时日志
./build-and-run-dev.sh --logs
# 按 Ctrl+C 退出

# 停止所有服务
./build-and-run-dev.sh --stop

# 清理环境并重新开始
./build-and-run-dev.sh --clean
./build-and-run-dev.sh --init
```

---

## 🛠️ 命令速查表

| 命令 | 用途 | 耗时 | 使用频率 |
|------|------|------|----------|
| `./build-and-run-dev.sh --init` | 首次设置开发环境 | 5分钟 | 一次性 |
| `./build-and-run-dev.sh --rebuild-fe` | 重新构建前端 | 30秒 | 修改前端后 |
| `./build-and-run-dev.sh --restart` | 重启后端服务 | 2秒 | 修改后端后 |
| `./build-and-run-dev.sh --logs` | 查看容器日志 | 实时 | 调试时 |
| `./build-and-run-dev.sh --stop` | 停止所有服务 | 5秒 | 下班时 |
| `./build-and-run-dev.sh --clean` | 清理并重置环境 | 10秒 | 偶尔 |
| `./build-and-run-dev.sh --help` | 显示帮助信息 | 0秒 | 需要时 |

---

## 🔄 完整工作流示例

### 示例1：修复前端 Bug

```bash
# 9:00 AM - 开始工作
cd C:\Users\Administrator\Desktop\workspace\ragflow
./build-and-run-dev.sh --init  # 首次启动（5分钟）

# 9:05 AM - 打开浏览器
# http://localhost:9380
# 发现 sidebar 有显示问题

# 9:06 AM - 编辑代码
# 修改 web/src/pages/free-chat/components/sidebar-dual-tabs.tsx

# 9:08 AM - 重新构建前端
./build-and-run-dev.sh --rebuild-fe  # 30秒

# 9:08:30 AM - 刷新浏览器验证
# Bug 修复完成！

# 总耗时：3分钟（vs 旧方式 15分钟）
```

---

### 示例2：添加新 API 端点

```bash
# 10:00 AM - 开始开发新功能
# 修改 api/apps/conversation_app.py

# 10:15 AM - 代码完成，重启后端
./build-and-run-dev.sh --restart  # 2秒

# 10:15:02 AM - 测试 API
curl http://localhost:9380/v1/conversation/new_endpoint

# 10:16 AM - 发现错误，查看日志
./build-and-run-dev.sh --logs

# 10:18 AM - 修复代码，再次重启
./build-and-run-dev.sh --restart  # 2秒

# 10:18:02 AM - 测试成功！
# 总耗时：18分钟（vs 旧方式 30+分钟）
```

---

### 示例3：前后端联调

```bash
# 11:00 AM - 开始联调
# 后端：修改 api/apps/conversation_app.py（新增字段）
# 前端：修改 web/src/pages/free-chat/hooks/use-free-chat.ts（调用新字段）

# 11:10 AM - 先重启后端
./build-and-run-dev.sh --restart  # 2秒

# 11:10:02 AM - 测试后端 API
curl http://localhost:9380/v1/conversation/test
# ✓ 后端正常

# 11:12 AM - 重新构建前端
./build-and-run-dev.sh --rebuild-fe  # 30秒

# 11:12:30 AM - 刷新浏览器测试
# ✓ 前后端联调成功！

# 总耗时：12分钟（vs 旧方式 25+分钟）
```

---

## ⚙️ 工作原理

### 旧方式（build-and-run.sh）
```
修改代码 → 构建完整 Docker 镜像 → 启动容器
           ↑
           10-15 分钟：
           - 复制所有源码到镜像
           - npm install（即使没变化）
           - npm run build（完整构建）
           - Python 依赖安装
           - 多阶段构建
```

### 新方式（build-and-run-dev.sh）
```
修改代码 → 宿主机构建前端 → 挂载到容器 → Nginx 自动服务新文件
           ↑                  ↑
           30 秒              0 秒（已挂载）

修改代码 → 重启容器 → 挂载的代码自动生效
           ↑
           2 秒（Flask debug 模式）
```

**核心差异**：
- ✅ **不重新构建 Docker 镜像**（使用现有镜像）
- ✅ **挂载本地代码**（修改立即可见）
- ✅ **宿主机构建前端**（利用本地 Node.js，无需 Docker 构建）
- ✅ **Flask debug 模式**（自动检测文件变化并重启）

---

## 🔍 常见问题

### Q1：首次运行 `--init` 报错 "Node.js is not installed"

**原因**：宿主机没有安装 Node.js

**解决**：
```bash
# Windows: 下载安装
# https://nodejs.org/en/download/

# Linux/MacOS: 使用 nvm
curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.0/install.sh | bash
nvm install 18.20.4
nvm use 18.20.4
```

---

### Q2：`--rebuild-fe` 后浏览器没变化

**原因**：浏览器缓存

**解决**：
```bash
# 强制刷新浏览器
# Windows/Linux: Ctrl + Shift + R
# Mac: Cmd + Shift + R

# 或清除浏览器缓存
# Chrome: F12 → Network → Disable cache（勾选）
```

---

### Q3：`--restart` 后 API 还是旧的

**原因**：容器未正确重启

**解决**：
```bash
# 查看容器状态
docker ps | grep ragflow-server-dev

# 手动重启
docker restart ragflow-server-dev

# 查看日志确认
docker logs -f ragflow-server-dev
```

---

### Q4：想回到原来的构建方式

**解决**：
```bash
# 停止开发模式
./build-and-run-dev.sh --stop

# 使用原来的脚本
./build-and-run.sh --rebuild
```

**两种方式可以共存**，互不影响。

---

### Q5：开发模式下数据库迁移怎么办？

**解决**：
```bash
# 进入容器执行迁移
docker exec -it ragflow-server-dev bash
cd /ragflow
python migrate_and_cleanup.py

# 或在宿主机执行
docker exec ragflow-server-dev python /ragflow/migrate_and_cleanup.py
```

---

## 📊 性能对比表

| 操作 | 旧方式 (`build-and-run.sh`) | 新方式 (`build-and-run-dev.sh`) | 提速倍数 |
|------|---------------------------|--------------------------------|----------|
| 首次启动 | 10-15 分钟 | 5 分钟 | **2-3x** |
| 修改前端一行代码 | 10 分钟 | 30 秒 | **20x** |
| 修改后端一行代码 | 5 分钟 | 2 秒 | **150x** |
| 修改配置文件 | 5 分钟 | 10 秒 | **30x** |
| 查看日志 | 5 秒 | 5 秒 | **1x** |
| 停止服务 | 10 秒 | 5 秒 | **2x** |

**总结**：
- ⏱️ **开发效率提升 20-150 倍**
- 🚀 **每天节省 2-4 小时等待时间**
- 😊 **心情更好，不用等待构建**

---

## 🎯 最佳实践

### 1. 开发阶段

```bash
# 启动开发环境（每天一次）
./build-and-run-dev.sh --init

# 开发过程中
# - 改前端 → ./build-and-run-dev.sh --rebuild-fe
# - 改后端 → ./build-and-run-dev.sh --restart
# - 改两者 → 先 --rebuild-fe，再 --restart

# 下班前
./build-and-run-dev.sh --stop
```

---

### 2. 测试阶段

```bash
# 使用原构建脚本进行完整测试
./build-and-run.sh --rebuild

# 确保生产环境构建无误
```

---

### 3. 生产部署

```bash
# 服务器上仍然使用原脚本
git pull
./build-and-run.sh --rebuild
```

---

## 📝 迁移检查清单

- [ ] 已安装 Node.js 18.20.4+
- [ ] 已安装 npm 9.0.0+
- [ ] 已运行 `./build-and-run-dev.sh --init`
- [ ] 可以访问 http://localhost:9380
- [ ] 已测试 `--rebuild-fe` 命令
- [ ] 已测试 `--restart` 命令
- [ ] 已测试 `--logs` 命令
- [ ] 已保留原 `build-and-run.sh` 用于生产构建
- [ ] 已通知团队成员新的开发流程

---

## 🚀 立即开始

```bash
cd C:\Users\Administrator\Desktop\workspace\ragflow
./build-and-run-dev.sh --init
```

**5 分钟后，你的开发效率将提升 20-150 倍！** 🎉
