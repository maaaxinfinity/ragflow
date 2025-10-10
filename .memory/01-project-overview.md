# RAGFlow 项目概览分析

> 分析时间: 2025-01-10
> 项目版本: v0.20.5
> 当前分支: release0.1

## 1. 项目基本信息

### 1.1 项目简介
RAGFlow 是一个基于深度文档理解的开源 RAG (检索增强生成) 引擎，提供完整的 RAG 工作流，结合大语言模型 (LLM) 提供准确的问答能力，并提供有据可查的引用来源。

### 1.2 技术栈概览

**后端技术栈:**
- Python 3.10-3.12
- Flask 3.0.3 (Web 框架)
- Peewee 3.17.1 (ORM)
- MySQL/PostgreSQL (数据库)
- Elasticsearch 8.12.1 / Infinity / OpenSearch (文档引擎)
- MinIO / S3 / OSS / Azure Blob (对象存储)
- Redis/Valkey (缓存和消息队列)

**前端技术栈:**
- React 18.2.0
- UmiJS 4.0.90 (React 框架)
- TypeScript 5.0.3
- Ant Design 5.12.7
- TailwindCSS
- React Query (状态管理)
- React Flow (可视化流程编辑)

**部署技术:**
- Docker & Docker Compose
- Nginx (反向代理)
- gVisor (沙箱环境,可选)

### 1.3 项目结构

```
ragflow/
├── api/                          # Flask HTTP API 服务层
│   ├── apps/                     # REST API 端点 (blueprints)
│   ├── db/                       # 数据库层 (ORM 模型 & 服务)
│   ├── utils/                    # 工具函数
│   └── ragflow_server.py         # Flask 应用主入口
│
├── rag/                          # 核心 RAG 引擎
│   ├── app/                      # 文档解析器 (按类型)
│   ├── llm/                      # LLM 集成层
│   ├── nlp/                      # NLP 工具 (分词、搜索等)
│   ├── flow/                     # 工作流引擎
│   └── svr/                      # 后台服务
│       └── task_executor.py      # 异步文档处理 worker
│
├── agent/                        # Agent 系统 (工作流)
│   ├── canvas.py                 # Agent 图执行引擎
│   ├── component/                # Agent 组件库
│   ├── tools/                    # Agent 工具集成
│   └── templates/                # 预置 Agent 模板
│
├── deepdoc/                      # 深度文档理解
│   ├── parser/                   # 文档解析器 (PDF, DOCX 等)
│   └── vision/                   # 视觉模型 (布局分析)
│
├── graphrag/                     # 知识图谱 RAG 实现
│
├── mcp/                          # Model Context Protocol 服务
│
├── web/                          # 前端应用
│   ├── src/
│   │   ├── pages/                # 页面组件 (UmiJS 路由)
│   │   ├── components/           # 可复用组件
│   │   ├── services/             # API 服务层
│   │   ├── hooks/                # 自定义 React Hooks
│   │   ├── utils/                # 工具函数
│   │   └── locales/              # 国际化
│   └── package.json
│
├── docker/                       # Docker 部署配置
│   ├── .env                      # 环境变量配置
│   ├── docker-compose.yml        # 生产部署
│   └── docker-compose-base.yml   # 基础服务
│
├── conf/                         # 配置文件
│   ├── llm_factories.json        # LLM 提供商配置
│   └── service_conf.yaml.template # 服务配置模板
│
├── test/                         # 测试用例
├── sdk/                          # Python SDK
├── example/                      # 示例代码
└── docs/                         # 文档

总文件统计:
- Python 文件: ~400 个
- TypeScript/TSX 文件: ~800 个
- 配置文件: 多个 JSON/YAML/TOML
```

## 2. 核心依赖分析

### 2.1 Python 核心依赖 (pyproject.toml)

**Web 框架:**
- flask==3.0.3, flask-cors==5.0.0, flask-login==0.6.3

**数据库:**
- peewee==3.17.1, pymysql>=1.1.1, psycopg2-binary==2.9.9

**向量/搜索引擎:**
- elasticsearch==8.12.1, elasticsearch-dsl==8.12.0
- infinity-sdk==0.6.0.dev5, infinity-emb>=0.0.66
- opensearch-py==2.7.1

**对象存储:**
- minio==7.2.4, boto3==1.34.140 (AWS S3)
- azure-storage-blob==12.22.0
- opendal>=0.45.0

**LLM 集成:**
- openai>=1.45.0, anthropic==0.34.1
- cohere==5.6.2, groq==0.9.0, ollama==0.2.1
- dashscope==1.20.11 (阿里通义千问)
- zhipuai==2.0.1 (智谱 AI)
- qianfan==0.4.6 (百度千帆)
- volcengine==1.0.194 (火山引擎)
- replicate==0.31.0, mistralai==0.4.2
- vertexai==1.64.0 (Google Vertex AI)
- google-generativeai>=0.8.1 (Google Gemini)
- litellm>=1.74.15.post1 (统一 LLM 接口)

**文档处理:**
- pdfplumber==0.10.4, pypdf==6.0.0, pypdf2>=3.0.1
- python-docx>=1.1.2, python-pptx>=1.0.2
- openpyxl>=3.1.0, python-calamine>=0.4.0
- aspose-slides>=24.9.0 (PPT 处理)
- tika==2.6.0 (Apache Tika)
- markdown==3.6, markdown-to-json==2.1.1

**NLP & ML:**
- nltk==3.9.1, tiktoken==0.7.0
- scikit-learn==1.5.0, xgboost==1.6.0
- numpy>=1.26.0,<2.0.0, pandas>=2.2.0
- umap_learn==0.5.6
- onnxruntime==1.19.2 / onnxruntime-gpu==1.19.2
- torch>=2.5.0, transformers>=4.35.0 (可选,完整版)
- fastembed / fastembed-gpu (可选)
- bcembedding==0.1.5, flagembedding==1.2.10 (可选)

**网络爬虫:**
- Crawl4AI>=0.3.8, selenium==4.22.0
- requests==2.32.2, httpx[socks]==0.27.2

**其他工具:**
- valkey==6.0.2 (Redis 替代)
- celery 相关 (异步任务)
- langfuse>=2.60.0 (LLM 可观测性)
- debugpy>=1.8.13 (调试)
- mcp>=1.9.4 (Model Context Protocol)

### 2.2 前端核心依赖 (package.json)

**框架核心:**
- react==18.2.0, react-dom==18.2.0
- umi==4.0.90 (基于 React 的企业级框架)
- typescript==5.0.3

**UI 组件库:**
- antd==5.12.7 (Ant Design)
- @ant-design/pro-components==2.6.46
- @radix-ui/* (Radix UI 组件集)

**样式:**
- tailwindcss
- tailwindcss-animate, tailwind-merge

**状态管理:**
- @tanstack/react-query==5.40.0 (服务端状态)
- zustand==4.5.2 (客户端状态)
- immer==10.1.1 (不可变数据)

**可视化:**
- @xyflow/react==12.3.6 (工作流可视化)
- @antv/g2==5.2.10, @antv/g6==5.0.10 (图表)
- recharts==2.12.4

**表单:**
- react-hook-form==7.56.4
- @hookform/resolvers==3.9.1
- zod==3.23.8 (验证)

**文档预览:**
- react-pdf-highlighter==6.1.0
- pptx-preview==1.0.5
- mammoth==1.7.2 (DOCX)
- @js-preview/excel==1.7.14

**Markdown & 代码:**
- react-markdown==9.0.1
- @uiw/react-markdown-preview==5.1.3
- react-syntax-highlighter==15.5.0
- @monaco-editor/react==4.6.0

**国际化:**
- i18next==23.7.16
- react-i18next==14.0.0

**其他:**
- axios==1.6.3, umi-request==1.4.0 (HTTP 客户端)
- ahooks==3.7.10 (React Hooks 库)
- dayjs==1.11.10 (日期处理)
- lodash==4.17.21 (工具库)

## 3. 架构模式

### 3.1 微服务架构

RAGFlow 采用微服务架构，主要包含以下服务:

1. **ragflow_server** (api/ragflow_server.py)
   - Flask HTTP API 服务器
   - 处理 REST API 请求
   - 端口: 9380 (默认)

2. **task_executor** (rag/svr/task_executor.py)
   - 异步文档处理 worker
   - 从 Redis 队列读取任务
   - 可多进程扩展 (通过 WS 环境变量)

3. **基础服务 (Docker Compose)**
   - Elasticsearch / Infinity / OpenSearch (文档引擎)
   - MySQL (关系型数据库)
   - MinIO (对象存储)
   - Redis/Valkey (缓存和队列)
   - Sandbox Executor Manager (代码执行,可选)

### 3.2 两进程模型

- **HTTP 服务器** 和 **任务执行器** 通过 Redis 队列通信
- HTTP 服务器接收请求,将文档处理任务推入队列
- Task Executor 从队列取任务,异步处理

### 3.3 文档处理流程

```
上传 → 解析 (Parser) → 分块 (Chunker) → 
嵌入 (Embedding) → 索引 (Elasticsearch/Infinity)
```

### 3.4 RAG 查询流程

```
查询 → 检索文档块 (Retrieval) → 重排序 (Rerank) → 
LLM 生成 (带引用) → 返回结果
```

### 3.5 Agent Canvas 执行流程

- 基于有向无环图 (DAG) 的工作流执行
- 支持多种组件: LLM, Retrieval, Tools, 逻辑控制等
- 通过节点连接定义数据流

## 4. 开发环境设置

### 4.1 后端开发

```bash
# 安装依赖
pipx install uv pre-commit
uv sync --python 3.10 --all-extras
uv run download_deps.py
pre-commit install

# 启动基础服务
docker compose -f docker/docker-compose-base.yml up -d

# 配置 hosts (Windows: C:\Windows\System32\drivers\etc\hosts)
127.0.0.1 es01 infinity mysql minio redis sandbox-executor-manager

# 激活环境并启动后端
source .venv/bin/activate  # Windows: .venv\Scripts\activate
set PYTHONPATH=%cd%
bash docker/launch_backend_service.sh  # Windows 需要 Git Bash 或 WSL
```

### 4.2 前端开发

```bash
cd web
npm install
npm run dev  # 开发服务器: http://localhost:8000
```

### 4.3 生产部署

```bash
cd docker
docker compose -f docker-compose.yml up -d
# 访问: http://localhost:9380
```

## 5. 核心特性

1. **多文档格式支持**: PDF, DOCX, PPTX, XLSX, Markdown, HTML, TXT, 图片, 音频等
2. **多解析器**: 针对不同文档类型 (laws, paper, resume, book, manual 等)
3. **30+ LLM 提供商**: OpenAI, Anthropic, DeepSeek, 通义千问, 智谱 AI, 百度千帆等
4. **多向量存储**: Elasticsearch, Infinity, OpenSearch
5. **多对象存储**: MinIO, AWS S3, Azure Blob, 阿里云 OSS
6. **Agent 系统**: 可视化工作流编辑器,支持工具调用
7. **知识图谱 RAG**: GraphRAG 实现
8. **MCP 协议支持**: Model Context Protocol
9. **多租户**: 支持团队和权限管理
10. **国际化**: 支持中文、英文、日文、韩文等 10+ 语言

## 6. 配置系统

### 6.1 环境变量 (docker/.env)

- `DOC_ENGINE`: elasticsearch | infinity | opensearch
- `STORAGE_IMPL`: MINIO | AWS_S3 | OSS | AZURE_SPN
- `MAX_CONTENT_LENGTH`: 最大上传文件大小 (字节)
- `DOC_BULK_SIZE`: 文档批处理大小 (默认 4)
- `EMBEDDING_BATCH_SIZE`: 嵌入批大小 (默认 16)
- `REGISTER_ENABLED`: 用户注册开关 (0|1)
- `SANDBOX_ENABLED`: 沙箱代码执行 (0|1)

### 6.2 LLM 配置 (conf/llm_factories.json)

定义 30+ LLM 提供商的:
- API 端点
- 模型列表
- 支持的功能标签 (LLM, CHAT, EMBEDDING, RERANK, TTS, STT 等)
- 最大 token 数

### 6.3 服务配置 (docker/service_conf.yaml.template)

- 默认 LLM 设置
- 服务端口配置
- 数据库连接信息
- 对象存储配置

## 7. 开发工具

### 7.1 代码质量

- **Linting**: ruff (Python), eslint (TypeScript)
- **Formatting**: ruff format (Python), prettier (TypeScript)
- **Pre-commit hooks**: 自动检查代码质量

### 7.2 测试

```bash
# 后端测试 (pytest)
pytest test/
pytest -m p1  # 高优先级
pytest -m "p1 or p2"

# 前端测试 (Jest)
cd web
npm test
```

### 7.3 调试

- 后端: 设置 `RAGFLOW_DEBUGPY_LISTEN=5678`
- 前端: React DevTools, 浏览器调试器

## 8. 项目文档

- `README.md`: 项目主文档 (多语言)
- `CLAUDE.md`: Claude Code 开发指南
- `QUICK_DEV_GUIDE.md`: 快速开发指南
- `HOT_RELOAD_DEMO.md`: 热重载演示
- `CORS_FIX.md`: CORS 修复指南
- `EXTERNAL_ACCESS_SETUP.md`: 外部访问配置
- `FREE_CHAT_SETUP.md`: FreeChat 设置
- `NGINX_PROXY_CONFIG.md`: Nginx 代理配置
- `PORT_ARCHITECTURE.md`: 端口架构
- `PORT_UPDATE_SUMMARY.md`: 端口更新摘要

## 9. 许可证

Apache License 2.0

---

**项目改进**:
- FreeChat 代码完善：详见 `04-freechat-improvements.md`
- 完整方案书：`FREECHAT_IMPROVEMENT_PLAN.md`

**其他分析文档**: 
- 详细后端架构 (02-backend-architecture.md)
- 详细前端架构 (03-frontend-architecture.md)
- FreeChat 改进记录 (04-freechat-improvements.md) ⭐ NEW
