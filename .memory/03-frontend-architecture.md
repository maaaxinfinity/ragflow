# RAGFlow 前端架构详细分析

> 基于代码库分析
> 主要目录: web/src/

## 1. 前端技术栈

### 1.1 核心框架

- **React 18.2.0**: 现代 React 特性 (Hooks, Concurrent Mode)
- **UmiJS 4.0.90**: 企业级 React 应用框架
  - 基于文件路由
  - 内置路由、构建、部署方案
  - 插件体系
- **TypeScript 5.0.3**: 类型安全

### 1.2 UI 组件库

**主力组件库:**
- **Ant Design 5.12.7**: 企业级 UI 组件
- **@ant-design/pro-components 2.6.46**: 高级业务组件

**Radix UI** (Headless 组件):
- 完整的组件集合 (@radix-ui/react-*)
- 无样式,完全可定制
- 用于构建自定义 UI

**自定义组件**:
- 基于 Radix UI + TailwindCSS
- 存放在 `src/components/` 和 `src/pages/*/components/`

### 1.3 样式方案

- **TailwindCSS**: 原子化 CSS
- **Less**: 部分组件使用
- **CSS Modules**: 组件样式隔离
- **TailwindCSS 插件**:
  - `@tailwindcss/line-clamp`: 多行文本截断
  - `tailwindcss-animate`: 动画
  - `tailwind-scrollbar`: 自定义滚动条

### 1.4 状态管理

**服务端状态**:
- **@tanstack/react-query 5.40.0** (React Query)
  - 数据获取、缓存、同步
  - 自动重新获取
  - 乐观更新

**客户端状态**:
- **Zustand 4.5.2**: 轻量级状态管理
- **Immer 10.1.1**: 不可变数据处理

### 1.5 可视化

**图形编辑**:
- **@xyflow/react 12.3.6** (React Flow)
  - Agent Canvas 工作流编辑
  - DataFlow 可视化

**图表**:
- **@antv/g2 5.2.10**: 图表库
- **@antv/g6 5.0.10**: 图可视化
- **Recharts 2.12.4**: React 图表组件

### 1.6 表单处理

- **react-hook-form 7.56.4**: 高性能表单
- **@hookform/resolvers 3.9.1**: 验证集成
- **Zod 3.23.8**: Schema 验证

### 1.7 Markdown & 代码

- **react-markdown 9.0.1**: Markdown 渲染
- **@uiw/react-markdown-preview 5.1.3**: Markdown 预览
- **react-syntax-highlighter 15.5.0**: 代码高亮
- **@monaco-editor/react 4.6.0**: Monaco 编辑器 (VS Code 编辑器)
- **Lexical 0.23.1**: 富文本编辑器 (Meta)

### 1.8 文档预览

- **react-pdf-highlighter 6.1.0**: PDF 预览和标注
- **pptx-preview 1.0.5**: PPT 预览
- **mammoth 1.7.2**: DOCX 转 HTML
- **@js-preview/excel 1.7.14**: Excel 预览

### 1.9 国际化

- **i18next 23.7.16**: 国际化框架
- **react-i18next 14.0.0**: React 集成
- **i18next-browser-languagedetector 8.0.0**: 语言检测

### 1.10 其他工具

- **ahooks 3.7.10**: React Hooks 工具库
- **axios 1.6.3**: HTTP 客户端
- **dayjs 1.11.10**: 日期处理
- **lodash 4.17.21**: 工具函数库
- **uuid 9.0.1**: UUID 生成
- **classnames 2.5.1** / **clsx 2.1.1**: 类名拼接
- **react-error-boundary 4.0.13**: 错误边界
- **sonner 1.7.4**: Toast 通知

## 2. 目录结构详解

```
web/src/
├── .umi/                                # UmiJS 生成文件 (自动生成,不提交)
│
├── pages/                               # 页面组件 (UmiJS 文件路由)
│   ├── home/                            # 首页
│   │   ├── index.tsx                    # 首页主组件
│   │   ├── banner.tsx                   # Banner 组件
│   │   ├── chat-list.tsx                # 聊天列表
│   │   ├── datasets.tsx                 # 数据集列表
│   │   ├── agent-list.tsx               # Agent 列表
│   │   ├── search-list.tsx              # 搜索列表
│   │   └── application-card.tsx         # 应用卡片
│   │
│   ├── login/ & login-next/             # 登录页面
│   │   ├── index.tsx
│   │   ├── form.tsx
│   │   ├── right-panel.tsx
│   │   └── hooks.ts
│   │
│   ├── user-setting/                    # 用户设置
│   │   ├── index.tsx
│   │   ├── hooks.ts
│   │   ├── constants.tsx
│   │   ├── sidebar/                     # 侧边栏
│   │   ├── setting-profile/             # 个人资料设置
│   │   ├── setting-password/            # 密码设置
│   │   ├── setting-model/               # 模型配置
│   │   │   ├── index.tsx
│   │   │   ├── hooks.ts
│   │   │   ├── api-key-modal/           # API Key 模态框
│   │   │   ├── ollama-modal/            # Ollama 配置
│   │   │   ├── azure-openai-modal/      # Azure OpenAI 配置
│   │   │   ├── langfuse/                # Langfuse 配置
│   │   │   └── ...                      # 其他 LLM 提供商配置
│   │   ├── setting-team/                # 团队设置
│   │   ├── setting-locale/              # 语言设置
│   │   ├── setting-api/                 # API 设置
│   │   └── setting-system/              # 系统设置
│   │
│   ├── profile-setting/                 # 新版设置页面
│   │   ├── index.tsx
│   │   ├── sidebar/                     # 侧边栏
│   │   ├── profile/                     # 个人资料
│   │   ├── model/                       # 模型配置
│   │   ├── mcp/                         # MCP 服务器管理
│   │   │   ├── index.tsx
│   │   │   ├── mcp-card.tsx             # MCP 卡片
│   │   │   ├── tool-card.tsx            # 工具卡片
│   │   │   ├── edit-mcp-dialog/         # 编辑 MCP 对话框
│   │   │   ├── import-mcp-dialog/       # 导入 MCP 对话框
│   │   │   ├── use-edit-mcp.ts          # 编辑逻辑
│   │   │   ├── use-import-mcp.ts        # 导入逻辑
│   │   │   ├── use-export-mcp.ts        # 导出逻辑
│   │   │   └── use-bulk-operate-mcp.tsx # 批量操作
│   │   ├── team/                        # 团队
│   │   ├── plan/                        # 订阅计划
│   │   └── prompt/                      # Prompt 模板
│   │
│   ├── datasets/                        # 数据集列表
│   │   ├── index.tsx
│   │   ├── hooks.ts
│   │   ├── dataset-card.tsx             # 数据集卡片
│   │   ├── dataset-dropdown.tsx         # 下拉菜单
│   │   ├── dataset-creating-dialog.tsx  # 创建对话框
│   │   ├── dataset-dataflow-creating-dialog.tsx
│   │   ├── process-log-modal.tsx        # 处理日志模态框
│   │   ├── use-rename-dataset.ts
│   │   ├── use-select-owners.ts
│   │   └── use-display-owner.ts
│   │
│   ├── dataset/ & add-knowledge/        # 数据集详情 (知识库管理)
│   │   ├── index.tsx
│   │   ├── sidebar/                     # 侧边栏导航
│   │   ├── dataset/ & knowledge-file/   # 文件管理
│   │   │   ├── index.tsx
│   │   │   ├── hooks.ts
│   │   │   ├── dataset-table.tsx        # 文件表格
│   │   │   ├── dataset-action-cell.tsx  # 操作列
│   │   │   ├── parsing-status-cell.tsx  # 解析状态
│   │   │   ├── web-crawl-modal.tsx      # 网页爬虫
│   │   │   ├── rename-modal/            # 重命名
│   │   │   ├── set-meta-modal/          # 设置元数据
│   │   │   ├── file-selector-modal.tsx  # 文件选择器
│   │   │   ├── create-file-modal.tsx    # 创建文件
│   │   │   ├── use-upload-document.ts
│   │   │   ├── use-run-document.ts
│   │   │   ├── use-rename-document.ts
│   │   │   └── ...
│   │   ├── dataset-setting/ & knowledge-setting/  # 设置
│   │   │   ├── index.tsx
│   │   │   ├── hooks.ts
│   │   │   ├── form-schema.ts           # 表单 Schema
│   │   │   ├── general-form.tsx         # 通用设置
│   │   │   ├── chunk-method-form.tsx    # 分块方法
│   │   │   ├── chunk-method-card.tsx    # 分块方法卡片
│   │   │   ├── configuration/           # 解析器配置
│   │   │   │   ├── naive.tsx            # Naive 解析器
│   │   │   │   ├── qa.tsx, book.tsx, laws.tsx, paper.tsx
│   │   │   │   ├── resume.tsx, manual.tsx, table.tsx
│   │   │   │   ├── presentation.tsx, picture.tsx, one.tsx
│   │   │   │   ├── audio.tsx, email.tsx, tag.tsx
│   │   │   │   └── knowledge-graph.tsx
│   │   │   ├── tag-table/               # 标签表格
│   │   │   ├── tag-tabs.tsx             # 标签选项卡
│   │   │   ├── tag-item.tsx             # 标签项
│   │   │   ├── tag-word-cloud.tsx       # 词云
│   │   │   └── category-panel.tsx       # 分类面板
│   │   ├── dataset-overview/ & knowledge-dataset/  # 概览
│   │   ├── testing/ & knowledge-testing/  # 测试
│   │   │   ├── index.tsx
│   │   │   ├── testing-form.tsx
│   │   │   ├── testing-result.tsx
│   │   │   └── testing-control/
│   │   └── knowledge-graph/             # 知识图谱
│   │       ├── index.tsx
│   │       ├── force-graph.tsx          # 力导向图
│   │       ├── util.ts
│   │       └── use-delete-graph.ts
│   │
│   ├── chunk/                           # 文档块管理
│   │   ├── index.tsx
│   │   ├── chunk-toolbar.tsx            # 工具栏
│   │   ├── chunk-card.tsx               # 块卡片
│   │   ├── parsed-result/               # 解析结果
│   │   ├── chunked-result-panel.tsx     # 分块结果
│   │   └── result-view/                 # 结果视图
│   │
│   ├── dataflow-result/                 # 数据流结果
│   │   ├── index.tsx
│   │   ├── hooks.ts
│   │   ├── parser.tsx                   # 解析器结果
│   │   ├── chunker.tsx                  # 分块器结果
│   │   └── components/                  # 组件
│   │       ├── chunk-card/
│   │       ├── chunk-toolbar/
│   │       ├── chunk-creating-modal/
│   │       ├── chunk-result-bar/
│   │       ├── document-preview/
│   │       ├── parse-editer/
│   │       ├── rerun-button/
│   │       └── time-line/
│   │
│   ├── chat/ & next-chats/              # 聊天页面
│   │   ├── index.tsx
│   │   ├── hooks.ts
│   │   ├── constants.ts
│   │   ├── chat-card.tsx                # 聊天卡片
│   │   ├── chat-dropdown.tsx            # 下拉菜单
│   │   ├── chat/                        # 聊天详情
│   │   │   ├── index.tsx
│   │   │   ├── sessions.tsx             # 会话列表
│   │   │   ├── llm-select-form.tsx      # LLM 选择
│   │   │   ├── conversation-dropdown.tsx
│   │   │   ├── chat-box/                # 聊天框
│   │   │   │   ├── single-chat-box.tsx
│   │   │   │   └── multiple-chat-box.tsx
│   │   │   ├── app-settings/            # 应用设置
│   │   │   │   ├── chat-settings.tsx
│   │   │   │   ├── chat-basic-settings.tsx
│   │   │   │   ├── chat-model-settings.tsx
│   │   │   │   ├── chat-prompt-engine.tsx
│   │   │   │   ├── metadata-filter-conditions.tsx
│   │   │   │   ├── dynamic-variable.tsx
│   │   │   │   ├── saving-button.tsx
│   │   │   │   └── use-chat-setting-schema.tsx
│   │   │   ├── use-add-box.ts
│   │   │   ├── use-switch-debug-mode.ts
│   │   │   └── ...
│   │   ├── components/                  # 通用组件
│   │   │   ├── bot-management-panel.tsx # Bot 管理面板
│   │   │   ├── bot-config-dialog.tsx    # Bot 配置
│   │   │   └── freechat-list-panel.tsx  # FreeChat 列表
│   │   ├── hooks/                       # 自定义 Hooks
│   │   │   ├── use-send-chat-message.ts
│   │   │   ├── use-send-multiple-message.ts
│   │   │   ├── use-send-shared-message.ts
│   │   │   ├── use-create-conversation.ts
│   │   │   ├── use-select-conversation-list.ts
│   │   │   ├── use-rename-chat.ts
│   │   │   ├── use-upload-file.ts
│   │   │   └── ...
│   │   ├── share/                       # 分享页面
│   │   ├── widget/                      # Widget 嵌入
│   │   └── markdown-content/            # Markdown 内容渲染
│   │
│   ├── free-chat/                       # FreeChat 页面
│   │   ├── index.tsx
│   │   ├── unauthorized.tsx             # 未授权页面
│   │   ├── chat-interface.tsx           # 聊天界面
│   │   ├── components/                  # 组件
│   │   │   ├── session-list.tsx
│   │   │   ├── knowledge-base-selector.tsx
│   │   │   ├── dialog-selector.tsx
│   │   │   └── control-panel.tsx
│   │   ├── contexts/                    # Context
│   │   │   └── kb-context.tsx
│   │   ├── hooks/                       # Hooks
│   │   │   ├── use-free-chat.ts
│   │   │   ├── use-free-chat-session.ts
│   │   │   ├── use-free-chat-user-id.ts
│   │   │   ├── use-free-chat-settings-api.ts
│   │   │   ├── use-kb-toggle.ts
│   │   │   ├── use-auto-create-dialog.ts
│   │   │   └── use-dynamic-params.ts
│   │   └── utils/
│   │       └── error-handler.ts
│   │
│   ├── agents/                          # Agent 列表
│   │   ├── index.tsx
│   │   ├── agent-card.tsx               # Agent 卡片
│   │   ├── agent-dropdown.tsx           # 下拉菜单
│   │   ├── agent-templates.tsx          # 模板列表
│   │   ├── template-sidebar.tsx         # 模板侧边栏
│   │   ├── template-card.tsx            # 模板卡片
│   │   ├── create-agent-dialog.tsx      # 创建对话框
│   │   ├── create-agent-form.tsx        # 创建表单
│   │   ├── upload-agent-dialog/         # 上传对话框
│   │   ├── agent-log-page.tsx           # 日志页面
│   │   ├── agent-log-detail-modal.tsx   # 日志详情
│   │   ├── name-form-field.tsx
│   │   ├── use-rename-agent.ts
│   │   ├── use-import-json.ts
│   │   └── hooks/
│   │       └── use-create-agent.ts
│   │
│   ├── agent/ & data-flow/              # Agent 编辑器 (Canvas)
│   │   ├── index.tsx
│   │   ├── hooks.tsx
│   │   ├── form-hooks.ts
│   │   ├── interface.ts
│   │   ├── constant.tsx
│   │   ├── options.ts                   # 节点选项
│   │   ├── operator-icon.tsx            # 操作符图标
│   │   ├── flow-tooltip.tsx             # 提示
│   │   ├── store.ts                     # Zustand Store
│   │   ├── context.ts                   # React Context
│   │   ├── utils/                       # 工具函数
│   │   │   ├── chat.ts
│   │   │   ├── build-output-list.ts
│   │   │   ├── delete-node.ts
│   │   │   └── filter-downstream-nodes.ts
│   │   ├── hooks/                       # Hooks (30+ 个)
│   │   │   ├── use-fetch-data.ts
│   │   │   ├── use-set-graph.ts
│   │   │   ├── use-save-graph.ts
│   │   │   ├── use-build-dsl.ts
│   │   │   ├── use-export-json.ts
│   │   │   ├── use-chat-logic.ts
│   │   │   ├── use-send-agent-message.ts (agent 页面)
│   │   │   ├── use-send-shared-message.ts
│   │   │   ├── use-cache-chat-log.ts
│   │   │   ├── use-show-drawer.tsx
│   │   │   ├── use-show-dialog.ts
│   │   │   ├── use-iteration.ts
│   │   │   ├── use-before-delete.tsx
│   │   │   ├── use-add-node.ts
│   │   │   ├── use-change-node-name.ts
│   │   │   ├── use-move-note.ts
│   │   │   ├── use-open-document.ts
│   │   │   ├── use-form-values.ts
│   │   │   ├── use-watch-form-change.ts
│   │   │   ├── use-get-begin-query.tsx
│   │   │   ├── use-find-mcp-by-id.ts
│   │   │   ├── use-agent-tool-initial-values.ts (agent 页面)
│   │   │   ├── use-placeholder-manager.ts (agent 页面)
│   │   │   ├── use-connection-drag.ts (agent 页面)
│   │   │   ├── use-dropdown-position.ts (agent 页面)
│   │   │   ├── use-calculate-sheet-right.ts (agent 页面)
│   │   │   └── ...
│   │   ├── canvas/                      # Canvas 画布
│   │   │   ├── index.tsx
│   │   │   ├── context.tsx              # React Flow Context
│   │   │   ├── node/                    # 节点组件 (20+ 个)
│   │   │   │   ├── index.tsx
│   │   │   │   ├── begin-node.tsx       # 开始节点
│   │   │   │   ├── generate-node.tsx    # LLM 生成节点
│   │   │   │   ├── agent-node.tsx       # Agent 节点 (工具)
│   │   │   │   ├── tool-node.tsx        # 工具节点
│   │   │   │   ├── retrieval-node.tsx   # 检索节点
│   │   │   │   ├── relevant-node.tsx    # 相关性节点
│   │   │   │   ├── rewrite-node.tsx     # 重写节点
│   │   │   │   ├── message-node.tsx     # 消息节点
│   │   │   │   ├── keyword-node.tsx     # 关键词节点
│   │   │   │   ├── email-node.tsx       # 邮件节点
│   │   │   │   ├── switch-node.tsx      # 开关节点
│   │   │   │   ├── categorize-node.tsx  # 分类节点
│   │   │   │   ├── iteration-node.tsx   # 迭代节点
│   │   │   │   ├── invoke-node.tsx      # 调用节点
│   │   │   │   ├── logic-node.tsx       # 逻辑节点
│   │   │   │   ├── template-node.tsx    # 模板节点
│   │   │   │   ├── parser-node.tsx (data-flow)     # 解析器节点
│   │   │   │   ├── chunker-node.tsx (data-flow)    # 分块器节点
│   │   │   │   ├── tokenizer-node.tsx (data-flow)  # 分词器节点
│   │   │   │   ├── note-node/           # 笔记节点
│   │   │   │   ├── placeholder-node.tsx (agent)    # 占位符节点
│   │   │   │   ├── node-wrapper.tsx     # 节点包装器
│   │   │   │   ├── node-header.tsx      # 节点头部
│   │   │   │   ├── card.tsx             # 节点卡片
│   │   │   │   ├── handle.tsx           # 连接点
│   │   │   │   ├── handle-icon.tsx      # 连接点图标
│   │   │   │   ├── toolbar.tsx          # 工具栏
│   │   │   │   ├── popover.tsx          # 弹出框
│   │   │   │   ├── dropdown.tsx         # 下拉菜单
│   │   │   │   ├── dropdown/
│   │   │   │   │   └── next-step-dropdown.tsx
│   │   │   │   ├── resize-icon.tsx
│   │   │   │   ├── hooks.ts
│   │   │   │   ├── use-build-switch-handle-positions.ts
│   │   │   │   └── use-build-categorize-handle-positions.ts
│   │   │   ├── edge/                    # 边组件
│   │   │   │   └── index.tsx
│   │   │   └── context-menu/            # 右键菜单
│   │   │       └── index.tsx
│   │   ├── components/                  # 通用组件
│   │   │   └── background.tsx           # 背景
│   │   ├── form/                        # 节点配置表单 (50+ 个)
│   │   │   ├── begin-form/              # 开始节点表单
│   │   │   │   ├── index.tsx
│   │   │   │   ├── hooks.ts
│   │   │   │   ├── query-table.tsx
│   │   │   │   ├── parameter-dialog.tsx (data-flow) / paramater-modal.tsx (flow)
│   │   │   │   ├── begin-dynamic-options.tsx
│   │   │   │   ├── use-watch-change.ts (data-flow)
│   │   │   │   ├── use-values.ts (data-flow)
│   │   │   │   ├── use-edit-query.ts (data-flow)
│   │   │   │   └── utils.ts (data-flow)
│   │   │   ├── generate-form/           # LLM 生成表单
│   │   │   │   ├── index.tsx
│   │   │   │   ├── hooks.ts
│   │   │   │   └── dynamic-parameters.tsx
│   │   │   ├── agent-form/              # Agent 表单 (工具)
│   │   │   │   ├── index.tsx
│   │   │   │   ├── agent-tools.tsx
│   │   │   │   ├── dynamic-tool.tsx
│   │   │   │   ├── dynamic-prompt.tsx
│   │   │   │   ├── use-watch-change.ts (data-flow)
│   │   │   │   ├── use-values.ts (data-flow)
│   │   │   │   ├── use-get-tools.ts (data-flow)
│   │   │   │   └── tool-popover/        # 工具选择器
│   │   │   │       ├── index.tsx
│   │   │   │       ├── tool-command.tsx
│   │   │   │       ├── use-update-tools.ts
│   │   │   │       └── use-update-mcp.ts
│   │   │   ├── tool-form/               # 工具表单 (agent 页面)
│   │   │   │   ├── index.tsx
│   │   │   │   ├── constant.tsx
│   │   │   │   ├── use-watch-change.ts
│   │   │   │   ├── use-values.ts
│   │   │   │   ├── arxiv-form/
│   │   │   │   ├── google-form/
│   │   │   │   ├── wikipedia-form/
│   │   │   │   ├── duckduckgo-form/
│   │   │   │   ├── pubmed-form/
│   │   │   │   ├── github-form/
│   │   │   │   ├── tavily-form/
│   │   │   │   ├── searxng-form/
│   │   │   │   ├── email-form/
│   │   │   │   ├── retrieval-form/
│   │   │   │   ├── crawler-form/
│   │   │   │   ├── exesql-form/
│   │   │   │   ├── yahoo-finance-form/
│   │   │   │   ├── google-scholar-form/
│   │   │   │   ├── bing-form/
│   │   │   │   ├── mcp-form/            # MCP 工具表单
│   │   │   │   │   ├── index.tsx
│   │   │   │   │   ├── mcp-card.tsx
│   │   │   │   │   ├── use-watch-change.ts
│   │   │   │   │   └── use-values.ts
│   │   │   │   └── ...
│   │   │   ├── retrieval-form/          # 检索表单
│   │   │   │   ├── next.tsx (data-flow) / index.tsx (flow)
│   │   │   │   ├── hooks.ts (flow)
│   │   │   │   └── use-values.ts (data-flow)
│   │   │   ├── relevant-form/           # 相关性表单
│   │   │   │   ├── index.tsx
│   │   │   │   └── hooks.ts
│   │   │   ├── rewrite-question-form/   # 重写问题表单
│   │   │   │   └── index.tsx
│   │   │   ├── message-form/            # 消息表单
│   │   │   │   ├── index.tsx
│   │   │   │   ├── use-watch-change.ts (data-flow)
│   │   │   │   └── use-values.ts (data-flow)
│   │   │   ├── keyword-extract-form/    # 关键词提取表单
│   │   │   │   └── index.tsx
│   │   │   ├── email-form/              # 邮件表单
│   │   │   │   └── index.tsx
│   │   │   ├── switch-form/             # 开关表单
│   │   │   │   ├── index.tsx
│   │   │   │   ├── use-watch-change.ts (data-flow)
│   │   │   │   └── use-values.ts (data-flow)
│   │   │   ├── categorize-form/         # 分类表单
│   │   │   │   ├── index.tsx
│   │   │   │   ├── hooks.ts (flow)
│   │   │   │   ├── dynamic-categorize.tsx
│   │   │   │   ├── dynamic-example.tsx (data-flow)
│   │   │   │   ├── use-form-schema.ts (data-flow)
│   │   │   │   ├── use-watch-change.ts (data-flow)
│   │   │   │   └── use-values.ts (data-flow)
│   │   │   ├── iteration-form/          # 迭代表单
│   │   │   │   ├── index.tsx
│   │   │   │   ├── interface.ts (data-flow)
│   │   │   │   ├── dynamic-output.tsx
│   │   │   │   ├── use-build-options.ts (data-flow)
│   │   │   │   ├── use-watch-form-change.ts (data-flow)
│   │   │   │   └── use-values.ts (data-flow)
│   │   │   ├── iteration-start-from/    # 迭代起始表单 (data-flow)
│   │   │   │   └── index.tsx
│   │   │   ├── invoke-form/             # 调用表单
│   │   │   │   ├── index.tsx
│   │   │   │   ├── hooks.ts (flow)
│   │   │   │   ├── dynamic-variables.tsx (flow)
│   │   │   │   ├── variable-table.tsx (data-flow/agent)
│   │   │   │   ├── variable-dialog.tsx (data-flow/agent)
│   │   │   │   ├── use-edit-variable.ts (data-flow/agent)
│   │   │   │   └── schema.ts (data-flow/agent)
│   │   │   ├── user-fill-up-form/       # 用户填充表单
│   │   │   │   ├── index.tsx
│   │   │   │   ├── use-watch-change.ts (data-flow)
│   │   │   │   └── use-values.ts (data-flow)
│   │   │   ├── string-transform-form/   # 字符串转换表单
│   │   │   │   ├── index.tsx
│   │   │   │   ├── use-watch-form-change.ts (data-flow)
│   │   │   │   └── use-values.ts (data-flow)
│   │   │   ├── parser-form/             # 解析器表单 (data-flow)
│   │   │   │   └── index.tsx
│   │   │   ├── chunker-form/            # 分块器表单 (data-flow)
│   │   │   │   └── index.tsx
│   │   │   ├── tokenizer-form/          # 分词器表单 (data-flow)
│   │   │   │   └── index.tsx
│   │   │   ├── code-form/               # 代码表单
│   │   │   │   ├── index.tsx
│   │   │   │   ├── dynamic-input-variable.tsx (flow)
│   │   │   │   ├── dynamic-output-variable.tsx (flow)
│   │   │   │   ├── next-variable.tsx (data-flow)
│   │   │   │   ├── schema.ts (data-flow)
│   │   │   │   ├── use-watch-change.ts (data-flow)
│   │   │   │   └── use-values.ts (data-flow)
│   │   │   ├── exesql-form/             # SQL 执行表单
│   │   │   │   ├── index.tsx
│   │   │   │   └── use-submit-form.ts (data-flow)
│   │   │   ├── crawler-form/            # 爬虫表单
│   │   │   │   └── index.tsx
│   │   │   ├── components/              # 表单组件
│   │   │   │   ├── dynamic-input-variable.tsx
│   │   │   │   ├── next-dynamic-input-variable.tsx (data-flow)
│   │   │   │   ├── output.tsx (data-flow)
│   │   │   │   ├── query-variable.tsx (data-flow)
│   │   │   │   ├── form-wrapper.tsx (data-flow)
│   │   │   │   ├── description-field.tsx (data-flow)
│   │   │   │   ├── api-key-field.tsx (data-flow)
│   │   │   │   └── prompt-editor/       # Prompt 编辑器 (data-flow)
│   │   │   │       ├── index.tsx
│   │   │   │       ├── theme.ts
│   │   │   │       ├── constant.ts
│   │   │   │       ├── variable-node.tsx
│   │   │   │       ├── variable-picker-plugin.tsx
│   │   │   │       ├── variable-on-change-plugin.tsx
│   │   │   │       └── paste-handler-plugin.tsx
│   │   │   ├── (30+ 工具特定表单: arxiv, google, wikipedia, duckduckgo, pubmed, github, tavily, wencai, qweather, jin10, akshare, tushare, yahoofinance, google-scholar, deepl, baidu, bing, baidu-fanyi, answer, concentrator, template, 等)
│   │   │   └── ...
│   │   ├── form-sheet/ (data-flow/agent) # 表单侧边栏
│   │   │   ├── next.tsx
│   │   │   ├── form-config-map.tsx
│   │   │   └── single-debug-sheet/      # 单步调试侧边栏
│   │   │       └── index.tsx
│   │   ├── setting-dialog/              # 设置对话框
│   │   │   ├── index.tsx
│   │   │   └── setting-form.tsx
│   │   ├── version-dialog/              # 版本对话框
│   │   │   └── index.tsx
│   │   ├── upload-agent-dialog/         # 上传 Agent 对话框
│   │   │   ├── index.tsx
│   │   │   └── upload-agent-form.tsx
│   │   ├── debug-content/               # 调试内容
│   │   │   ├── index.tsx
│   │   │   ├── popover-form.tsx
│   │   │   └── uploader.tsx
│   │   ├── run-sheet/ (agent) & run-drawer/ (flow)  # 运行面板
│   │   │   ├── index.tsx
│   │   │   └── popover-form.tsx (flow)
│   │   ├── log-sheet/                   # 日志面板 (agent)
│   │   │   ├── index.tsx
│   │   │   ├── workflow-timeline.tsx
│   │   │   └── tool-timeline-item.tsx
│   │   ├── chat/                        # 聊天面板
│   │   │   ├── box.tsx (flow)
│   │   │   ├── chat-sheet.tsx (agent)
│   │   │   ├── drawer.tsx (flow)
│   │   │   ├── hooks.ts (flow)
│   │   │   ├── use-send-agent-message.ts (agent)
│   │   │   └── knowledge-base-selector.tsx (agent)
│   │   ├── share/                       # 分享页面
│   │   │   ├── index.tsx
│   │   │   └── parameter-dialog.tsx (agent)
│   │   └── use-agent-history-manager.ts # Agent 历史管理
│   │
│   ├── data-flows/                      # 数据流列表 (类似 agents)
│   │   └── index.tsx
│   │
│   ├── search/ & next-search/ & next-searches/  # 搜索页面
│   │   ├── index.tsx
│   │   ├── hooks.ts
│   │   ├── search-card.tsx              # 搜索卡片
│   │   ├── search-dropdown.tsx          # 下拉菜单
│   │   ├── search-view.tsx (next-search)
│   │   ├── search-home.tsx (next-search)
│   │   ├── search-setting.tsx (next-search)
│   │   ├── search-setting-aisummery-config.tsx (next-search)
│   │   ├── searching.tsx (next-search)
│   │   ├── embed-app-modal.tsx (next-search)
│   │   ├── mindmap-drawer.tsx           # 思维导图
│   │   ├── sidebar.tsx (search)
│   │   ├── retrieval-documents/         # 检索文档
│   │   ├── markdown-content/            # Markdown 内容
│   │   ├── highlight-markdown/          # 高亮 Markdown
│   │   ├── document-preview-modal/      # 文档预览模态框
│   │   └── share/                       # 分享页面
│   │
│   ├── files/ & file-manager/           # 文件管理
│   │   ├── index.tsx
│   │   ├── hooks.ts
│   │   ├── files-table.tsx (files)
│   │   ├── file-breadcrumb.tsx (files)
│   │   ├── file-toolbar.tsx (file-manager)
│   │   ├── action-cell/ (file-manager) / action-cell.tsx (files)
│   │   ├── knowledge-cell.tsx (files)
│   │   ├── link-to-dataset-dialog.tsx (files)
│   │   ├── move-dialog.tsx (files)
│   │   ├── create-folder-dialog/ (files)
│   │   ├── folder-create-modal/ (file-manager)
│   │   ├── move-file-modal/ (file-manager)
│   │   │   ├── index.tsx
│   │   │   └── async-tree-select.tsx
│   │   ├── connect-to-knowledge-modal/ (file-manager)
│   │   ├── use-upload-file.ts
│   │   ├── use-navigate-to-folder.ts (files)
│   │   ├── use-move-file.ts (files)
│   │   ├── use-delete-file.ts (files)
│   │   ├── use-create-folder.ts (files)
│   │   └── use-bulk-operate-file.tsx (files)
│   │
│   ├── knowledge/                       # 知识库列表 (旧版)
│   │   ├── index.tsx
│   │   ├── hooks.ts
│   │   ├── knowledge-card/
│   │   └── knowledge-creating-modal/
│   │
│   ├── document-viewer/                 # 文档查看器
│   │   ├── index.tsx
│   │   ├── hooks.ts
│   │   ├── pdf/, docx/, excel/
│   │   ├── image/, md/, text/
│   │   └── file-error/
│   │
│   └── ...
│
├── components/                          # 可复用组件
│   ├── ui/                              # UI 基础组件 (基于 Radix UI + TailwindCSS)
│   │   ├── button.tsx
│   │   ├── input.tsx
│   │   ├── select.tsx
│   │   ├── dialog.tsx
│   │   ├── dropdown-menu.tsx
│   │   ├── form.tsx
│   │   ├── label.tsx
│   │   ├── checkbox.tsx
│   │   ├── radio-group.tsx
│   │   ├── switch.tsx
│   │   ├── slider.tsx
│   │   ├── tabs.tsx
│   │   ├── card.tsx
│   │   ├── avatar.tsx
│   │   ├── badge.tsx
│   │   ├── toast.tsx (sonner)
│   │   ├── popover.tsx
│   │   ├── tooltip.tsx
│   │   ├── sheet.tsx (侧边栏)
│   │   ├── scroll-area.tsx
│   │   ├── separator.tsx
│   │   ├── progress.tsx
│   │   ├── skeleton.tsx
│   │   ├── table.tsx
│   │   ├── command.tsx (cmdk)
│   │   └── ...
│   ├── confirm-delete-dialog/          # 确认删除对话框
│   ├── rename-dialog/                   # 重命名对话框
│   ├── ragflow-form/                    # RAGFlow 表单组件
│   ├── ragflow-pagination/              # RAGFlow 分页组件
│   ├── ragflow-avatar/                  # RAGFlow 头像组件
│   ├── number-input/                    # 数字输入框
│   ├── skeleton-card/                   # 骨架屏卡片
│   ├── spin/                            # 加载中
│   ├── button-loading/                  # 带加载状态的按钮
│   ├── avatar-upload/                   # 头像上传
│   └── ...
│
├── services/                            # API 服务层
│   ├── user-service.ts                  # 用户服务
│   ├── knowledge-service.ts             # 知识库服务
│   ├── chat-service.ts                  # 聊天服务
│   ├── next-chat-service.ts             # 新版聊天服务
│   ├── agent-service.ts                 # Agent 服务
│   ├── flow-service.ts                  # 工作流服务
│   ├── search-service.ts                # 搜索服务
│   ├── plugin-service.ts                # 插件服务
│   ├── mcp-server-service.ts            # MCP 服务器服务
│   └── file-manager-service.ts          # 文件管理服务
│
├── hooks/                               # 全局自定义 Hooks
│   ├── use-user-info.ts
│   ├── use-translate.ts
│   ├── use-navigate-with-from-state.ts
│   ├── use-handle-submit-and-enter-and-shift-enter.ts
│   ├── use-set-document-title.ts
│   ├── use-save-document.ts
│   ├── use-show-delete-confirm.ts
│   ├── use-get-pagination-params.ts
│   ├── use-toast.tsx (sonner)
│   └── ...
│
├── utils/                               # 工具函数
│   ├── api.ts                           # API 请求配置
│   ├── request.ts                       # 请求封装
│   ├── next-request.ts                  # 新版请求封装
│   ├── authorization-util.ts            # 授权工具
│   ├── common-util.ts                   # 通用工具
│   ├── component-util.ts                # 组件工具
│   ├── dataset-util.ts                  # 数据集工具
│   ├── document-util.ts                 # 文档工具
│   ├── file-util.ts                     # 文件工具
│   ├── llm-util.ts                      # LLM 工具
│   ├── chat.ts                          # 聊天工具
│   ├── date.ts                          # 日期工具
│   ├── form.ts                          # 表单工具
│   ├── dom-util.ts                      # DOM 工具
│   ├── store-util.ts                    # Store 工具
│   ├── register-server.ts               # 注册服务器
│   └── index.ts
│
├── interfaces/                          # TypeScript 接口定义
│   ├── common.ts                        # 通用接口
│   ├── database/                        # 数据库模型接口
│   │   ├── base.ts
│   │   ├── user-setting.ts
│   │   ├── system.ts
│   │   ├── knowledge.ts
│   │   ├── document.ts
│   │   ├── chat.ts
│   │   ├── agent.ts
│   │   ├── flow.ts
│   │   ├── llm.ts
│   │   ├── plugin.ts
│   │   ├── mcp.ts
│   │   ├── mcp-server.ts
│   │   └── file-manager.ts
│   └── request/                         # 请求接口
│       ├── base.ts
│       ├── knowledge.ts
│       ├── document.ts
│       ├── chat.ts
│       ├── agent.ts
│       ├── flow.ts
│       ├── llm.ts
│       ├── mcp.ts
│       ├── system.ts
│       └── file-manager.ts
│
├── constants/                           # 常量
│   ├── common.ts
│   ├── knowledge.ts
│   ├── chat.ts
│   ├── agent.ts
│   └── ...
│
├── locales/                             # 国际化
│   ├── config.ts                        # i18n 配置
│   ├── en.ts                            # 英文
│   ├── zh.ts                            # 简体中文
│   ├── zh-traditional.ts                # 繁体中文
│   ├── ja.ts                            # 日文
│   ├── ko.ts                            # 韩文
│   ├── pt-br.ts                         # 葡萄牙语 (巴西)
│   ├── es.ts                            # 西班牙语
│   ├── fr.ts                            # 法语
│   ├── de.ts                            # 德语
│   ├── id.ts                            # 印尼语
│   ├── ru.ts                            # 俄语
│   ├── vi.ts                            # 越南语
│   └── until.ts                         # 工具函数
│
├── layouts/                             # 布局组件
│   ├── index.tsx                        # 主布局
│   ├── next.tsx                         # 新版布局
│   ├── next-header.tsx                  # 新版头部
│   ├── bell-button.tsx                  # 通知按钮
│   └── components/
│       ├── header/                      # 头部
│       ├── user/                        # 用户菜单
│       └── right-toolbar/               # 右侧工具栏
│
├── wrappers/                            # 路由包装器
│   └── auth.tsx                         # 认证包装器
│
├── icons/                               # 图标组件
│
├── less/                                # Less 样式
│
├── lib/                                 # 第三方库封装
│   └── utils.ts                         # cn() 工具 (clsx + tailwind-merge)
│
├── theme/                               # 主题配置
│   └── theme.ts
│
├── stories/                             # Storybook 故事
│   ├── *.stories.ts
│   └── *.stories.tsx
│
├── assets/                              # 静态资源
│
├── app.tsx                              # 应用入口 (UmiJS)
├── routes.ts                            # 路由配置 (UmiJS)
├── global.less                          # 全局样式
├── inter.less                           # Inter 字体
├── conf.json                            # 配置
└── custom.d.ts                          # 类型定义
```

## 3. 路由系统 (UmiJS)

### 3.1 文件路由约定

UmiJS 使用文件系统路由,`pages/` 目录下的文件自动成为路由:

- `pages/home/index.tsx` → `/home`
- `pages/login/index.tsx` → `/login`
- `pages/datasets/index.tsx` → `/datasets`
- `pages/dataset/index.tsx` → `/dataset/:id` (动态路由)
- `pages/agents/index.tsx` → `/agents`
- `pages/agent/index.tsx` → `/agent/:id`

### 3.2 路由配置 (src/routes.ts)

手动配置路由,覆盖文件路由:

```typescript
export const routes = [
  { path: '/', redirect: '/home' },
  { path: '/login', component: '@/pages/login' },
  {
    path: '/',
    component: '@/layouts',
    routes: [
      { path: '/home', component: '@/pages/home' },
      { path: '/datasets', component: '@/pages/datasets' },
      { path: '/dataset/:id', component: '@/pages/dataset' },
      // ...
    ]
  },
  {
    path: '/share',
    routes: [
      { path: '/share/chat/:id', component: '@/pages/chat/share' },
      { path: '/share/agent/:id', component: '@/pages/agent/share' },
    ]
  },
  { path: '*', component: '@/pages/404' },
]
```

### 3.3 权限路由

使用 `wrappers/auth.tsx` 包装需要认证的路由:

```typescript
{
  path: '/datasets',
  component: '@/pages/datasets',
  wrappers: ['@/wrappers/auth'],
}
```

## 4. 状态管理

### 4.1 React Query (@tanstack/react-query)

**用于服务端状态管理**:

- **查询**: `useQuery`
```typescript
const { data, isLoading, error } = useQuery({
  queryKey: ['datasets'],
  queryFn: () => datasetService.list(),
})
```

- **变更**: `useMutation`
```typescript
const createMutation = useMutation({
  mutationFn: datasetService.create,
  onSuccess: () => queryClient.invalidateQueries(['datasets']),
})
```

- **无限滚动**: `useInfiniteQuery`
- **预取**: `queryClient.prefetchQuery()`
- **乐观更新**: `onMutate`, `onError`, `onSettled`

**配置** (src/app.tsx):
```typescript
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 5 * 60 * 1000, // 5 分钟
      cacheTime: 10 * 60 * 1000, // 10 分钟
      refetchOnWindowFocus: false,
    },
  },
});
```

**FreeChat 最佳实践**:
- 使用 `freeChatKeys` 工厂函数管理查询键
- 乐观更新提升用户体验
- 自定义重试逻辑（认证错误不重试）
- 参考：`web/src/pages/free-chat/hooks/use-free-chat-settings-query.ts`

### 4.2 Zustand

**用于客户端状态管理**:

**示例**: `pages/agent/store.ts`
```typescript
import { create } from 'zustand';

interface AgentState {
  nodes: Node[];
  edges: Edge[];
  setNodes: (nodes: Node[]) => void;
  setEdges: (edges: Edge[]) => void;
}

export const useAgentStore = create<AgentState>((set) => ({
  nodes: [],
  edges: [],
  setNodes: (nodes) => set({ nodes }),
  setEdges: (edges) => set({ edges }),
}));
```

**使用**:
```typescript
const { nodes, setNodes } = useAgentStore();
```

### 4.3 React Context

**用于局部状态共享**:

- `pages/agent/context.ts`: Agent Canvas Context
- `pages/free-chat/contexts/kb-context.tsx`: 知识库 Context
- `pages/flow/context.ts`: Flow Canvas Context

## 5. API 服务层

### 5.1 服务层组织 (src/services/)

每个服务文件对应一个业务模块,封装 API 请求:

**示例**: `services/knowledge-service.ts`
```typescript
import request from '@/utils/request';

export const knowledgeService = {
  list: (params) => request.get('/api/v1/kb/list', { params }),
  get: (id) => request.get(`/api/v1/kb/get/${id}`),
  create: (data) => request.post('/api/v1/kb/create', { data }),
  update: (data) => request.post('/api/v1/kb/update', { data }),
  delete: (id) => request.delete(`/api/v1/kb/delete/${id}`),
  getDocuments: (id, params) => request.get(`/api/v1/kb/${id}/documents`, { params }),
};
```

### 5.2 请求封装 (src/utils/request.ts)

基于 `axios` 封装:

```typescript
import axios from 'axios';

const request = axios.create({
  baseURL: '/api',
  timeout: 60000,
  withCredentials: true,
});

// 请求拦截器
request.interceptors.request.use((config) => {
  // 添加 Token
  const token = localStorage.getItem('token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// 响应拦截器
request.interceptors.response.use(
  (response) => response.data,
  (error) => {
    // 错误处理
    if (error.response?.status === 401) {
      // 跳转到登录页
    }
    return Promise.reject(error);
  }
);
```

### 5.3 流式响应处理

**聊天流式响应** (src/utils/next-request.ts):

```typescript
import { EventSourceParserStream } from 'eventsource-parser/stream';

export async function* streamChat(url: string, body: any) {
  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });

  const stream = response.body
    .pipeThrough(new TextDecoderStream())
    .pipeThrough(new EventSourceParserStream());

  for await (const event of stream) {
    if (event.data) {
      yield JSON.parse(event.data);
    }
  }
}
```

## 6. Agent Canvas 架构

### 6.1 React Flow 集成

**核心库**: `@xyflow/react` (React Flow v12)

**Canvas 组件** (pages/agent/canvas/index.tsx):
```typescript
import { ReactFlow, Background, Controls, MiniMap } from '@xyflow/react';
import '@xyflow/react/dist/style.css';

const Canvas = () => {
  const { nodes, edges, onNodesChange, onEdgesChange } = useAgentStore();

  return (
    <ReactFlow
      nodes={nodes}
      edges={edges}
      onNodesChange={onNodesChange}
      onEdgesChange={onEdgesChange}
      nodeTypes={nodeTypes}
      edgeTypes={edgeTypes}
    >
      <Background />
      <Controls />
      <MiniMap />
    </ReactFlow>
  );
};
```

### 6.2 节点系统

**自定义节点组件**:
- 每个节点类型一个组件 (begin-node.tsx, llm-node.tsx 等)
- 统一注册到 `nodeTypes` 对象

**节点结构**:
```typescript
interface Node {
  id: string;
  type: string;
  position: { x: number; y: number };
  data: {
    label: string;
    form: any; // 节点配置
    // ...
  };
}
```

**节点组件示例** (pages/agent/canvas/node/begin-node.tsx):
```typescript
import { Handle, Position } from '@xyflow/react';

const BeginNode = ({ data }: NodeProps) => {
  return (
    <div className="begin-node">
      <div className="node-header">{data.label}</div>
      <Handle type="source" position={Position.Right} />
    </div>
  );
};

export default memo(BeginNode);
```

### 6.3 边系统

**自定义边组件** (pages/agent/canvas/edge/index.tsx):
```typescript
import { BaseEdge, EdgeLabelRenderer, getSmoothStepPath } from '@xyflow/react';

const CustomEdge = ({ id, sourceX, sourceY, targetX, targetY }: EdgeProps) => {
  const [edgePath] = getSmoothStepPath({
    sourceX,
    sourceY,
    targetX,
    targetY,
  });

  return (
    <>
      <BaseEdge path={edgePath} />
      <EdgeLabelRenderer>
        {/* 边标签 */}
      </EdgeLabelRenderer>
    </>
  );
};
```

### 6.4 表单系统

**节点配置表单**:
- 每个节点类型对应一个表单组件 (pages/agent/form/*)
- 使用 `react-hook-form` + `zod` 验证
- 表单数据保存在节点的 `data.form` 字段

**表单侧边栏** (pages/agent/form-sheet/next.tsx):
```typescript
import { Sheet, SheetContent } from '@/components/ui/sheet';

const FormSheet = () => {
  const { selectedNode } = useAgentStore();
  const FormComponent = formConfigMap[selectedNode?.type];

  return (
    <Sheet open={!!selectedNode}>
      <SheetContent>
        {FormComponent && <FormComponent node={selectedNode} />}
      </SheetContent>
    </Sheet>
  );
};
```

### 6.5 DSL 构建

**从 Canvas 构建 DSL** (hooks/use-build-dsl.ts):

```typescript
const buildDSL = (nodes: Node[], edges: Edge[]) => {
  const dsl = {
    components: {},
    history: [],
    path: [],
  };

  // 构建组件
  nodes.forEach(node => {
    dsl.components[node.id] = {
      obj: {
        component_name: node.type,
        params: node.data.form,
      },
      downstream: edges
        .filter(e => e.source === node.id)
        .map(e => e.target),
    };
  });

  return dsl;
};
```

## 7. 表单系统

### 7.1 react-hook-form + Zod

**表单定义**:
```typescript
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';

const schema = z.object({
  name: z.string().min(1, '名称不能为空'),
  description: z.string().optional(),
});

type FormValues = z.infer<typeof schema>;

const MyForm = () => {
  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      name: '',
      description: '',
    },
  });

  const onSubmit = (data: FormValues) => {
    // 提交表单
  };

  return (
    <form onSubmit={form.handleSubmit(onSubmit)}>
      <input {...form.register('name')} />
      <textarea {...form.register('description')} />
      <button type="submit">提交</button>
    </form>
  );
};
```

### 7.2 动态表单

**动态字段** (如 Agent 工具配置):

```typescript
import { useFieldArray } from 'react-hook-form';

const DynamicForm = () => {
  const { fields, append, remove } = useFieldArray({
    control: form.control,
    name: 'tools',
  });

  return (
    <div>
      {fields.map((field, index) => (
        <div key={field.id}>
          <input {...form.register(`tools.${index}.name`)} />
          <button onClick={() => remove(index)}>删除</button>
        </div>
      ))}
      <button onClick={() => append({ name: '' })}>添加</button>
    </div>
  );
};
```

## 8. Markdown 渲染

### 8.1 react-markdown

**基础渲染** (pages/chat/markdown-content/index.tsx):

```typescript
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import remarkMath from 'remark-math';
import rehypeKatex from 'rehype-katex';
import rehypeRaw from 'rehype-raw';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';

const MarkdownContent = ({ content }: { content: string }) => {
  return (
    <ReactMarkdown
      remarkPlugins={[remarkGfm, remarkMath]}
      rehypePlugins={[rehypeKatex, rehypeRaw]}
      components={{
        code({ node, inline, className, children, ...props }) {
          const match = /language-(\w+)/.exec(className || '');
          return !inline && match ? (
            <SyntaxHighlighter language={match[1]} {...props}>
              {String(children).replace(/\n$/, '')}
            </SyntaxHighlighter>
          ) : (
            <code className={className} {...props}>
              {children}
            </code>
          );
        },
      }}
    >
      {content}
    </ReactMarkdown>
  );
};
```

### 8.2 Lexical 编辑器

**富文本编辑** (pages/agent/form/components/prompt-editor/index.tsx):

```typescript
import { LexicalComposer } from '@lexical/react/LexicalComposer';
import { RichTextPlugin } from '@lexical/react/LexicalRichTextPlugin';
import { ContentEditable } from '@lexical/react/LexicalContentEditable';

const PromptEditor = () => {
  const initialConfig = {
    namespace: 'PromptEditor',
    theme: editorTheme,
    nodes: [VariableNode],
    onError: (error) => console.error(error),
  };

  return (
    <LexicalComposer initialConfig={initialConfig}>
      <RichTextPlugin
        contentEditable={<ContentEditable />}
        placeholder={<div>输入 Prompt...</div>}
      />
      <VariablePickerPlugin />
    </LexicalComposer>
  );
};
```

## 9. 国际化 (i18n)

### 9.1 i18next 配置 (src/locales/config.ts)

```typescript
import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import LanguageDetector from 'i18next-browser-languagedetector';

import en from './en';
import zh from './zh';
// ... 其他语言

i18n
  .use(LanguageDetector)
  .use(initReactI18next)
  .init({
    resources: {
      en: { translation: en },
      zh: { translation: zh },
      // ...
    },
    fallbackLng: 'en',
    interpolation: {
      escapeValue: false,
    },
  });

export default i18n;
```

### 9.2 使用翻译

```typescript
import { useTranslation } from 'react-i18next';

const MyComponent = () => {
  const { t } = useTranslation();

  return <div>{t('common.hello')}</div>;
};
```

### 9.3 语言切换

```typescript
import { useTranslation } from 'react-i18next';

const LanguageSwitcher = () => {
  const { i18n } = useTranslation();

  return (
    <select value={i18n.language} onChange={(e) => i18n.changeLanguage(e.target.value)}>
      <option value="en">English</option>
      <option value="zh">简体中文</option>
      <option value="ja">日本語</option>
      {/* ... */}
    </select>
  );
};
```

## 10. 构建和部署

### 10.1 开发模式

```bash
npm run dev
# 访问 http://localhost:8000
```

### 10.2 生产构建

```bash
npm run build
# 生成 dist/ 目录
```

### 10.3 环境变量

- `.env`: 通用环境变量
- `.env.development`: 开发环境
- `.env.production`: 生产环境

**访问**:
```typescript
const apiUrl = process.env.API_URL;
```

### 10.4 Nginx 配置

生产部署使用 Nginx 代理:

```nginx
server {
  listen 80;
  server_name example.com;

  root /path/to/ragflow/web/dist;
  index index.html;

  location / {
    try_files $uri $uri/ /index.html;
  }

  location /api {
    proxy_pass http://127.0.0.1:9380;
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
  }
}
```

## 11. 性能优化

### 11.1 代码分割

- UmiJS 自动按路由分割代码
- 动态导入: `const Component = lazy(() => import('./Component'))`

### 11.2 React Query 缓存

- 合理设置 `staleTime` 和 `cacheTime`
- 使用 `keepPreviousData` 保持旧数据

### 11.3 虚拟化列表

对于大数据集,使用虚拟化:

```typescript
import { VirtualList } from '@ant-design/pro-components';

<VirtualList
  data={dataSource}
  itemHeight={50}
  renderItem={(item) => <div>{item.name}</div>}
/>
```

### 11.4 Memo 优化

```typescript
import { memo } from 'react';

const ExpensiveComponent = memo(({ data }) => {
  // 昂贵的渲染逻辑
  return <div>{/* ... */}</div>;
});
```

## 12. 测试

### 12.1 Jest 配置

```bash
npm test
```

**测试文件位置**:
- `*.test.ts`
- `*.test.tsx`
- `__tests__/` 目录

### 12.2 测试示例

```typescript
import { render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';
import MyComponent from './MyComponent';

test('renders component', () => {
  render(<MyComponent />);
  expect(screen.getByText('Hello')).toBeInTheDocument();
});
```

## 13. Storybook

### 13.1 运行 Storybook

```bash
npm run storybook
# 访问 http://localhost:6006
```

### 13.2 Story 示例 (src/stories/button.stories.ts)

```typescript
import type { Meta, StoryObj } from '@storybook/react';
import { Button } from '@/components/ui/button';

const meta: Meta<typeof Button> = {
  title: 'UI/Button',
  component: Button,
};

export default meta;
type Story = StoryObj<typeof Button>;

export const Primary: Story = {
  args: {
    children: 'Button',
    variant: 'default',
  },
};
```

---

**下一文档**: 04-database-models.md (数据库模型详细分析)
