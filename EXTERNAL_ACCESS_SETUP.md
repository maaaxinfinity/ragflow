# 外部访问配置指南（方案 2）

## 🎯 架构说明

```
用户访问前端：https://law.workspace.limitee.cn
          ↓
   外部 Nginx → 49.232.140.181:19011
          ↓ (端口转发)
   UmiJS Dev Server (本地 8000/8001)

前端发起 API 请求：https://rag.limitee.cn/v1/...
          ↓
   外部 Nginx → 49.232.140.181:19012
          ↓ (端口转发)
   Docker 后端 API (本地 9380)
```

---

## ✅ 配置步骤

### 步骤 1：在服务器上添加端口转发

登录到服务器 `49.232.140.181`，执行以下命令：

#### 方法 A：使用 iptables（推荐）

```bash
# 1. 添加端口转发规则
sudo iptables -t nat -A PREROUTING -p tcp --dport 19012 -j REDIRECT --to-port 9380

# 2. 允许端口通过防火墙
sudo iptables -A INPUT -p tcp --dport 19012 -j ACCEPT
sudo iptables -A INPUT -p tcp --dport 9380 -j ACCEPT

# 3. 保存规则（持久化）
sudo iptables-save | sudo tee /etc/iptables/rules.v4

# 或者（根据系统）
sudo service iptables save
```

#### 方法 B：使用 firewalld

```bash
# 1. 添加端口转发
sudo firewall-cmd --permanent --add-forward-port=port=19012:proto=tcp:toport=9380

# 2. 开放端口
sudo firewall-cmd --permanent --add-port=19012/tcp
sudo firewall-cmd --permanent --add-port=9380/tcp

# 3. 重载配置
sudo firewall-cmd --reload
```

#### 方法 C：使用 socat（简单测试）

```bash
# 安装 socat
sudo apt-get install socat  # Debian/Ubuntu
sudo yum install socat      # CentOS/RHEL

# 启动端口转发（前台运行，用于测试）
socat TCP-LISTEN:19012,fork TCP:localhost:9380

# 后台运行（生产环境）
nohup socat TCP-LISTEN:19012,fork TCP:localhost:9380 > /tmp/socat-19012.log 2>&1 &
```

#### 验证端口转发

```bash
# 检查端口是否监听
sudo netstat -tulnp | grep 19012

# 测试转发是否工作
curl http://localhost:19012/v1/system/status
```

---

### 步骤 2：配置外部 Nginx

在外部 Nginx 服务器上，添加 `rag.limitee.cn` 的配置文件：

**文件位置**：`/etc/nginx/sites-available/rag.limitee.cn.conf`

```nginx
# 后端 API 配置
server {
    listen 443 ssl http2;
    server_name rag.limitee.cn;
    
    # SSL 证书配置
    ssl_certificate /path/to/your/ssl/rag.limitee.cn.crt;
    ssl_certificate_key /path/to/your/ssl/rag.limitee.cn.key;
    
    # SSL 安全配置
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_ciphers 'ECDHE-ECDSA-AES128-GCM-SHA256:ECDHE-RSA-AES128-GCM-SHA256:ECDHE-ECDSA-AES256-GCM-SHA384:ECDHE-RSA-AES256-GCM-SHA384';
    ssl_prefer_server_ciphers on;
    ssl_session_cache shared:SSL:10m;
    ssl_session_timeout 10m;
    
    # 代理到后端 API
    location / {
        # 代理到端口转发地址
        proxy_pass http://49.232.140.181:19012;
        proxy_http_version 1.1;
        
        # 基础代理头
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
        
        # CORS 配置（关键！）
        add_header Access-Control-Allow-Origin "https://law.workspace.limitee.cn" always;
        add_header Access-Control-Allow-Methods "GET, POST, PUT, DELETE, OPTIONS, PATCH" always;
        add_header Access-Control-Allow-Headers "Authorization, Content-Type, X-Requested-With, Accept" always;
        add_header Access-Control-Allow-Credentials "true" always;
        add_header Access-Control-Expose-Headers "Authorization" always;
        
        # OPTIONS 预检请求处理
        if ($request_method = 'OPTIONS') {
            add_header Access-Control-Allow-Origin "https://law.workspace.limitee.cn" always;
            add_header Access-Control-Allow-Methods "GET, POST, PUT, DELETE, OPTIONS, PATCH" always;
            add_header Access-Control-Allow-Headers "Authorization, Content-Type, X-Requested-With, Accept" always;
            add_header Access-Control-Allow-Credentials "true" always;
            add_header Access-Control-Max-Age 3600 always;
            add_header Content-Length 0;
            add_header Content-Type "text/plain charset=UTF-8";
            return 204;
        }
    }
    
    # 访问日志
    access_log /var/log/nginx/rag.limitee.cn.access.log;
    error_log /var/log/nginx/rag.limitee.cn.error.log;
}

# HTTP 重定向到 HTTPS
server {
    listen 80;
    server_name rag.limitee.cn;
    return 301 https://$server_name$request_uri;
}
```

**WebSocket 支持**（在 http 块中添加）：

```nginx
http {
    # ... 其他配置
    
    # WebSocket 连接升级映射
    map $http_upgrade $connection_upgrade {
        default upgrade;
        '' close;
    }
    
    # ... 其他配置
}
```

**启用配置**：

```bash
# 创建软链接
sudo ln -s /etc/nginx/sites-available/rag.limitee.cn.conf /etc/nginx/sites-enabled/

# 测试配置
sudo nginx -t

# 重载 Nginx
sudo nginx -s reload
```

---

### 步骤 3：重启 RAGFlow 后端服务

在 RAGFlow 服务器上重启后端（应用 CORS 配置）：

```bash
cd ~/workspace/ragflow

# 重启 Docker 容器
docker restart ragflow-server-dev

# 或者使用开发脚本
bash build-and-run-dev.sh --restart

# 查看日志确认启动成功
docker logs -f ragflow-server-dev
```

---

### 步骤 4：验证配置

#### 4.1 验证端口转发

```bash
# 在服务器上测试
curl http://localhost:19012/v1/system/status

# 从外部测试
curl http://49.232.140.181:19012/v1/system/status
```

#### 4.2 验证 Nginx 配置

```bash
# 测试 HTTPS 访问
curl -k https://rag.limitee.cn/v1/system/status

# 测试 CORS 头
curl -H "Origin: https://law.workspace.limitee.cn" \
     -H "Access-Control-Request-Method: POST" \
     -H "Access-Control-Request-Headers: Authorization, Content-Type" \
     -X OPTIONS \
     -k https://rag.limitee.cn/v1/user/info
```

#### 4.3 浏览器测试

1. 访问前端：https://law.workspace.limitee.cn
2. 打开浏览器开发者工具（F12）
3. 切换到 Network 标签
4. 刷新页面
5. 查看 API 请求：
   - URL 应该是：`https://rag.limitee.cn/v1/...`
   - Response Headers 应该包含：`Access-Control-Allow-Origin: https://law.workspace.limitee.cn`
   - 状态码应该是 200（不再是 CORS 错误）

---

## 🔍 故障排查

### 问题 1：端口转发不工作

**症状**：`curl http://49.232.140.181:19012` 连接失败

**排查**：
```bash
# 检查端口是否监听
sudo netstat -tulnp | grep 19012

# 检查防火墙规则
sudo iptables -L -n -v | grep 19012

# 检查 Docker 容器是否运行
docker ps | grep ragflow

# 检查后端 9380 端口
curl http://localhost:9380/v1/system/status
```

**解决**：
- 确保 Docker 容器正常运行
- 检查防火墙是否开放 19012 端口
- 确认端口转发规则正确

---

### 问题 2：CORS 错误仍然存在

**症状**：浏览器控制台仍然显示 CORS 错误

**排查**：
```bash
# 1. 检查 Nginx CORS 头
curl -I -H "Origin: https://law.workspace.limitee.cn" https://rag.limitee.cn/v1/system/status

# 应该看到：
# Access-Control-Allow-Origin: https://law.workspace.limitee.cn
# Access-Control-Allow-Credentials: true

# 2. 检查后端 CORS 配置
docker exec ragflow-server-dev cat /ragflow/api/apps/__init__.py | grep -A 10 "CORS(app"
```

**解决**：
- 确认 Nginx 配置中的 CORS 头正确
- 确认后端 CORS 配置已更新并重启
- 检查是否有多层 Nginx 导致 CORS 头被覆盖

---

### 问题 3：OPTIONS 请求失败

**症状**：浏览器发送 OPTIONS 预检请求失败

**排查**：
```bash
# 测试 OPTIONS 请求
curl -X OPTIONS \
     -H "Origin: https://law.workspace.limitee.cn" \
     -H "Access-Control-Request-Method: POST" \
     -H "Access-Control-Request-Headers: Authorization, Content-Type" \
     -v https://rag.limitee.cn/v1/user/info

# 应该返回 204 No Content
```

**解决**：
- 确认 Nginx 配置中的 `if ($request_method = 'OPTIONS')` 块存在
- 检查 Nginx 日志：`tail -f /var/log/nginx/rag.limitee.cn.error.log`

---

### 问题 4：SSL 证书问题

**症状**：HTTPS 访问提示证书错误

**排查**：
```bash
# 检查证书
openssl s_client -connect rag.limitee.cn:443 -servername rag.limitee.cn

# 检查证书有效期
openssl x509 -in /path/to/rag.limitee.cn.crt -text -noout
```

**解决**：
- 确保 SSL 证书包含 `rag.limitee.cn` 域名
- 检查证书是否过期
- 可以使用通配符证书：`*.limitee.cn`

---

## 📊 完整的请求流程图

```
┌─────────────────────────────────────────────────────────────────┐
│                         用户浏览器                               │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ├─── 前端请求 ───┐
                              │                │
                              ↓                ↓
        ┌────────────────────────┐    ┌────────────────────┐
        │ law.workspace.limitee.cn│    │ rag.limitee.cn    │
        │  (前端静态资源)          │    │  (后端 API)        │
        └────────────────────────┘    └────────────────────┘
                    ↓                            ↓
        ┌────────────────────────┐    ┌────────────────────┐
        │   外部 Nginx 反向代理   │    │  外部 Nginx 反向代理│
        └────────────────────────┘    └────────────────────┘
                    ↓                            ↓
        ┌────────────────────────┐    ┌────────────────────┐
        │ 49.232.140.181:19011   │    │ 49.232.140.181:19012│
        └────────────────────────┘    └────────────────────┘
                    ↓                            ↓
        ┌────────────────────────┐    ┌────────────────────┐
        │   端口转发 → 8000      │    │  端口转发 → 9380   │
        └────────────────────────┘    └────────────────────┘
                    ↓                            ↓
        ┌────────────────────────┐    ┌────────────────────┐
        │   UmiJS Dev Server     │    │  Docker RAGFlow    │
        │   (宿主机 localhost)    │    │  (容器 9380 端口)  │
        └────────────────────────┘    └────────────────────┘
                    │                            ↑
                    └────── API 代理 /v1 ────────┘
```

---

## ✅ 配置完成检查清单

- [ ] **步骤 1**：服务器端口转发 19012 → 9380 已配置
- [ ] **步骤 2**：外部 Nginx `rag.limitee.cn` 配置已添加
- [ ] **步骤 3**：RAGFlow 后端已重启（应用 CORS 配置）
- [ ] **步骤 4**：验证端口转发正常工作
- [ ] **步骤 5**：验证 Nginx 配置正确
- [ ] **步骤 6**：浏览器访问前端，无 CORS 错误
- [ ] **步骤 7**：API 请求正常返回数据

---

## 🚀 测试命令汇总

```bash
# 1. 测试端口转发
curl http://49.232.140.181:19012/v1/system/status

# 2. 测试 HTTPS 访问
curl -k https://rag.limitee.cn/v1/system/status

# 3. 测试 CORS
curl -H "Origin: https://law.workspace.limitee.cn" \
     -H "Access-Control-Request-Method: POST" \
     -H "Access-Control-Request-Headers: Authorization" \
     -X OPTIONS \
     -v https://rag.limitee.cn/v1/user/info

# 4. 测试完整请求
curl -H "Origin: https://law.workspace.limitee.cn" \
     -H "Authorization: Bearer your-token" \
     -X GET \
     https://rag.limitee.cn/v1/user/info
```

---

## 📝 注意事项

1. **SSL 证书**：确保 `rag.limitee.cn` 有有效的 SSL 证书
2. **防火墙**：确保服务器防火墙允许 19012 端口访问
3. **Docker 网络**：确保 Docker 容器可以被宿主机访问（9380 端口）
4. **CORS 配置**：前端域名必须与 CORS 配置中的域名完全匹配
5. **端口转发持久化**：使用 iptables-persistent 或 firewalld 确保重启后规则不丢失

---

**最后更新**：2025-01-10  
**文档状态**：生产就绪
