# RAGFlow 配置系统与部署详细分析

> 配置文件: docker/.env, docker/service_conf.yaml.template, conf/llm_factories.json
> 部署方式: Docker Compose

## 1. 环境变量配置 (docker/.env)

### 1.1 文档引擎选择

```bash
# 文档引擎类型 (向量/全文搜索)
DOC_ENGINE=${DOC_ENGINE:-elasticsearch}
# 可选值: elasticsearch | infinity | opensearch

# Docker Compose profiles (自动匹配 DOC_ENGINE)
COMPOSE_PROFILES=${DOC_ENGINE}
```

**引擎对比**:
- **Elasticsearch 8.11.3** (默认):
  - 成熟稳定,生态丰富
  - 向量搜索 + 全文搜索
  - 内存占用较高 (建议 >=4GB)
  
- **Infinity**:
  - 开源向量数据库 (InfiniFlow 自研)
  - 高性能,低内存
  - Thrift/HTTP/PostgreSQL 协议
  
- **OpenSearch 2.x**:
  - Elasticsearch 的开源分支
  - AWS 维护
  - 兼容 Elasticsearch API

### 1.2 Elasticsearch 配置

```bash
# 版本
STACK_VERSION=8.11.3

# 主机名和端口
ES_HOST=es01
ES_PORT=1200  # 宿主机端口 (映射到容器 9200)

# 密码 (重要: 生产环境务必修改)
ELASTIC_PASSWORD=infini_rag_flow

# Kibana 配置 (可视化管理界面)
KIBANA_PORT=6601
KIBANA_USER=rag_flow
KIBANA_PASSWORD=infini_rag_flow

# 内存限制 (字节)
MEM_LIMIT=8073741824  # 8GB
```

### 1.3 Infinity 配置

```bash
# 主机名
INFINITY_HOST=infinity

# 端口
INFINITY_THRIFT_PORT=23817  # Thrift 协议
INFINITY_HTTP_PORT=23820    # HTTP API
INFINITY_PSQL_PORT=5432     # PostgreSQL 协议
```

### 1.4 OpenSearch 配置

```bash
# 主机名和端口
OS_HOST=opensearch01
OS_PORT=1201  # 宿主机端口

# 密码 (至少包含大写、小写、数字、特殊字符)
OPENSEARCH_PASSWORD=infini_rag_flow_OS_01
```

### 1.5 MySQL 配置

```bash
# 密码
MYSQL_PASSWORD=infini_rag_flow

# 主机名和端口
MYSQL_HOST=mysql
MYSQL_PORT=5455  # 宿主机端口 (映射到容器 3306)

# 数据库名
MYSQL_DBNAME=rag_flow

# 最大数据包大小 (字节)
MYSQL_MAX_PACKET=1073741824  # 1GB
```

**数据库切换** (PostgreSQL):
1. 修改 `docker/.env`:
   ```bash
   # 添加 PostgreSQL 配置
   POSTGRES_PASSWORD=infini_rag_flow
   POSTGRES_HOST=postgres
   POSTGRES_PORT=5433
   POSTGRES_DBNAME=rag_flow
   ```

2. 修改 `docker/service_conf.yaml.template`:
   ```yaml
   database:
     type: postgres  # 默认 mysql
     host: ${POSTGRES_HOST}
     port: ${POSTGRES_PORT}
     database: ${POSTGRES_DBNAME}
     user: postgres
     password: ${POSTGRES_PASSWORD}
   ```

### 1.6 MinIO 配置 (对象存储)

```bash
# 主机名和端口
MINIO_HOST=minio
MINIO_PORT=9000         # S3 API 端口
MINIO_CONSOLE_PORT=9001 # Web 控制台端口

# 凭证 (需与 service_conf.yaml 中一致)
MINIO_USER=rag_flow
MINIO_PASSWORD=infini_rag_flow
```

**对象存储切换**:

**1. AWS S3**:
```bash
STORAGE_IMPL=AWS_S3
ACCESS_KEY=your-access-key
SECRET_KEY=your-secret-key
ENDPOINT=https://s3.amazonaws.com
REGION=us-east-1
BUCKET=ragflow-bucket
```

**2. 阿里云 OSS**:
```bash
STORAGE_IMPL=OSS
ACCESS_KEY=your-access-key
SECRET_KEY=your-secret-key
ENDPOINT=http://oss-cn-hangzhou.aliyuncs.com
REGION=cn-hangzhou
BUCKET=ragflow65536
```

**3. Azure Blob Storage**:
```bash
STORAGE_IMPL=AZURE_SPN
# 需在 service_conf.yaml 中配置 Azure 凭证
```

### 1.7 Redis 配置

```bash
# 主机名和端口
REDIS_HOST=redis
REDIS_PORT=6379  # 宿主机端口

# 密码
REDIS_PASSWORD=infini_rag_flow
```

**替换为 Valkey** (Redis 开源分支):
- 代码中已支持 `valkey` Python 包
- 配置与 Redis 相同

### 1.8 RAGFlow 服务配置

```bash
# HTTP API 端口
SVR_HTTP_PORT=9380  # 宿主机端口 (映射到容器 80)

# Docker 镜像
RAGFLOW_IMAGE=infiniflow/ragflow:v0.20.5-slim
# 或完整版 (包含嵌入模型):
# RAGFLOW_IMAGE=infiniflow/ragflow:v0.20.5

# 镜像版本说明:
# - vX.X.X-slim: 精简版 (~2GB),不含嵌入模型,需外部 Embedding 服务
# - vX.X.X: 完整版 (~9GB),包含 BAAI/bge-large-zh-v1.5 和 bce-embedding-base_v1

# 国内镜像 (如果无法访问 Docker Hub):
# RAGFLOW_IMAGE=swr.cn-north-4.myhuaweicloud.com/infiniflow/ragflow:v0.20.5-slim
# RAGFLOW_IMAGE=registry.cn-hangzhou.aliyuncs.com/infiniflow/ragflow:v0.20.5-slim
```

### 1.9 系统配置

```bash
# 时区
TIMEZONE=Asia/Shanghai

# HuggingFace 镜像 (国内加速)
HF_ENDPOINT=https://hf-mirror.com

# MacOS 优化 (如果运行在 MacOS 上,取消注释)
# MACOS=1
```

### 1.10 上传限制

```bash
# 最大上传文件大小 (字节)
MAX_CONTENT_LENGTH=2147483648  # 2GB (默认)

# 注意:
# 1. 同时需要修改 nginx/nginx.conf 中的 client_max_body_size
# 2. Agent Begin 组件的文件上传大小限制独立配置
```

### 1.11 性能调优

```bash
# 文档批处理大小 (每批处理的文档数)
DOC_BULK_SIZE=${DOC_BULK_SIZE:-4}

# 嵌入批处理大小 (每批生成的嵌入向量数)
EMBEDDING_BATCH_SIZE=${EMBEDDING_BATCH_SIZE:-16}
```

**建议**:
- 内存充足时,可增大批处理大小以提高吞吐量
- GPU 场景下,`EMBEDDING_BATCH_SIZE` 可设为 32-64
- 注意避免 OOM (内存溢出)

### 1.12 日志级别

```bash
# 日志级别配置
LOG_LEVELS=ragflow.es_conn=DEBUG,ragflow.llm=INFO

# 可用级别: DEBUG, INFO, WARNING, ERROR
# 格式: module1=LEVEL1,module2=LEVEL2

# 示例:
# LOG_LEVELS=ragflow=DEBUG  # 所有模块 DEBUG
# LOG_LEVELS=ragflow.api=INFO,ragflow.rag=DEBUG  # API 模块 INFO, RAG 模块 DEBUG
```

### 1.13 用户注册开关

```bash
# 用户注册开关
REGISTER_ENABLED=1  # 1: 启用注册, 0: 禁用注册

# FreeChat 管理员邮箱
ADMIN_EMAIL=3206288040@qq.com
```

### 1.14 沙箱代码执行 (可选)

```bash
# 启用沙箱 (Agent 代码执行)
# SANDBOX_ENABLED=1

# 沙箱主机
# SANDBOX_HOST=sandbox-executor-manager

# 沙箱镜像
# SANDBOX_EXECUTOR_MANAGER_IMAGE=infiniflow/sandbox-executor-manager:latest
# SANDBOX_BASE_PYTHON_IMAGE=infiniflow/sandbox-base-python:latest
# SANDBOX_BASE_NODEJS_IMAGE=infiniflow/sandbox-base-nodejs:latest

# 沙箱配置
# SANDBOX_EXECUTOR_MANAGER_PORT=9385
# SANDBOX_EXECUTOR_MANAGER_POOL_SIZE=3
# SANDBOX_ENABLE_SECCOMP=false
# SANDBOX_MAX_MEMORY=256m  # b, k, m, g
# SANDBOX_TIMEOUT=10s      # s, m, 1m30s

# 注意: 启用沙箱需要:
# 1. 安装 gVisor
# 2. 预拉取基础镜像:
#    docker pull infiniflow/sandbox-base-nodejs:latest
#    docker pull infiniflow/sandbox-base-python:latest
# 3. 修改 COMPOSE_PROFILES:
#    COMPOSE_PROFILES=elasticsearch,sandbox
#    # 或 infinity,sandbox / opensearch,sandbox
# 4. 添加到 /etc/hosts:
#    127.0.0.1 sandbox-executor-manager
```

## 2. 服务配置 (docker/service_conf.yaml.template)

此文件是模板,Docker 启动时会替换环境变量生成实际的 `service_conf.yaml`。

### 2.1 数据库配置

```yaml
database:
  type: mysql  # mysql | postgres
  host: ${MYSQL_HOST}
  port: ${MYSQL_PORT}
  database: ${MYSQL_DBNAME}
  user: root
  password: ${MYSQL_PASSWORD}
  pool_size: 10
  max_overflow: 20
```

### 2.2 对象存储配置

```yaml
storage:
  type: ${STORAGE_IMPL:-MINIO}  # MINIO | AWS_S3 | OSS | AZURE_SPN
  
  # MinIO 配置
  minio:
    host: ${MINIO_HOST}
    port: ${MINIO_PORT}
    access_key: ${MINIO_USER}
    secret_key: ${MINIO_PASSWORD}
    secure: false
    bucket: ragflow
  
  # AWS S3 配置
  s3:
    access_key: ${ACCESS_KEY}
    secret_key: ${SECRET_KEY}
    endpoint: ${ENDPOINT}
    region: ${REGION}
    bucket: ${BUCKET}
  
  # 阿里云 OSS 配置
  oss:
    access_key: ${ACCESS_KEY}
    secret_key: ${SECRET_KEY}
    endpoint: ${ENDPOINT}
    region: ${REGION}
    bucket: ${BUCKET}
  
  # Azure Blob 配置
  azure:
    tenant_id: xxx
    client_id: xxx
    client_secret: xxx
    account_name: xxx
    container: ragflow
```

### 2.3 文档引擎配置

```yaml
doc_engine:
  type: ${DOC_ENGINE}  # elasticsearch | infinity | opensearch
  
  # Elasticsearch 配置
  elasticsearch:
    hosts:
      - http://${ES_HOST}:9200
    user: elastic
    password: ${ELASTIC_PASSWORD}
  
  # Infinity 配置
  infinity:
    host: ${INFINITY_HOST}
    thrift_port: ${INFINITY_THRIFT_PORT}
    http_port: ${INFINITY_HTTP_PORT}
  
  # OpenSearch 配置
  opensearch:
    hosts:
      - http://${OS_HOST}:9200
    user: admin
    password: ${OPENSEARCH_PASSWORD}
```

### 2.4 Redis 配置

```yaml
redis:
  host: ${REDIS_HOST}
  port: ${REDIS_PORT}
  password: ${REDIS_PASSWORD}
  db: 0
  max_connections: 50
```

### 2.5 默认 LLM 配置

```yaml
# 新用户的默认 LLM 设置
user_default_llm:
  factory: OpenAI  # LLM 提供商 (对应 llm_factories.json 中的 name)
  llm_name: gpt-4o  # 模型名称
  api_key: sk-xxx  # API Key (可选,用户可后续配置)
  api_base: https://api.openai.com/v1  # API Base URL (可选)
```

### 2.6 服务端口

```yaml
server:
  host: 0.0.0.0
  port: 80  # 容器内端口 (映射到宿主机 ${SVR_HTTP_PORT})
  workers: 4  # Gunicorn workers (建议 = CPU 核心数)
```

### 2.7 任务执行器配置

```yaml
task_executor:
  workers: 2  # 并行处理文档的 worker 数量
  concurrency: 4  # 每个 worker 的并发任务数
```

## 3. LLM 提供商配置 (conf/llm_factories.json)

### 3.1 配置结构

```json
{
  "factory_llm_infos": [
    {
      "name": "OpenAI",
      "logo": "",
      "tags": "LLM,TEXT EMBEDDING,TTS,TEXT RE-RANK,SPEECH2TEXT,MODERATION",
      "status": "1",
      "llm": [
        {
          "llm_name": "gpt-4o",
          "tags": "LLM,CHAT,128K,IMAGE2TEXT",
          "max_tokens": 128000,
          "model_type": "chat",
          "is_tools": true
        },
        // ... 更多模型
      ]
    },
    // ... 更多提供商
  ]
}
```

### 3.2 支持的提供商 (部分)

1. **OpenAI**: gpt-4, gpt-5, o3, o4-mini, gpt-4o, gpt-4o-mini, text-embedding-3-large, tts-1, whisper-1
2. **Azure OpenAI**: 与 OpenAI 模型相同,但通过 Azure 端点
3. **Anthropic**: claude-3-5-sonnet-20241022, claude-3-5-haiku-20241022, claude-3-opus-20240229
4. **DeepSeek**: deepseek-chat, deepseek-reasoner
5. **Moonshot**: moonshot-v1-8k, moonshot-v1-32k, moonshot-v1-128k
6. **Tongyi-Qianwen** (阿里通义千问): qwen-turbo, qwen-plus, qwen-max, qwen-vl-max
7. **ZHIPU-AI** (智谱 AI): glm-4, glm-4-plus, glm-4v, glm-4v-plus, embedding-3
8. **Baidu Qianfan** (百度千帆): ERNIE-4.0-8K, ERNIE-3.5-8K, ERNIE-Speed-128K
9. **VolcEngine** (火山引擎/豆包): doubao-pro-32k, doubao-lite-32k
10. **Minimax**: abab6.5s-chat, abab6.5g-chat, abab6.5t-chat
11. **Groq**: llama-3.3-70b-versatile, mixtral-8x7b-32768
12. **Cohere**: command-r-plus, command-r, embed-english-v3.0, rerank-english-v3.0
13. **Ollama**: 支持所有 Ollama 模型 (本地部署)
14. **LocalAI**: 支持所有 LocalAI 模型
15. **Google Gemini**: gemini-1.5-pro, gemini-1.5-flash, text-embedding-004
16. **Vertex AI**: 与 Google Gemini 类似
17. **Mistral AI**: mistral-large-latest, mistral-small-latest, ministral-8b-latest
18. **Replicate**: 支持 Replicate 上的开源模型
19. **Voyage AI**: voyage-3, voyage-3-lite, rerank-2
20. **AWS Bedrock**: 支持 Bedrock 上的模型
21. **LiteLLM**: 统一的 LLM 代理接口 (支持 100+ 模型)
22. **Yi** (零一万物): yi-lightning, yi-large, yi-medium, yi-vision
23. **Jina AI**: jina-embeddings-v3, jina-reranker-v2-base-multilingual
24. **Upstage**: solar-pro, solar-mini
25. **Hunyuan** (腾讯混元): hunyuan-lite, hunyuan-standard, hunyuan-pro
26. **Spark** (讯飞星火): Spark4.0 Ultra, Spark Max, Spark Pro, Spark Lite
27. **StepFun** (阶跃星辰): step-1-8k, step-1-32k, step-1-128k, step-1-256k
28. **XunFei** (讯飞): 与 Spark 类似
29. **Fish Audio**: fish-speech-1.5, fish-agent-v1.5
30. **Bedrock**: anthropic.claude-3-5-sonnet-20241022-v2:0, meta.llama3-1-405b-instruct-v1:0

### 3.3 标签说明

**提供商标签**:
- `LLM`: 支持大语言模型
- `TEXT EMBEDDING`: 支持文本嵌入
- `TTS`: 文本转语音
- `TEXT RE-RANK`: 文本重排序
- `SPEECH2TEXT`: 语音转文本
- `MODERATION`: 内容审核
- `IMAGE2TEXT`: 图片转文本

**模型标签**:
- `CHAT`: 聊天模型
- `COMPLETION`: 补全模型
- `IMAGE2TEXT`: 支持图片输入
- `128K`, `200K`, `1M` 等: 最大 token 数

### 3.4 添加自定义 LLM 提供商

**步骤**:

1. **修改 `conf/llm_factories.json`**:
```json
{
  "name": "MyLLM",
  "logo": "",
  "tags": "LLM,TEXT EMBEDDING",
  "status": "1",
  "llm": [
    {
      "llm_name": "my-model-v1",
      "tags": "LLM,CHAT,32K",
      "max_tokens": 32000,
      "model_type": "chat",
      "is_tools": true
    }
  ]
}
```

2. **实现 LLM 集成** (在 `rag/llm/chat_model.py` 的 `LLMBundle` 类中):
```python
def chat(self, system, history, gen_conf):
    if self.llm_factory == "MyLLM":
        # 实现调用逻辑
        import requests
        response = requests.post(
            f"{self.api_base}/v1/chat/completions",
            headers={"Authorization": f"Bearer {self.api_key}"},
            json={
                "model": self.llm_name,
                "messages": [
                    {"role": "system", "content": system},
                    *history
                ],
                "temperature": gen_conf.get("temperature", 0.7),
                "max_tokens": gen_conf.get("max_tokens", 512),
            }
        )
        return response.json()["choices"][0]["message"]["content"]
    # ... 其他提供商
```

3. **在 `api/db/db_models.py` 中添加 LLMType 枚举** (可选,如果需要):
```python
class LLMType(Enum):
    # ... 现有类型
    MyLLM = "MyLLM"
```

4. **重启服务**:
```bash
docker compose restart ragflow-server
```

## 4. Docker Compose 部署

### 4.1 生产部署 (docker-compose.yml)

```bash
cd ragflow/docker
docker compose -f docker-compose.yml up -d
```

**服务包含**:
- `ragflow-server`: RAGFlow 主服务
- `es01` / `infinity` / `opensearch01`: 文档引擎 (根据 `DOC_ENGINE` 选择)
- `mysql`: 数据库
- `minio`: 对象存储
- `redis`: 缓存和队列
- `sandbox-executor-manager`: 沙箱 (可选)

**访问地址**:
- RAGFlow: `http://localhost:9380` (或 `${SVR_HTTP_PORT}`)
- MinIO Console: `http://localhost:9001`
- Kibana (如果启用): `http://localhost:6601`

### 4.2 开发部署 (docker-compose-base.yml)

只启动基础服务 (ES/MySQL/MinIO/Redis),后端和前端在本地运行:

```bash
cd ragflow/docker
docker compose -f docker-compose-base.yml up -d
```

### 4.3 GPU 加速部署 (docker-compose-gpu.yml)

支持 GPU 加速的嵌入和 DeepDoc 处理:

```bash
cd ragflow/docker
docker compose -f docker-compose-gpu.yml up -d
```

**要求**:
- NVIDIA GPU
- 安装 NVIDIA Docker Runtime

### 4.4 切换文档引擎

**从 Elasticsearch 切换到 Infinity**:

```bash
# 1. 停止并删除数据卷 (警告: 会清空所有数据)
docker compose -f docker-compose.yml down -v

# 2. 修改 docker/.env
sed -i 's/DOC_ENGINE=elasticsearch/DOC_ENGINE=infinity/' .env

# 3. 启动
docker compose -f docker-compose.yml up -d
```

**从 Elasticsearch 切换到 OpenSearch**:

```bash
# 1. 停止并删除数据卷
docker compose -f docker-compose.yml down -v

# 2. 修改 docker/.env
sed -i 's/DOC_ENGINE=elasticsearch/DOC_ENGINE=opensearch/' .env

# 3. 启动
docker compose -f docker-compose.yml up -d
```

### 4.5 数据持久化

**数据卷**:
- `ragflow-mysql`: MySQL 数据
- `ragflow-es`: Elasticsearch 数据
- `ragflow-infinity`: Infinity 数据
- `ragflow-opensearch`: OpenSearch 数据
- `ragflow-minio`: MinIO 数据
- `ragflow-redis`: Redis 数据

**备份数据**:

```bash
# 备份 MySQL
docker exec ragflow-mysql mysqldump -u root -p${MYSQL_PASSWORD} ${MYSQL_DBNAME} > backup.sql

# 备份 MinIO (使用 mc 客户端)
docker exec ragflow-minio mc mirror /data /backup

# 备份 Elasticsearch
# 使用 Elasticsearch Snapshot API
```

### 4.6 扩展 Task Executor

修改 `docker/launch_backend_service.sh`:

```bash
# 设置 worker 数量
export WS=4  # 启动 4 个 task_executor 进程

# 启动 task_executor
for i in $(seq 1 $WS); do
    python rag/svr/task_executor.py &
done
```

### 4.7 日志查看

```bash
# 查看 ragflow-server 日志
docker compose logs -f ragflow-server

# 查看所有服务日志
docker compose logs -f

# 查看特定服务日志
docker compose logs -f es01
docker compose logs -f mysql
```

### 4.8 健康检查

```bash
# 检查服务状态
docker compose ps

# RAGFlow API 健康检查
curl http://localhost:9380/api/health

# Elasticsearch 健康检查
curl http://localhost:1200/_cluster/health

# MinIO 健康检查
curl http://localhost:9000/minio/health/live
```

## 5. Nginx 配置 (nginx/nginx.conf)

### 5.1 反向代理配置

```nginx
http {
    # 上传文件大小限制 (需与 MAX_CONTENT_LENGTH 一致)
    client_max_body_size 2048m;
    
    server {
        listen 80;
        server_name _;
        
        # 前端静态文件
        location / {
            root /ragflow/web;
            try_files $uri $uri/ /index.html;
        }
        
        # 后端 API
        location /api {
            proxy_pass http://127.0.0.1:9380;
            proxy_set_header Host $host;
            proxy_set_header X-Real-IP $remote_addr;
            proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
            proxy_set_header X-Forwarded-Proto $scheme;
            
            # 超时设置
            proxy_read_timeout 600s;
            proxy_send_timeout 600s;
            
            # WebSocket 支持 (流式响应)
            proxy_http_version 1.1;
            proxy_set_header Upgrade $http_upgrade;
            proxy_set_header Connection "upgrade";
        }
    }
}
```

### 5.2 HTTPS 配置

```nginx
server {
    listen 443 ssl http2;
    server_name example.com;
    
    ssl_certificate /etc/nginx/certs/fullchain.pem;
    ssl_certificate_key /etc/nginx/certs/privkey.pem;
    
    # SSL 配置
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_ciphers HIGH:!aNULL:!MD5;
    ssl_prefer_server_ciphers on;
    
    # ... 其他配置同上
}

# HTTP 重定向到 HTTPS
server {
    listen 80;
    server_name example.com;
    return 301 https://$server_name$request_uri;
}
```

### 5.3 外部访问配置

参考 `EXTERNAL_ACCESS_SETUP.md`:

1. **修改 `docker/.env`**:
```bash
# 设置公网 IP 或域名
EXTERNAL_HOST=example.com
SVR_HTTP_PORT=443
```

2. **配置 Nginx 反向代理** (在公网服务器上):
```nginx
server {
    listen 443 ssl;
    server_name example.com;
    
    location / {
        proxy_pass http://internal-ip:9380;
        # ... 其他配置
    }
}
```

3. **防火墙规则**:
```bash
# 允许 443 端口
sudo ufw allow 443/tcp
```

## 6. 环境隔离

### 6.1 开发环境

```bash
# docker/.env.dev
DOC_ENGINE=elasticsearch
RAGFLOW_IMAGE=infiniflow/ragflow:nightly-slim
REGISTER_ENABLED=1
LOG_LEVELS=ragflow=DEBUG
```

### 6.2 生产环境

```bash
# docker/.env.prod
DOC_ENGINE=infinity  # 生产环境推荐 Infinity (性能更好)
RAGFLOW_IMAGE=infiniflow/ragflow:v0.20.5
REGISTER_ENABLED=0  # 禁用公开注册
LOG_LEVELS=ragflow=INFO
MYSQL_PASSWORD=strong-password-here
REDIS_PASSWORD=strong-password-here
ELASTIC_PASSWORD=strong-password-here
```

### 6.3 使用不同配置文件

```bash
# 加载特定环境变量文件
docker compose --env-file docker/.env.prod up -d
```

## 7. 性能调优建议

### 7.1 系统资源

**最低配置**:
- CPU: 4 核
- 内存: 8GB
- 磁盘: 50GB

**推荐配置**:
- CPU: 8 核+
- 内存: 16GB+ (Elasticsearch 需要较多内存)
- 磁盘: 200GB+ SSD
- GPU: (可选) NVIDIA GPU,用于加速嵌入和 DeepDoc

### 7.2 Elasticsearch 调优

```yaml
# docker-compose.yml 中 es01 服务的环境变量
environment:
  - "ES_JAVA_OPTS=-Xms4g -Xmx4g"  # JVM 堆内存 (建议设为物理内存的 50%)
  - discovery.type=single-node
  - xpack.security.enabled=true
  - cluster.routing.allocation.disk.threshold_enabled=false  # 禁用磁盘水位检查
```

### 7.3 MySQL 调优

```yaml
# docker-compose.yml 中 mysql 服务的配置
command:
  - --max_connections=500
  - --innodb_buffer_pool_size=2G
  - --innodb_log_file_size=512M
```

### 7.4 Redis 调优

```yaml
# docker-compose.yml 中 redis 服务的配置
command: redis-server --maxmemory 2gb --maxmemory-policy allkeys-lru
```

## 8. 安全建议

### 8.1 修改默认密码

生产环境务必修改所有默认密码:

```bash
# docker/.env
ELASTIC_PASSWORD=your-strong-password-1
MYSQL_PASSWORD=your-strong-password-2
REDIS_PASSWORD=your-strong-password-3
MINIO_PASSWORD=your-strong-password-4
OPENSEARCH_PASSWORD=your-strong-password-5
```

### 8.2 禁用公开注册

```bash
REGISTER_ENABLED=0
```

### 8.3 使用 HTTPS

- 使用 Let's Encrypt 免费证书
- 配置 Nginx HTTPS

### 8.4 网络隔离

- 使用 Docker 内部网络
- 只暴露必要的端口 (9380)
- 其他服务端口不对外暴露

### 8.5 定期备份

- 数据库备份 (每日)
- 对象存储备份 (增量)
- 配置文件备份

## 9. 故障排查

### 9.1 常见问题

**1. Elasticsearch 无法启动**:
```bash
# 检查日志
docker compose logs es01

# 可能原因:
# - 内存不足: 增加 ES_JAVA_OPTS
# - 磁盘不足: 清理磁盘空间
# - 端口冲突: 检查端口占用
```

**2. 上传文件失败**:
```bash
# 检查 MAX_CONTENT_LENGTH 和 Nginx client_max_body_size
# 检查 MinIO 是否正常运行
docker compose ps minio
```

**3. Task Executor 处理缓慢**:
```bash
# 增加 worker 数量 (docker/launch_backend_service.sh)
export WS=8

# 增加批处理大小 (docker/.env)
DOC_BULK_SIZE=8
EMBEDDING_BATCH_SIZE=32
```

### 9.2 日志分析

```bash
# 开启 DEBUG 日志
LOG_LEVELS=ragflow=DEBUG

# 重启服务
docker compose restart ragflow-server
```

---

**下一文档**: 05-api-endpoints.md (API 端点详细说明)
