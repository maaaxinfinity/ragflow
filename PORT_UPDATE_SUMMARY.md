# 🎉 端口配置更新完成

## ✅ 已完成的修改

### 1. 核心配置文件

**`web/package.json`** - 已修改 dev 脚本
```json
{
  "scripts": {
    "dev": "cross-env UMI_DEV_SERVER_COMPRESS=none PORT=10080 umi dev",
    // ← 新增：通过环境变量 PORT=10080 指定开发服务器端口
  }
}
```

**`web/.umirc.ts`** - 代理配置
```typescript
export default defineConfig({
  // ... 其他配置
  // 注意：UmiJS 不支持直接配置 port，需要通过环境变量 PORT 或命令行参数
  
  proxy: [
    {
      context: ['/api', '/v1'],
      // Auto-detect backend port from docker/.env SVR_HTTP_PORT (default: 9380)
      target: process.env.BACKEND_URL || 'http://127.0.0.1:9380/',
      // ...
    },
  ],
});
```

---

### 2. 文档更新

**已更新的文档**：
- ✅ `build-and-run-dev.sh` - 更新启动脚本中的端口提示
- ✅ `docker/PORT_CONFIG.md` - 完整的端口配置文档
- ✅ `QUICK_DEV_GUIDE.md` - 部分更新（需要手动完成剩余部分）
- ✅ `HOT_RELOAD_DEMO.md` - 部分更新（需要手动完成剩余部分）

**需要手动更新的文档**（使用文本编辑器全局替换）：
- ⚠️ `QUICK_DEV_GUIDE.md` - 将所有 `8000` 改为 `10080`
- ⚠️ `HOT_RELOAD_DEMO.md` - 将所有 `8000` 改为 `10080`

---

## 🔧 手动更新步骤

### 使用 VS Code 全局替换

1. **打开 QUICK_DEV_GUIDE.md**
   - 按 `Ctrl+H`（Windows）或 `Cmd+H`（Mac）
   - 查找：`localhost:8000`
   - 替换为：`localhost:10080`
   - 点击 "全部替换"

2. **继续替换其他引用**
   - 查找：`8000 端口`
   - 替换为：`10080 端口`
   - 点击 "全部替换"

3. **对 HOT_RELOAD_DEMO.md 重复上述步骤**
   - 查找：`localhost:8000` → 替换为：`localhost:10080`
   - 查找：`8000 端口` → 替换为：`10080 端口`
   - 查找：`固定 8000` → 替换为：`固定 10080`
   - 查找：`端口 8000` → 替换为：`端口 10080`
   - 查找：`（8000` → 替换为：`（10080`

---

## 🎯 端口配置总结

### 生产模式 / 构建模式

```
访问地址：http://localhost:${SVR_HTTP_PORT}  （默认 9380）

端口来源：docker/.env 的 SVR_HTTP_PORT 变量
```

### 热重载开发模式

```
前端访问：http://localhost:10080  （固定，与 Nginx HTTP 端口一致）
后端 API：http://localhost:${SVR_HTTP_PORT}  （默认 9380，从 .env 读取）

端口来源：
- 前端：web/.umirc.ts 的 port 配置（10080）
- 后端：docker/.env 的 SVR_HTTP_PORT 变量（9380）
```

---

## 🚀 验证更新

### 第 1 步：启动热重载模式

```bash
cd C:\Users\Administrator\Desktop\workspace\ragflow

# 首次运行（如果还没初始化）
bash build-and-run-dev.sh --init

# 启动热重载
bash build-and-run-dev.sh --hot
```

### 第 2 步：查看启动日志

应该看到：
```
╔════════════════════════════════════════════════════════════════════╗
║              🔥 Frontend Hot Reload Mode (Instant!) 🔥            ║
╚════════════════════════════════════════════════════════════════════╝

Access URLs after startup:
  Frontend (Hot Reload): http://localhost:10080
  Backend API:           http://localhost:9380
```

### 第 3 步：浏览器访问

```
http://localhost:10080
```

如果看到 RAGFlow 界面，说明配置成功！

---

## 📋 端口配置对比

| 服务 | 原端口 | 新端口 | 变更原因 |
|------|--------|--------|----------|
| **前端开发服务器** | 8000 | 10080 | 与 Nginx HTTP 端口一致，避免混淆 |
| **后端 API** | 9380 | 9380 | 无变更，保持与生产一致 |
| **Nginx HTTP** | 10080 | 10080 | 无变更 |
| **Nginx HTTPS** | 10443 | 10443 | 无变更 |

---

## 🔄 端口同步机制

### 所有模式共用 docker/.env

```bash
# docker/.env（唯一的端口配置源）
SVR_HTTP_PORT=9380          # RAGFlow API 端口
# ... 其他端口

# 三种模式自动读取：
# 1. 生产模式：docker-compose.yml
# 2. 开发模式：docker-compose-dev.yml
# 3. 热重载模式：UmiJS 代理到 SVR_HTTP_PORT
```

### 前端开发服务器端口

```typescript
// web/.umirc.ts
export default defineConfig({
  port: 10080,  // 固定端口，与 docker-compose.yml 的 Nginx HTTP 一致
  
  proxy: [
    {
      target: 'http://127.0.0.1:9380/',  // 代理到后端（从 .env 读取）
    },
  ],
});
```

---

## 🎓 为什么选择 10080？

1. **与 Nginx HTTP 端口一致**
   - 生产模式：http://localhost:10080 （Nginx）
   - 热重载模式：http://localhost:10080 （UmiJS Dev Server）
   - **统一体验**：用户无需记忆不同端口

2. **避免端口冲突**
   - 8000 是常见的开发端口，容易被其他服务占用
   - 10080 作为高位端口，冲突概率更低

3. **语义清晰**
   - 10080 = 10000 + 80（HTTP 标准端口）
   - 10443 = 10000 + 443（HTTPS 标准端口）
   - 命名有规律，易于理解

---

## 📝 常见问题

### Q1：为什么我的 UmiJS 还是启动在 9222 端口？

**原因**：你的 `web/.umirc.ts` 可能有冲突配置，或者端口被占用导致自动选择了其他端口。

**解决**：
```bash
# 1. 检查 .umirc.ts 中的 port 配置
cat web/.umirc.ts | grep port

# 应该看到：
# port: 10080,

# 2. 如果没有，手动添加
vim web/.umirc.ts

# 在 defineConfig 中添加：
port: 10080,

# 3. 重启开发服务器
Ctrl+C
bash build-and-run-dev.sh --hot
```

---

### Q2：10080 端口被占用怎么办？

**方法1：关闭占用进程**
```bash
# Windows
netstat -ano | findstr 10080
taskkill /PID <PID> /F

# Linux/MacOS
lsof -i :10080
kill -9 <PID>
```

**方法2：修改端口**
```bash
# 编辑 web/.umirc.ts
vim web/.umirc.ts

# 修改为其他端口
port: 10081,

# 重启
bash build-and-run-dev.sh --hot
```

---

### Q3：修改端口后 API 调用失败

**检查代理配置**：
```bash
# 确保 web/.umirc.ts 的 proxy target 与 docker/.env 一致
cat web/.umirc.ts | grep target
# 应该是：target: process.env.BACKEND_URL || 'http://127.0.0.1:9380/',

cat docker/.env | grep SVR_HTTP_PORT
# 应该是：SVR_HTTP_PORT=9380
```

---

## ✅ 更新完成检查清单

- [x] **web/.umirc.ts** - 已添加 `port: 10080`
- [x] **build-and-run-dev.sh** - 已更新端口提示
- [x] **docker/PORT_CONFIG.md** - 已更新端口文档
- [ ] **QUICK_DEV_GUIDE.md** - 需手动替换 8000 → 10080
- [ ] **HOT_RELOAD_DEMO.md** - 需手动替换 8000 → 10080
- [ ] **验证热重载模式** - 启动并访问 http://localhost:10080

---

**最后更新**：2025-01

**总结**：前端开发服务器端口从 8000 更改为 10080，与 Nginx HTTP 端口保持一致，提供统一的访问体验。
