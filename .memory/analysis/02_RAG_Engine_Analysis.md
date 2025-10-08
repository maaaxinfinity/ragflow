# RAGFlow RAG引擎核心代码详细分析报告

## 1. rag/app/ - 文档解析器模块

RAGFlow实现了15种专业化的文档解析器，每种针对特定类型文档的特征进行优化处理。

### 1.1 解析器类型完整列表

| 解析器文件 | 解析器类型 | 主要功能 |
|-----------|----------|---------|
| **naive.py** | 通用解析器 | 默认解析器，支持DOCX、PDF、Excel、TXT、Markdown、HTML、JSON等主流格式 |
| **laws.py** | 法律文档 | 专门处理法律文档的层级结构，识别标题级别和章节关系 |
| **paper.py** | 学术论文 | 提取论文标题、作者、摘要，识别双栏布局，处理表格和图表 |
| **book.py** | 书籍 | 处理长篇内容，支持目录识别和层级合并，适合大量分页内容 |
| **resume.py** | 简历 | 通过远程API解析简历结构化字段（姓名、学历、工作经验等） |
| **qa.py** | 问答文档 | 支持Excel、CSV、PDF、Markdown、DOCX格式的问答对提取 |
| **table.py** | 表格数据 | 处理Excel/CSV表格，自动识别复杂表头、合并单元格、数据类型推断 |
| **email.py** | 邮件 | 解析EML格式邮件，提取邮件头、正文（纯文本/HTML）及附件 |
| **presentation.py** | 演示文稿 | 处理PPT/PPTX文件的幻灯片内容 |
| **manual.py** | 手册 | 处理技术手册类文档 |
| **picture.py** | 图片 | 处理图像文件 |
| **one.py** | OneNote | 处理OneNote格式文档 |
| **audio.py** | 音频 | 处理音频文件转录 |
| **tag.py** | 标签文档 | 用于标签化处理的特殊解析器 |

详细的每个解析器的核心逻辑请参考完整报告...

---

## 2. rag/llm/ - LLM集成模块

### 2.1 支持的提供商

RAGFlow支持30+种LLM提供商，包括：

**主流商业模型**：
- OpenAI (GPT-4, GPT-3.5等)
- Anthropic Claude
- Google Gemini
- Azure OpenAI

**中国厂商**：
- DeepSeek
- Tongyi-Qianwen (通义千问)
- ZHIPU-AI (智谱)
- Baidu Qianfan (文心一言)
- Moonshot
- VolcEngine (火山引擎)

**开源/本地部署**：
- Ollama
- LocalAI
- LM Studio
- Xinference
- VLLM

**Embedding模型**：支持30+种embedding提供商
**Rerank模型**：支持20+种rerank提供商

详细的LLM集成架构和实现请参考完整报告...

---

## 3. rag/nlp/ - NLP工具模块

### 3.1 核心模块

- **rag_tokenizer.py**: 中文分词器（HuQie算法）
- **search.py**: 全文+向量混合搜索
- **query.py**: 查询预处理和扩展

---

## 4. rag/svr/task_executor.py - 任务执行器

这是文档处理的核心引擎，采用异步并发架构。

### 4.1 完整处理流程

```
文档上传 → 任务队列 →
  ↓
build_chunks():
  ├─ 从MinIO获取文件
  ├─ 调用解析器
  ├─ 图片上传MinIO
  ├─ 关键词生成（可选）
  ├─ 问题生成（可选）
  └─ 标签生成（可选）
  ↓
embedding():
  ├─ 批量向量化
  └─ 写入Elasticsearch
  ↓
知识图谱构建（可选）
```

---

**报告生成时间**: 2025-10-08
**分析版本**: RAGFlow Main Branch
**代码路径**: `D:\workspace\ragflow`
