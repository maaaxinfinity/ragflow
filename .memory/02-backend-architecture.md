# RAGFlow 后端架构详细分析

> 基于代码库分析
> 主要目录: api/, rag/, agent/, deepdoc/, graphrag/

## 1. 后端服务层级结构

### 1.1 目录结构详解

```
api/                                    # Flask HTTP API 层
├── apps/                               # REST API 端点 (Flask Blueprints)
│   ├── __init__.py
│   ├── dialog_app.py                   # 对话/聊天 API
│   ├── conversation_app.py             # 会话管理 API
│   ├── document_app.py                 # 文档上传/管理 API
│   ├── file_app.py                     # 文件操作 API
│   ├── file_folder_app.py              # 文件夹管理 API
│   ├── file2document_app.py            # 文件到文档转换 API
│   ├── kb_app.py                       # 知识库 API
│   ├── chunk_app.py                    # 文档块 API
│   ├── llm_app.py                      # LLM 配置 API
│   ├── user_app.py                     # 用户管理 API
│   ├── tenant_app.py                   # 租户管理 API
│   ├── system_app.py                   # 系统配置 API
│   ├── canvas_app.py                   # Agent Canvas API
│   ├── dataflow_app.py                 # 数据流 API
│   ├── search_app.py                   # 搜索 API
│   ├── plugin_app.py                   # 插件 API
│   ├── mcp_server_app.py               # MCP 服务器 API
│   ├── langfuse_app.py                 # Langfuse (LLM 可观测性) API
│   ├── free_chat_app.py                # FreeChat API
│   ├── api_app.py                      # API Key 管理
│   ├── auth/                           # 认证模块
│   │   ├── oidc.py                     # OpenID Connect
│   │   ├── oauth.py                    # OAuth
│   │   └── github.py                   # GitHub OAuth
│   └── sdk/                            # SDK 端点
│       ├── session.py, chat.py
│       ├── dataset.py, doc.py, files.py
│       ├── agent.py
│       └── dify_retrieval.py
│
├── db/                                 # 数据库层
│   ├── db_models.py                    # ORM 模型定义 (Peewee)
│   ├── db_utils.py                     # 数据库工具
│   ├── init_data.py                    # 初始数据
│   ├── runtime_config.py               # 运行时配置
│   ├── reload_config_base.py           # 配置重载基类
│   ├── services/                       # 业务逻辑服务层
│   │   ├── __init__.py
│   │   ├── user_service.py             # 用户服务
│   │   ├── dialog_service.py           # 对话服务
│   │   ├── conversation_service.py     # 会话服务
│   │   ├── document_service.py         # 文档服务
│   │   ├── file_service.py             # 文件服务
│   │   ├── file2document_service.py    # 文件转换服务
│   │   ├── knowledgebase_service.py    # 知识库服务
│   │   ├── task_service.py             # 任务服务
│   │   ├── llm_service.py              # LLM 服务
│   │   ├── canvas_service.py           # Canvas 服务
│   │   ├── search_service.py           # 搜索服务
│   │   ├── mcp_server_service.py       # MCP 服务
│   │   ├── langfuse_service.py         # Langfuse 服务
│   │   ├── free_chat_user_settings_service.py
│   │   ├── tenant_llm_service.py       # 租户 LLM 配置
│   │   ├── api_service.py              # API Key 服务
│   │   ├── user_canvas_version.py      # Canvas 版本控制
│   │   └── common_service.py           # 公共服务
│   └── joint_services/                 # 联合服务
│       └── user_account_service.py     # 用户账户服务
│
├── utils/                              # 工具函数
│   ├── __init__.py
│   ├── api_utils.py                    # API 工具
│   ├── auth_decorator.py               # 认证装饰器
│   ├── base64_image.py                 # Base64 图片处理
│   ├── commands.py                     # 命令工具
│   ├── common.py                       # 通用工具
│   ├── configs.py                      # 配置工具
│   ├── crypt.py                        # 加密工具
│   ├── file_utils.py                   # 文件工具
│   ├── health_utils.py                 # 健康检查
│   ├── json.py                         # JSON 工具
│   ├── log_utils.py                    # 日志工具
│   ├── validation_utils.py             # 验证工具
│   └── web_utils.py                    # Web 工具
│
├── common/                             # 公共模块
│   ├── base64.py                       # Base64 编解码
│   ├── check_team_permission.py        # 团队权限检查
│   └── exceptions.py                   # 自定义异常
│
├── ragflow_server.py                   # Flask 应用主入口
├── settings.py                         # API 配置
├── constants.py                        # 常量定义
├── validation.py                       # 验证模块
└── versions.py                         # 版本信息

rag/                                    # 核心 RAG 引擎
├── app/                                # 文档解析器
│   ├── __init__.py
│   ├── naive.py                        # 通用解析器 (默认)
│   ├── book.py                         # 书籍解析器
│   ├── laws.py                         # 法律文档解析器
│   ├── paper.py                        # 学术论文解析器
│   ├── presentation.py                 # 演示文稿解析器
│   ├── manual.py                       # 手册解析器
│   ├── qa.py                           # 问答对解析器
│   ├── table.py                        # 表格解析器
│   ├── resume.py                       # 简历解析器
│   ├── picture.py                      # 图片解析器
│   ├── one.py                          # One 格式解析器
│   ├── audio.py                        # 音频解析器
│   ├── email.py                        # 邮件解析器
│   └── tag.py                          # 标签解析器
│
├── llm/                                # LLM 集成层
│   ├── __init__.py
│   ├── chat_model.py                   # 聊天模型集成 (30+ 提供商)
│   ├── embedding_model.py              # 嵌入模型集成
│   ├── rerank_model.py                 # 重排序模型集成
│   ├── cv_model.py                     # 计算机视觉模型
│   ├── tts_model.py                    # TTS (文本转语音) 模型
│   └── sequence2txt_model.py           # 序列到文本模型
│
├── nlp/                                # NLP 工具
│   ├── __init__.py
│   ├── rag_tokenizer.py                # RAG 分词器
│   ├── search.py                       # 搜索工具
│   ├── query.py                        # 查询处理
│   ├── term_weight.py                  # 词权重
│   ├── synonym.py                      # 同义词
│   └── surname.py                      # 姓氏处理
│
├── flow/                               # 工作流引擎
│   ├── __init__.py
│   ├── base.py                         # 基础类
│   ├── pipeline.py                     # 流水线
│   ├── file.py                         # 文件处理
│   ├── parser/                         # 解析器组件
│   │   ├── parser.py
│   │   └── schema.py
│   ├── chunker/                        # 分块器组件
│   │   ├── chunker.py
│   │   └── schema.py
│   └── tokenizer/                      # 分词器组件
│       ├── tokenizer.py
│       └── schema.py
│
├── svr/                                # 后台服务
│   ├── task_executor.py                # 异步文档处理 worker
│   ├── jina_server.py                  # Jina 服务
│   ├── discord_svr.py                  # Discord 集成
│   └── cache_file_svr.py               # 文件缓存服务
│
├── utils/                              # RAG 工具
│   ├── __init__.py
│   ├── es_conn.py                      # Elasticsearch 连接
│   ├── infinity_conn.py                # Infinity 连接
│   ├── opensearch_conn.py              # OpenSearch 连接
│   ├── doc_store_conn.py               # 文档存储抽象
│   ├── redis_conn.py                   # Redis 连接
│   ├── minio_conn.py                   # MinIO 连接
│   ├── s3_conn.py                      # AWS S3 连接
│   ├── oss_conn.py                     # 阿里云 OSS 连接
│   ├── azure_sas_conn.py               # Azure SAS 连接
│   ├── azure_spn_conn.py               # Azure SPN 连接
│   ├── opendal_conn.py                 # OpenDAL 连接
│   ├── storage_factory.py              # 存储工厂
│   ├── tavily_conn.py                  # Tavily 搜索连接
│   └── mcp_tool_call_conn.py           # MCP 工具调用
│
├── prompts/                            # Prompt 模板
│   ├── __init__.py
│   ├── template.py                     # 模板定义
│   └── generator.py                    # 生成器
│
├── benchmark.py                        # 基准测试
├── raptor.py                           # RAPTOR 实现
├── settings.py                         # RAG 配置
└── __init__.py

agent/                                  # Agent 系统
├── canvas.py                           # Agent 图执行引擎 (21183 行)
├── settings.py                         # Agent 配置
├── component/                          # Agent 组件库
│   ├── __init__.py
│   ├── base.py                         # 组件基类
│   ├── begin.py                        # 开始节点
│   ├── llm.py                          # LLM 组件
│   ├── agent_with_tools.py             # 工具 Agent
│   ├── categorize.py                   # 分类组件
│   ├── switch.py                       # 开关组件
│   ├── message.py                      # 消息组件
│   ├── string_transform.py             # 字符串转换
│   ├── fillup.py                       # 填充组件
│   ├── iteration.py                    # 迭代组件
│   ├── iterationitem.py                # 迭代项组件
│   └── invoke.py                       # 调用组件
│
├── tools/                              # Agent 工具集成
│   ├── __init__.py
│   ├── base.py                         # 工具基类
│   ├── retrieval.py                    # 检索工具
│   ├── crawler.py                      # 网页爬虫
│   ├── arxiv.py                        # arXiv 搜索
│   ├── google.py                       # Google 搜索
│   ├── googlescholar.py                # Google Scholar
│   ├── duckduckgo.py                   # DuckDuckGo 搜索
│   ├── pubmed.py                       # PubMed 搜索
│   ├── wikipedia.py                    # Wikipedia 搜索
│   ├── github.py                       # GitHub 集成
│   ├── tavily.py                       # Tavily 搜索
│   ├── searxng.py                      # SearXNG 搜索
│   ├── jin10.py                        # 金十数据
│   ├── qweather.py                     # 和风天气
│   ├── wencai.py                       # 问财
│   ├── akshare.py                      # AKShare
│   ├── tushare.py                      # Tushare
│   ├── yahoofinance.py                 # Yahoo Finance
│   ├── deepl.py                        # DeepL 翻译
│   ├── email.py                        # 邮件发送
│   ├── exesql.py                       # SQL 执行
│   └── code_exec.py                    # 代码执行
│
├── templates/                          # Agent 模板
└── test/                               # 测试
    └── client.py

deepdoc/                                # 深度文档理解
├── parser/                             # 深度解析器
│   ├── pdf_parser.py                   # PDF 解析
│   ├── docx_parser.py                  # DOCX 解析
│   ├── excel_parser.py                 # Excel 解析
│   ├── pptx_parser.py                  # PPTX 解析
│   └── ...
└── vision/                             # 视觉模型
    ├── layout_analyzer.py              # 布局分析
    └── ...

graphrag/                               # 知识图谱 RAG
├── entity_extraction.py                # 实体提取
├── relation_extraction.py              # 关系提取
├── graph_builder.py                    # 图构建
└── ...

mcp/                                    # Model Context Protocol
└── server/                             # MCP 服务器实现
    └── ...
```

## 2. Flask 应用架构

### 2.1 主入口 (api/ragflow_server.py)

```python
# 核心初始化流程:
1. 创建 Flask app
2. 配置 CORS
3. 注册所有 Blueprint (apps/)
4. 设置 Flask-Login (用户认证)
5. 初始化数据库连接
6. 设置错误处理
7. 配置 Swagger/Flasgger (API 文档)
8. 启动应用
```

### 2.2 Blueprint 组织

每个 `*_app.py` 是一个 Flask Blueprint，包含:
- 路由定义 (`@manager.route(...)`)
- 请求处理逻辑
- 调用 `db/services/` 中的业务逻辑
- 返回 JSON 响应

**示例**: `dialog_app.py` (对话 API)
- `POST /api/v1/dialog/create` - 创建对话
- `GET /api/v1/dialog/list` - 列出对话
- `POST /api/v1/dialog/chat` - 发送消息
- `DELETE /api/v1/dialog/delete` - 删除对话

## 3. 数据库层架构

### 3.1 ORM 框架: Peewee

- 轻量级 ORM，支持 MySQL 和 PostgreSQL
- 连接池: `PooledMySQLDatabase` / `PooledPostgresqlDatabase`

### 3.2 核心模型 (api/db/db_models.py)

**主要表结构**:
- `User`: 用户表
- `Tenant`: 租户表
- `Knowledgebase`: 知识库表
- `Document`: 文档表
- `File`: 文件表
- `FileFolder`: 文件夹表
- `File2Document`: 文件到文档映射
- `Dialog`: 对话表
- `Conversation`: 会话表
- `Message`: 消息表
- `LLMFactory`: LLM 提供商表
- `TenantLLM`: 租户 LLM 配置
- `Canvas`: Agent Canvas 表
- `CanvasTemplate`: Canvas 模板表
- `Task`: 任务表
- `Search`: 搜索表
- `Plugin`: 插件表
- `MCPServer`: MCP 服务器表
- `LangfuseProject`: Langfuse 项目表
- `API`: API Key 表

**自定义字段类型**:
- `LongTextField`: 长文本 (LONGTEXT for MySQL, TEXT for PostgreSQL)
- `JSONField`: JSON 字段 (自动序列化/反序列化)
- `ListField`: 列表字段
- `SerializedField`: 序列化字段 (支持 Pickle 和 JSON)

**枚举类型**:
- `ParserType`: 解析器类型 (naive, qa, manual, table, paper, book, laws, presentation, resume, picture, one, audio, email, tag)
- `LLMType`: LLM 类型 (对应 llm_factories.json 中的提供商)
- `FileType`: 文件类型 (folder, 各种文档格式)
- `TaskStatus`: 任务状态 (UNSTART, RUNNING, CANCEL, DONE, FAIL)

### 3.3 服务层 (api/db/services/)

服务层封装业务逻辑，提供:
- CRUD 操作
- 复杂查询
- 事务处理
- 业务规则验证

**示例**: `DocumentService`
- `get_by_id()` - 获取文档
- `insert()` - 插入文档
- `update()` - 更新文档
- `delete()` - 删除文档
- `add_chunk()` - 添加文档块
- `get_chunk()` - 获取文档块
- `run_parsing()` - 运行解析任务
- `cancel_parsing()` - 取消解析

## 4. RAG 引擎架构

### 4.1 文档处理流程

```
1. 上传文件 (api/apps/file_app.py)
   ↓
2. 存储到 MinIO/S3 (rag/utils/storage_factory.py)
   ↓
3. 创建文档记录 (api/db/services/document_service.py)
   ↓
4. 推送解析任务到 Redis 队列
   ↓
5. Task Executor 读取任务 (rag/svr/task_executor.py)
   ↓
6. 根据文档类型选择解析器 (rag/app/*.py)
   ↓
7. 深度文档解析 (deepdoc/parser/)
   ↓
8. 文档分块 (rag/flow/chunker/)
   ↓
9. 生成嵌入向量 (rag/llm/embedding_model.py)
   ↓
10. 索引到 Elasticsearch/Infinity (rag/utils/*_conn.py)
   ↓
11. 更新文档状态为 DONE
```

### 4.2 文档解析器 (rag/app/)

每个解析器继承自基类，实现特定文档类型的解析逻辑:

- `naive.py`: 默认解析器,通用文本提取
- `book.py`: 书籍解析,章节识别
- `laws.py`: 法律文档,条款结构化
- `paper.py`: 学术论文,章节/参考文献识别
- `presentation.py`: PPT,幻灯片分页
- `manual.py`: 手册,目录识别
- `qa.py`: 问答对提取
- `table.py`: 表格解析
- `resume.py`: 简历解析,字段提取
- `picture.py`: 图片 OCR
- `one.py`: OneNote 格式
- `audio.py`: 音频转录 (STT)
- `email.py`: 邮件解析

### 4.3 LLM 集成 (rag/llm/chat_model.py)

**LLMBundle 类**: 统一的 LLM 调用接口

支持的提供商 (部分列表):
1. OpenAI (gpt-4, gpt-5, o3, o4-mini 等)
2. Azure OpenAI
3. Anthropic (Claude)
4. DeepSeek
5. Moonshot (月之暗面)
6. Tongyi-Qianwen (阿里通义千问)
7. ZHIPU-AI (智谱 AI)
8. Baidu Qianfan (百度千帆)
9. VolcEngine (火山引擎/豆包)
10. Minimax
11. Groq
12. Cohere
13. Ollama
14. LocalAI
15. Google Gemini
16. Vertex AI
17. Mistral AI
18. Replicate
19. Voyage AI
20. AWS Bedrock
21. ...

**核心方法**:
- `chat()`: 聊天补全
- `chat_stream()`: 流式聊天
- `encode()`: 生成嵌入向量
- `rerank()`: 重排序

### 4.4 向量存储抽象 (rag/utils/doc_store_conn.py)

提供统一的文档存储接口,支持:
- Elasticsearch (`es_conn.py`)
- Infinity (`infinity_conn.py`)
- OpenSearch (`opensearch_conn.py`)

**核心操作**:
- `insert()`: 插入文档块
- `search()`: 向量搜索
- `hybrid_search()`: 混合搜索 (向量 + 全文)
- `delete()`: 删除文档
- `update()`: 更新文档

### 4.5 对象存储抽象 (rag/utils/storage_factory.py)

支持多种对象存储:
- MinIO (`minio_conn.py`)
- AWS S3 (`s3_conn.py`)
- 阿里云 OSS (`oss_conn.py`)
- Azure Blob Storage (`azure_sas_conn.py`, `azure_spn_conn.py`)
- OpenDAL 统一接口 (`opendal_conn.py`)

**核心操作**:
- `put()`: 上传文件
- `get()`: 下载文件
- `rm()`: 删除文件
- `obj_exist()`: 检查文件是否存在

## 5. Agent 系统架构

### 5.1 Canvas 执行引擎 (agent/canvas.py)

核心类: `Canvas`

**功能**:
- 基于 DAG (有向无环图) 的工作流执行
- 支持节点类型: Begin, LLM, Retrieval, Tool, Logic, Message 等
- 支持控制流: Switch, Categorize, Iteration
- 支持嵌套调用: Invoke (调用其他 Canvas)

**执行流程**:
1. 解析 DSL (JSON 格式的 Canvas 定义)
2. 构建执行图
3. 从 Begin 节点开始执行
4. 按照边的连接顺序执行节点
5. 处理分支和循环
6. 返回最终结果

### 5.2 Agent 组件 (agent/component/)

**基类**: `ComponentBase` (component/base.py)

**组件类型**:
- `Begin`: 输入节点,定义变量
- `LLM`: 调用 LLM 生成文本
- `AgentWithTools`: 带工具的 Agent (支持工具调用)
- `Categorize`: 分类节点 (多路分支)
- `Switch`: 开关节点 (条件分支)
- `Message`: 消息节点 (用户交互)
- `StringTransform`: 字符串转换
- `Fillup`: 填充节点 (用户输入)
- `Iteration`: 迭代节点 (循环)
- `Invoke`: 调用其他 Canvas

每个组件实现:
- `_run()`: 同步执行方法
- `_stream()`: 流式执行方法 (可选)

### 5.3 Agent 工具 (agent/tools/)

**工具类型**:
- **搜索工具**: Google, DuckDuckGo, Tavily, SearXNG, Wikipedia, arXiv, PubMed, Google Scholar, GitHub
- **金融工具**: Yahoo Finance, AKShare, Tushare, 问财, 金十数据
- **天气工具**: 和风天气
- **翻译工具**: DeepL
- **其他工具**: 网页爬虫, 邮件发送, SQL 执行, 代码执行, 文档检索

**工具接口**:
- `__init__()`: 初始化 (API Key 等)
- `call()`: 执行工具调用
- `description`: 工具描述 (给 LLM 用)

## 6. 任务执行器 (rag/svr/task_executor.py)

### 6.1 功能

- 从 Redis 队列读取文档处理任务
- 调用相应的解析器处理文档
- 生成嵌入向量
- 索引到向量数据库
- 更新任务状态

### 6.2 扩展性

- 支持多进程并行 (通过 `WS` 环境变量设置 worker 数量)
- 每个 worker 独立处理任务
- Redis 作为任务队列保证任务不重复

## 7. 认证与授权

### 7.1 用户认证

- Flask-Login: Session 管理
- 密码加密: BCrypt (通过 `api/utils/crypt.py`)
- Token: JWT (用于 API 访问)

### 7.2 OAuth 支持

- GitHub OAuth (`api/apps/auth/github.py`)
- Generic OAuth (`api/apps/auth/oauth.py`)
- OpenID Connect (`api/apps/auth/oidc.py`)

### 7.3 权限管理

- 基于租户 (Tenant) 的多租户架构
- 角色: Owner, Admin, Member
- 权限检查: `api/common/check_team_permission.py`

## 8. API 文档

### 8.1 Swagger/Flasgger

- 自动生成 API 文档
- 访问路径: `/api/docs` (需配置)

### 8.2 SDK 端点 (api/apps/sdk/)

提供简化的 SDK 接口:
- Session 管理
- 聊天接口
- 数据集操作
- 文档操作
- Agent 调用
- Dify 兼容接口

## 9. 可观测性

### 9.1 日志

- 配置: `api/utils/log_utils.py`
- 日志级别: 通过 `LOG_LEVELS` 环境变量控制

### 9.2 Langfuse 集成

- LLM 调用追踪
- 成本统计
- 性能分析
- 接口: `api/apps/langfuse_app.py`

## 10. MCP (Model Context Protocol)

### 10.1 功能

- 工具和资源的标准化协议
- 支持自定义 MCP 服务器
- 集成到 Agent 系统

### 10.2 接口

- `api/apps/mcp_server_app.py`: MCP 服务器管理 API
- `rag/utils/mcp_tool_call_conn.py`: MCP 工具调用

## 11. 性能优化

### 11.1 批处理

- `DOC_BULK_SIZE`: 文档批处理大小
- `EMBEDDING_BATCH_SIZE`: 嵌入批处理大小

### 11.2 缓存

- Redis: 用于缓存频繁访问的数据
- `rag/svr/cache_file_svr.py`: 文件缓存服务

### 11.3 连接池

- 数据库连接池 (Peewee)
- Redis 连接池

## 12. 错误处理

### 12.1 自定义异常 (api/common/exceptions.py)

- 定义业务异常类型
- 统一错误响应格式

### 12.2 错误日志

- 详细的错误堆栈记录
- 便于调试和故障排查

### 12.3 FreeChat 错误处理优化

**自定义异常体系** (api/exceptions/free_chat_exceptions.py):
- `FreeChatError`: 基础异常类
- `SettingsNotFoundError`: 404错误
- `UnauthorizedAccessError`: 403权限错误
- `InvalidSettingsError`: 400参数错误
- `DatabaseError`, `CacheError`, `LockTimeoutError`: 服务器错误

**分布式锁** (api/utils/redis_lock.py):
- `RedisLock`: Redis分布式锁实现
- `redis_lock`: 上下文管理器
- 用途：防止并发更新导致数据不一致

---

**下一文档**: 03-frontend-architecture.md (前端架构详细分析)
