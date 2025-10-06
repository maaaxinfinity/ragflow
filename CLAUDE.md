# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

RAGFlow is an open-source Retrieval-Augmented Generation (RAG) engine that combines deep document understanding with LLM capabilities. The system consists of:
- Python backend (Flask API + async task executors)
- React frontend (UmiJS framework with TypeScript)
- Microservices architecture with Docker deployment

## Development Setup

### Backend Development (Python 3.10-3.12)

```bash
# Install dependencies
pipx install uv pre-commit
uv sync --python 3.10 --all-extras
uv run download_deps.py
pre-commit install

# Start dependent services (Elasticsearch/Infinity, MySQL, MinIO, Redis)
docker compose -f docker/docker-compose-base.yml up -d

# Add to /etc/hosts
127.0.0.1 es01 infinity mysql minio redis sandbox-executor-manager

# Activate environment and launch backend
source .venv/bin/activate
export PYTHONPATH=$(pwd)
bash docker/launch_backend_service.sh
```

The backend runs on port 9380 (default). Backend consists of:
- **ragflow_server** (`api/ragflow_server.py`): Flask HTTP API server
- **task_executor** (`rag/svr/task_executor.py`): Async document processing workers

Stop backend: `pkill -f "ragflow_server.py|task_executor.py"`

### Frontend Development (Node.js >=18.20.4)

```bash
cd web
npm install
npm run dev  # Development server with hot reload
```

Frontend runs on port 8000 (default). Production build: `npm run build`

### Testing

```bash
# Backend: pytest with markers
pytest test/               # All tests
pytest -m p1              # High priority tests only
pytest -m "p1 or p2"      # High and medium priority

# Frontend: Jest
cd web
npm test                  # Run tests with coverage
```

### Code Quality

```bash
# Linting (auto-run via pre-commit)
cd web && npm run lint    # Frontend ESLint
ruff check --fix .        # Backend linting with auto-fix
ruff format .             # Backend formatting
```

Pre-commit hooks enforce code quality standards (configured in `.pre-commit-config.yaml`).

## Architecture

### Backend Structure

```
api/                      # HTTP API layer
├── apps/                 # Flask blueprints (REST endpoints)
│   ├── dialog_app.py     # Chat/conversation endpoints
│   ├── document_app.py   # Document upload/management
│   ├── kb_app.py         # Knowledge base operations
│   └── conversation_app.py # RAG conversation handling
├── db/                   # Database layer (Peewee ORM)
│   ├── db_models.py      # Table definitions
│   └── services/         # Business logic services
├── settings.py           # API configuration
└── ragflow_server.py     # Main Flask application entry

rag/                      # Core RAG engine
├── app/                  # Document parsers (by type)
│   ├── laws.py, paper.py, resume.py, etc.
│   └── naive.py          # Default parser
├── llm/                  # LLM integrations
│   ├── chat_model.py     # 30+ LLM providers (OpenAI, DeepSeek, etc.)
│   ├── embedding_model.py # Embedding model integrations
│   └── rerank_model.py   # Reranking model integrations
├── nlp/                  # NLP utilities (tokenization, search)
├── flow/                 # Workflow engine for agents
└── svr/
    └── task_executor.py  # Async document processing worker

agent/                    # Agentic workflow system
├── canvas.py             # Agent canvas/graph execution
├── component/            # Agent components (tools, etc.)
└── templates/            # Pre-built agent templates

deepdoc/                  # Document understanding
├── parser/               # Deep document parsers (PDF, DOCX, etc.)
└── vision/               # Vision models for layout analysis

graphrag/                 # Knowledge graph RAG implementation
```

### Frontend Structure

```
web/src/
├── pages/                # Route-based pages (UmiJS convention)
│   ├── chat/             # Chat interface
│   ├── knowledge/        # Knowledge base management
│   └── flow/             # Agent workflow builder
├── components/           # Reusable React components
├── hooks/                # Custom React hooks
├── utils/                # Utilities and helpers
└── constants/            # Constants and configuration
```

Frontend uses UmiJS with TypeScript, Ant Design, TailwindCSS, and React Query for state management.

### Key Architectural Patterns

1. **Two-Process Model**: Separate HTTP server (`ragflow_server.py`) and task executors (`task_executor.py`) communicate via Redis queues
2. **Document Processing Pipeline**: Upload → Parse → Chunk → Embed → Index (to Elasticsearch/Infinity/OpenSearch)
3. **RAG Workflow**: Query → Retrieve chunks → Rerank → LLM generation with citations
4. **Agent Canvas**: Graph-based workflow execution with components (LLM, retrieval, tools, etc.)

### Database Layer

- **ORM**: Peewee (MySQL/PostgreSQL support via `DB_TYPE` env var)
- **Models**: `api/db/db_models.py` - defines all tables
- **Services**: `api/db/services/` - business logic layer (e.g., `DocumentService`, `DialogService`)

### Document Storage

- **Vector/Full-text**: Elasticsearch (default), Infinity, or OpenSearch (set via `DOC_ENGINE` in `docker/.env`)
- **Object Storage**: MinIO (default), AWS S3, Azure Blob, or Aliyun OSS (set via `STORAGE_IMPL` in `docker/.env`)

### LLM Integration

RAGFlow supports 30+ LLM providers through a unified interface (`rag/llm/chat_model.py`):
- OpenAI, Azure OpenAI, Anthropic, DeepSeek, Moonshot
- Chinese providers: Tongyi-Qianwen, ZHIPU-AI, Baidu Qianfan, VolcEngine
- Open-source: Ollama, LocalAI
- See `conf/llm_factories.json` for full list

Default LLM for new users: configure in `docker/service_conf.yaml.template` under `user_default_llm`.

## Configuration

### Environment Configuration

Key files:
- `docker/.env`: Infrastructure settings (ports, passwords, Docker image selection)
- `docker/service_conf.yaml.template`: Backend service config (auto-populated from env vars)
- `web/.env`: Frontend environment variables

### Document Engine Switching

To switch from Elasticsearch to Infinity:
```bash
docker compose -f docker/docker-compose.yml down -v  # WARNING: clears data
# Edit docker/.env: DOC_ENGINE=infinity
docker compose -f docker/docker-compose.yml up -d
```

### Important Environment Variables

- `DOC_ENGINE`: `elasticsearch` (default), `infinity`, or `opensearch`
- `STORAGE_IMPL`: `MINIO` (default), `AWS_S3`, `OSS`, `AZURE_SPN`
- `MAX_CONTENT_LENGTH`: Max upload size in bytes (default 2GB)
- `DOC_BULK_SIZE`: Document chunks per batch (default 4)
- `EMBEDDING_BATCH_SIZE`: Embeddings per batch (default 16)
- `HF_ENDPOINT`: HuggingFace mirror (e.g., `https://hf-mirror.com`)

## Docker Deployment

### Production Deployment

```bash
cd ragflow/docker
docker compose -f docker-compose.yml up -d  # CPU version

# GPU-accelerated (for embedding/DeepDoc):
# docker compose -f docker-compose-gpu.yml up -d
```

Access at `http://localhost:9380` (or configured `SVR_HTTP_PORT`).

### Docker Images

Two editions per version (configure `RAGFLOW_IMAGE` in `docker/.env`):
- `infiniflow/ragflow:v0.20.5-slim` (~2GB): No embedding models (external services required)
- `infiniflow/ragflow:v0.20.5` (~9GB): Includes BAAI/bge-large-zh-v1.5 and bce-embedding-base_v1

Also available: `nightly` and `nightly-slim` for latest unstable builds.

### Building Custom Images

```bash
# Slim image without models
docker build --platform linux/amd64 --build-arg LIGHTEN=1 -f Dockerfile -t infiniflow/ragflow:custom-slim .

# Full image with models
docker build --platform linux/amd64 -f Dockerfile -t infiniflow/ragflow:custom .
```

## Common Tasks

### Adding a New Document Parser

1. Create parser in `rag/app/your_parser.py` inheriting from base parser
2. Register in `rag/app/__init__.py` imports
3. Add parser type to `api/db/db_models.py` ParserType enum
4. Update frontend parser selection UI in `web/src/pages/knowledge/`

### Adding LLM Provider Support

1. Add factory config to `conf/llm_factories.json`
2. Implement provider in `rag/llm/chat_model.py` (add to `LLMBundle` class)
3. Update `api/db/db_models.py` LLMType enum
4. Test with `rag/llm` test cases

### Modifying API Endpoints

1. Edit/add routes in `api/apps/*_app.py` files
2. Update corresponding service in `api/db/services/`
3. Use Swagger docs at `/api/docs` for API testing
4. Frontend API calls are in `web/src/hooks/` and `web/src/utils/`

### Working with the Agent System

- **Canvas**: `agent/canvas.py` - graph execution engine
- **Components**: `agent/component/` - individual agent capabilities (LLM, retrieval, code execution, etc.)
- **Templates**: `agent/templates/` - pre-built agent workflows
- **MCP Support**: `mcp/server/` - Model Context Protocol server implementation

## Development Notes

### Database Migrations

Manual schema changes required - update `api/db/db_models.py` and run initialization on fresh DB. Production migrations should be handled carefully with data backup.

### Frontend Build System

- UmiJS handles routing via file-based convention (`web/src/pages/`)
- TailwindCSS for styling (config in `web/tailwind.config.js`)
- Import order auto-organized by prettier plugin

### Task Executor Scaling

Multiple task executors can run in parallel - set `WS` (worker count) in `docker/launch_backend_service.sh`. Each worker processes documents asynchronously from Redis queue.

### Debugging

- Backend: Set `RAGFLOW_DEBUGPY_LISTEN=5678` env var to enable debugpy on port 5678
- Frontend: React DevTools, browser debugger
- Use `RuntimeConfig.DEBUG = True` in `api/ragflow_server.py` for Flask debug mode

### Sandbox/Code Execution

For agent code execution, enable sandbox in `docker/.env`:
```bash
SANDBOX_ENABLED=1
COMPOSE_PROFILES=elasticsearch,sandbox  # or infinity,sandbox / opensearch,sandbox
```

Requires gVisor and pulling sandbox base images first.
