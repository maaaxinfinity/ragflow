# 外部 Nginx 代理配置（最佳方案）

## 🎯 架构说明

```
用户访问：https://law.workspace.limitee.cn/
前端静态资源：https://law.workspace.limitee.cn/ → 19011 → 8000 (UmiJS)
API 请求：https://law.workspace.limitee.cn/v1/... → 19012 → 9380 (后端)
         https://law.workspace.limitee.cn/api/... → 19012 → 9380 (后端)
```

**优势**：
- ✅ 所有请求同源，**不需要 CORS**！
- ✅ 后端不直接暴露
- ✅ 统一域名，更安全简洁

---

## 📝 完整 Nginx 配置

修改你的外部 Nginx 配置文件 `/etc/nginx/sites-available/law.workspace.limitee.cn.conf`：

```nginx
# WebSocket 支持（在 http 块中添加）
map $http_upgrade $connection_upgrade {
    default upgrade;
    '' close;
}

server {
    listen 443 ssl http2;
    server_name law.workspace.limitee.cn;
    
    # SSL 证书配置
    ssl_certificate /path/to/your/ssl/cert.pem;
    ssl_certificate_key /path/to/your/ssl/key.pem;
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_ciphers HIGH:!aNULL:!MD5;
    
    # =====================================
    # API 请求代理到后端（优先级最高）
    # =====================================
    location ~ ^/(v1|api)/ {
        # 代理到后端服务器
        # 方式 1：直接代理到端口转发地址（推荐）
        proxy_pass http://49.232.140.181:19012;
        
        # 方式 2：如果配置了 rag.limitee.cn 的 HTTPS，也可以用
        # proxy_pass https://rag.limitee.cn;
        
        proxy_http_version 1.1;
        
        # 代理头配置
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_set_header REMOTE-HOST $remote_addr;
        
        # WebSocket 支持
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection $connection_upgrade;
        
        # 超时配置
        client_max_body_size 2048M;
        client_body_buffer_size 20M;
        proxy_connect_timeout 600;
        proxy_send_timeout 600;
        proxy_read_timeout 600;
        proxy_buffering off;
        
        # 不需要 CORS 配置！因为是同源请求
    }
    
    # =====================================
    # 前端静态资源（默认规则）
    # =====================================
    location / {
        # 代理到前端开发服务器
        proxy_pass http://49.232.140.181:19011;
        proxy_http_version 1.1;
        
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        
        # WebSocket 支持（用于热重载）
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection $connection_upgrade;
        
        # 超时配置
        client_max_body_size 2048M;
        client_body_buffer_size 20M;
        proxy_connect_timeout 600;
        proxy_send_timeout 600;
        proxy_read_timeout 600;
    }
    
    # 日志配置
    access_log /var/log/nginx/law.workspace.limitee.cn.access.log;
    error_log /var/log/nginx/law.workspace.limitee.cn.error.log;
}

# HTTP 重定向到 HTTPS
server {
    listen 80;
    server_name law.workspace.limitee.cn;
    return 301 https://$server_name$request_uri;
}
```

---

## 🚀 应用配置

```bash
# 1. 测试配置
sudo nginx -t

# 2. 重载 Nginx
sudo nginx -s reload

# 3. 查看日志（如果有问题）
sudo tail -f /var/log/nginx/law.workspace.limitee.cn.error.log
```

---

## ✅ 验证配置

### 测试 1：前端访问

```bash
curl -I https://law.workspace.limitee.cn/
# 应该返回 200
```

### 测试 2：API 代理

```bash
# 测试 /v1 端点
curl https://law.workspace.limitee.cn/v1/system/status

# 测试 /api 端点
curl https://law.workspace.limitee.cn/api/xxx
```

### 测试 3：浏览器访问

1. 访问 https://law.workspace.limitee.cn
2. 打开浏览器开发者工具（F12）→ Network 标签
3. 刷新页面
4. 查看 API 请求：
   - ✅ URL 应该是：`https://law.workspace.limitee.cn/v1/...`
   - ✅ 不再有 `https://rag.limitee.cn`
   - ✅ 不再有 CORS 错误
   - ✅ 所有请求同源

---

## 📊 请求流程图

```
┌─────────────────────────────────────────────────────────────┐
│                      用户浏览器                              │
│  访问：https://law.workspace.limitee.cn                     │
└─────────────────────────────────────────────────────────────┘
                            │
        ┌───────────────────┼───────────────────┐
        ↓                   ↓                   ↓
   静态资源              /v1/*               /api/*
  (HTML/JS/CSS)        (API请求)           (API请求)
        ↓                   ↓                   ↓
┌──────────────┐    ┌──────────────┐    ┌──────────────┐
│   Nginx 匹配  │    │  Nginx 匹配  │    │  Nginx 匹配  │
│  location /  │    │location /v1/ │    │location /api/│
└──────────────┘    └──────────────┘    └──────────────┘
        ↓                   ↓                   ↓
┌──────────────┐           ┌─────────────────────────┐
│   proxy_pass │           │      proxy_pass         │
│   :19011     │           │      :19012             │
└──────────────┘           └─────────────────────────┘
        ↓                              ↓
┌──────────────┐           ┌─────────────────────────┐
│  端口转发     │           │     端口转发             │
│  19011→8000  │           │     19012→9380          │
└──────────────┘           └─────────────────────────┘
        ↓                              ↓
┌──────────────┐           ┌─────────────────────────┐
│ UmiJS Dev    │           │   Docker RAGFlow       │
│ Server       │           │   Backend API          │
│ (宿主机 8000) │           │   (容器 9380)           │
└──────────────┘           └─────────────────────────┘
```

---

## 🔍 配置说明

### 1. 为什么用 `location ~ ^/(v1|api)/`？

- `~` 表示正则匹配
- `^/(v1|api)/` 匹配以 `/v1/` 或 `/api/` 开头的路径
- 优先级高于 `location /`

### 2. 为什么不需要 CORS？

因为所有请求都从同一个域名 `law.workspace.limitee.cn` 发起：
- 前端：`https://law.workspace.limitee.cn/`
- API：`https://law.workspace.limitee.cn/v1/...`

浏览器认为这是**同源请求**，不会触发 CORS 检查。

### 3. 如果还看到 `rag.limitee.cn` 怎么办？

可能是浏览器缓存了旧的前端代码：
```bash
# 清除浏览器缓存
Ctrl + Shift + Delete (Chrome/Edge)
Ctrl + Shift + R (硬刷新)

# 或者使用隐私模式测试
Ctrl + Shift + N (Chrome/Edge)
```

---

## ⚠️ 注意事项

1. **端口转发必须存在**：
   - `19011 → 8000` (前端)
   - `19012 → 9380` (后端)

2. **location 顺序很重要**：
   - API 匹配规则必须在前（更具体）
   - 默认规则 `/` 必须在后（更宽泛）

3. **不需要配置 rag.limitee.cn**：
   - 所有请求走 `law.workspace.limitee.cn`
   - 后端不直接暴露
   - 更安全！

4. **后端 CORS 配置**：
   - 虽然不需要 CORS，但保留之前的配置也没问题
   - 如果以后需要其他域名访问，CORS 配置会有用

---

## ✅ 最终检查清单

- [ ] 外部 Nginx 配置已更新
- [ ] `location ~ ^/(v1|api)/` 规则已添加
- [ ] `location /` 规则存在（前端静态资源）
- [ ] Nginx 配置测试通过：`sudo nginx -t`
- [ ] Nginx 已重载：`sudo nginx -s reload`
- [ ] 浏览器访问 `https://law.workspace.limitee.cn`
- [ ] 浏览器 Network 标签中所有请求都是 `law.workspace.limitee.cn`
- [ ] 没有 CORS 错误
- [ ] API 请求正常返回数据

---

## 🎉 完成！

配置完成后，你的系统将非常简洁：
- ✅ 用户只看到一个域名：`law.workspace.limitee.cn`
- ✅ 前端和后端请求都通过同一个域名
- ✅ 不需要 CORS 配置
- ✅ 更安全，后端不直接暴露

**最后更新**：2025-01-10
