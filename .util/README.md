# RAGFlow 知识库批量管理工具

## 功能概述

提供三个Python脚本用于批量管理RAGFlow知识库的文档解析状态：

1. **`resolve.py`** - 批量触发解析（切片）
2. **`cancel_parse.py`** - 批量取消解析（删除chunks）
3. **`cleanup_tasks.py`** - 清理MySQL中的遗留task记录

## 环境准备

### 1. 安装依赖

```bash
pip install requests tqdm python-dotenv
```

### 2. 配置环境变量

在 `.util` 目录下创建 `.env` 文件：

```env
RAGFLOW_BASE_URL=http://localhost:9380
RAGFLOW_API_KEY=your_api_key_here
CONCURRENCY=8
PARSE_BATCH_SIZE=50
CANCEL_BATCH_SIZE=50
KB_NAME_PREFIX=
KB_NAME_SUFFIX=
```

## resolve.py - 批量解析工具

### 功能说明

批量触发指定知识库中文档的解析（切片）任务。

### 基本用法

```bash
# 方式1: 使用.env配置
python resolve.py

# 方式2: 命令行传入配置
python resolve.py http://localhost:9380 your_api_key

# 方式3: 指定知识库名称
python resolve.py --names "法律法规测试,技术文档库"

# 方式4: 按关键词过滤
python resolve.py --only 法律 --only 测试

# 方式5: 解析所有知识库
python resolve.py --all

# 方式6: 从manifest文件读取
python resolve.py --from-manifest kb_manifest.json
```

### 参数说明

| 参数 | 说明 | 示例 |
|-----|------|------|
| `base_url` | API地址（可选，覆盖.env） | `http://localhost:9380` |
| `api_key` | API密钥（可选，覆盖.env） | `ragflow-xxx` |
| `--names` | 精确指定知识库名称（逗号分隔） | `--names "库1,库2,库3"` |
| `--only` | 包含关键词的知识库（可多次） | `--only 法律 --only 测试` |
| `--from-manifest` | 从JSON文件读取知识库列表 | `--from-manifest list.json` |
| `--all` | 处理所有知识库 | `--all` |
| `--force` | 强制解析所有文档（忽略chunk_count） | `--force` |
| `--dry-run` | 仅显示计划，不执行 | `--dry-run` |
| `--batch` | 单批处理文档数 | `--batch 100` |

### 解析策略

- **默认行为**：仅解析 `chunk_count == 0` 的文档（未解析过的）
- **`--force`**：强制重新解析所有文档

### 使用示例

```bash
# 1. 测试运行（不实际执行）
python resolve.py --only 测试 --dry-run

# 2. 解析特定知识库
python resolve.py --names "法律法规测试"

# 3. 解析所有包含"法律"的知识库
python resolve.py --only 法律

# 4. 强制重新解析所有文档
python resolve.py --names "法律法规测试" --force

# 5. 使用更大的批次提高效率
python resolve.py --all --batch 200
```

## cancel_parse.py - 批量取消解析工具

### 功能说明

批量删除指定知识库中文档的chunks（取消解析状态），并清理MySQL中的task记录。

**注意：** 需要使用最新版本的RAGFlow API，该版本已修复task清理bug（自动删除MySQL中的task记录）。

### 基本用法

```bash
# 方式1: 指定知识库名称
python cancel_parse.py --names "法律法规测试"

# 方式2: 按关键词过滤
python cancel_parse.py --only 测试

# 方式3: 反选（排除）
python cancel_parse.py --all --exclude 重要 --exclude 生产

# 方式4: 仅取消已解析的文档
python cancel_parse.py --names "法律法规测试" --parsed-only

# 方式5: 从manifest文件读取
python cancel_parse.py --from-manifest kb_manifest.json
```

### 参数说明

| 参数 | 说明 | 示例 |
|-----|------|------|
| `base_url` | API地址（可选，覆盖.env） | `http://localhost:9380` |
| `api_key` | API密钥（可选，覆盖.env） | `ragflow-xxx` |
| `--names` | 精确指定知识库名称（逗号分隔） | `--names "库1,库2"` |
| `--only` | 包含关键词的知识库（可多次） | `--only 测试` |
| `--exclude` | 排除关键词的知识库（反选，可多次） | `--exclude 重要 --exclude 生产` |
| `--from-manifest` | 从JSON文件读取知识库列表 | `--from-manifest list.json` |
| `--all` | 处理所有知识库 | `--all` |
| `--parsed-only` | 仅取消已解析的文档（chunk_count > 0） | `--parsed-only` |
| `--dry-run` | 仅显示计划，不执行 | `--dry-run` |
| `--batch` | 单批处理文档数 | `--batch 100` |

### 取消策略

- **默认行为**：取消所有文档的解析（删除所有chunks）
- **`--parsed-only`**：仅取消已解析的文档（`chunk_count > 0`）

### 使用示例

```bash
# 1. 测试运行（查看将要取消的数量）
python cancel_parse.py --only 测试 --dry-run

# 2. 取消特定知识库的解析
python cancel_parse.py --names "法律法规测试"

# 3. 取消所有测试库，但保留生产库
python cancel_parse.py --all --exclude 生产

# 4. 仅清理已解析的文档
python cancel_parse.py --names "法律法规测试" --parsed-only

# 5. 反选：处理除了"重要"和"生产"之外的所有库
python cancel_parse.py --all --exclude 重要 --exclude 生产
```

## 高级用法

### 1. 前缀/后缀过滤

在 `.env` 中配置：

```env
KB_NAME_PREFIX=test_
KB_NAME_SUFFIX=_dev
```

这样只会处理名称以 `test_` 开头且以 `_dev` 结尾的知识库。

### 2. 组合过滤

```bash
# 处理包含"法律"但不包含"测试"的知识库
python resolve.py --only 法律 --exclude 测试

# 处理所有知识库，但排除重要的
python cancel_parse.py --all --exclude 重要 --exclude 生产 --exclude 正式
```

### 3. Manifest文件格式

`kb_manifest.json` 示例：

```json
{
  "datasets": [
    {"dataset_name": "法律法规测试"},
    {"dataset_name": "技术文档库"},
    {"dataset_name": "产品说明书"}
  ]
}
```

### 4. 批量操作流程

```bash
# 步骤1: 查看待处理的知识库
python resolve.py --only 测试 --dry-run

# 步骤2: 执行解析
python resolve.py --only 测试

# 步骤3: 如果需要重置，取消解析
python cancel_parse.py --only 测试

# 步骤4: 重新解析
python resolve.py --only 测试 --force
```

## 注意事项

1. **权限要求**：需要有效的RAGFlow API密钥和相应知识库的操作权限
2. **并发控制**：通过 `.env` 中的 `CONCURRENCY` 控制并发数，避免服务器压力过大
3. **批次大小**：`PARSE_BATCH_SIZE` 和 `CANCEL_BATCH_SIZE` 控制单次请求的文档数量
4. **Dry-run模式**：执行重要操作前建议先用 `--dry-run` 预览
5. **反选功能**：`--exclude` 参数仅在 `cancel_parse.py` 中可用，用于安全排除重要知识库
6. **API兼容性**：脚本基于RAGFlow API v1，确保API版本兼容

## 常见问题

### Q: 如何只解析新上传的文档？
A: 默认行为就是只解析 `chunk_count == 0` 的文档。如果要重新解析，使用 `--force`。

### Q: 如何批量重置某类知识库？
A:
```bash
python cancel_parse.py --only 测试
python resolve.py --only 测试 --force
```

### Q: 如何避免误操作重要知识库？
A:
1. 使用 `--dry-run` 预览
2. 使用 `--exclude` 排除重要库
3. 使用 `--names` 精确指定

### Q: 并发太高导致服务器压力大？
A: 调整 `.env` 中的 `CONCURRENCY` 值（建议4-8）

## cleanup_tasks.py - 数据库清理工具

### 功能说明

清理MySQL数据库中的遗留task记录。当取消解析后，某些旧版本可能未正确清理task表，导致数据残留。

**危险操作：请谨慎使用，建议先备份数据库！**

### 基本用法

**注意：使用Docker模式时需要sudo权限**

```bash
# 1. 列出所有孤立的task（文档已删除或已取消）
sudo python cleanup_tasks.py --list-orphaned

# 2. 统计各知识库的task数量
sudo python cleanup_tasks.py --list-by-dataset

# 3. 清理孤立的task（预览）
sudo python cleanup_tasks.py --clean-orphaned --dry-run

# 4. 清理孤立的task（实际执行）
sudo python cleanup_tasks.py --clean-orphaned

# 5. 清理已取消文档的task
sudo python cleanup_tasks.py --clean-canceled

# 6. 清理指定知识库的所有task
sudo python cleanup_tasks.py --clean-dataset <dataset_id>

# 7. 不使用Docker直接连接MySQL（无需sudo）
python cleanup_tasks.py --list-orphaned --no-docker
```

### 参数说明

| 参数 | 说明 |
|-----|------|
| `--list-orphaned` | 列出所有孤立的task记录 |
| `--list-by-dataset` | 按知识库统计task数量 |
| `--clean-orphaned` | 清理孤立的task记录 |
| `--clean-canceled` | 清理已取消文档的task |
| `--clean-dataset <id>` | 清理指定知识库的task |
| `--dry-run` | 预览模式，不实际删除 |
| `--no-docker` | 不使用Docker，直接连接MySQL |

### 环境变量配置

在 `.env` 中添加：

```env
MYSQL_HOST=localhost
MYSQL_PORT=3306
MYSQL_USER=root
MYSQL_PASSWORD=infini_rag_flow
MYSQL_DATABASE=rag_flow
DOCKER_CONTAINER=ragflow-mysql
```

### 使用场景

1. **定期维护**
   ```bash
   # 每周清理一次孤立task
   python cleanup_tasks.py --clean-orphaned
   ```

2. **故障恢复**
   ```bash
   # 系统异常后清理残留task
   python cleanup_tasks.py --list-orphaned
   python cleanup_tasks.py --clean-orphaned
   ```

3. **知识库重置**
   ```bash
   # 完全重置某个知识库
   python cleanup_tasks.py --clean-dataset <dataset_id>
   python cancel_parse.py --names "知识库名称"
   python resolve.py --names "知识库名称" --force
   ```

## 完整工作流程

### 场景1: 重置知识库并清理task

```bash
# 步骤1: 查看当前状态
python cleanup_tasks.py --list-by-dataset

# 步骤2: 取消解析
python cancel_parse.py --names "法律法规测试"

# 步骤3: 清理遗留task（如果有）
python cleanup_tasks.py --clean-orphaned

# 步骤4: 重新解析
python resolve.py --names "法律法规测试" --force
```

### 场景2: 批量清理测试环境

```bash
# 步骤1: 预览将要清理的task
python cleanup_tasks.py --list-orphaned --dry-run

# 步骤2: 清理已取消的文档task
python cleanup_tasks.py --clean-canceled

# 步骤3: 取消所有测试库的解析
python cancel_parse.py --only 测试

# 步骤4: 清理剩余孤立task
python cleanup_tasks.py --clean-orphaned
```

## 更新日志

- **v1.2** - 新增 `cleanup_tasks.py` 数据库清理工具
  - 支持清理孤立的task记录
  - 支持按知识库统计和清理
  - 修复 `stop_parsing` API未清理task的bug
- **v1.1** - 新增 `cancel_parse.py` 取消解析功能
  - 支持 `--exclude` 反选参数
  - 支持 `--parsed-only` 仅处理已解析文档
- **v1.0** - 初始版本 `resolve.py`
  - 支持多种知识库选择方式
  - 支持批量并发处理
