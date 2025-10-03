#!/bin/bash

# RAGFlow 知识库批量管理示例脚本

echo "========================================="
echo "  RAGFlow 知识库批量管理工具使用示例"
echo "========================================="
echo ""

# 配置检查
if [ ! -f .env ]; then
    echo "❌ 错误：未找到 .env 配置文件"
    echo "请先创建 .env 文件并配置 RAGFLOW_BASE_URL 和 RAGFLOW_API_KEY"
    exit 1
fi

echo "✅ 配置文件已找到"
echo ""

# ==================== 解析示例 ====================
echo "📚 解析工具 (resolve.py) 使用示例："
echo "----------------------------------------"

echo ""
echo "1️⃣  预览所有待解析的测试库（不实际执行）"
echo "   python resolve.py --only 测试 --dry-run"
echo ""

echo "2️⃣  解析特定知识库"
echo "   python resolve.py --names '法律法规测试'"
echo ""

echo "3️⃣  解析所有包含'法律'关键词的知识库"
echo "   python resolve.py --only 法律"
echo ""

echo "4️⃣  强制重新解析所有文档"
echo "   python resolve.py --names '法律法规测试' --force"
echo ""

echo "5️⃣  解析所有知识库（小批次，慢速安全）"
echo "   python resolve.py --all --batch 20"
echo ""

# ==================== 取消解析示例 ====================
echo "🗑️  取消解析工具 (cancel_parse.py) 使用示例："
echo "----------------------------------------"

echo ""
echo "1️⃣  预览将要取消解析的知识库"
echo "   python cancel_parse.py --only 测试 --dry-run"
echo ""

echo "2️⃣  取消特定知识库的解析"
echo "   python cancel_parse.py --names '法律法规测试'"
echo ""

echo "3️⃣  取消所有测试库，但保留生产库（反选）"
echo "   python cancel_parse.py --all --exclude 生产 --exclude 重要"
echo ""

echo "4️⃣  仅清理已解析的文档"
echo "   python cancel_parse.py --only 测试 --parsed-only"
echo ""

echo "5️⃣  取消所有知识库的解析（危险操作！）"
echo "   python cancel_parse.py --all --dry-run  # 先预览"
echo "   python cancel_parse.py --all            # 确认后执行"
echo ""

# ==================== 组合使用示例 ====================
echo "🔄 组合使用示例 - 完整的重置流程："
echo "----------------------------------------"

echo ""
echo "场景：重置某个知识库并重新解析"
echo ""
echo "步骤 1: 预览当前状态"
echo "   python cancel_parse.py --names '法律法规测试' --dry-run"
echo ""
echo "步骤 2: 取消当前解析"
echo "   python cancel_parse.py --names '法律法规测试'"
echo ""
echo "步骤 3: 重新解析"
echo "   python resolve.py --names '法律法规测试' --force"
echo ""

# ==================== 高级过滤示例 ====================
echo "🎯 高级过滤示例："
echo "----------------------------------------"

echo ""
echo "1️⃣  使用前缀和后缀过滤（在 .env 中配置）"
echo "   KB_NAME_PREFIX=test_"
echo "   KB_NAME_SUFFIX=_dev"
echo "   python resolve.py --all"
echo ""

echo "2️⃣  多条件组合过滤"
echo "   python resolve.py --only 法律 --only 测试  # 包含'法律'或'测试'"
echo ""

echo "3️⃣  反选排除多个关键词"
echo "   python cancel_parse.py --all --exclude 生产 --exclude 重要 --exclude 正式"
echo ""

# ==================== 性能优化示例 ====================
echo "⚡ 性能优化示例："
echo "----------------------------------------"

echo ""
echo "1️⃣  调整并发数（.env 配置）"
echo "   CONCURRENCY=16  # 提高并发（默认8）"
echo ""

echo "2️⃣  调整批次大小"
echo "   python resolve.py --all --batch 100    # 更大批次，更快"
echo "   python resolve.py --all --batch 20     # 更小批次，更安全"
echo ""

echo "3️⃣  组合优化"
echo "   # 在 .env 中设置"
echo "   CONCURRENCY=16"
echo "   PARSE_BATCH_SIZE=100"
echo "   # 然后执行"
echo "   python resolve.py --all"
echo ""

# ==================== 安全使用建议 ====================
echo "🔒 安全使用建议："
echo "----------------------------------------"

echo ""
echo "1. 永远先用 --dry-run 预览"
echo "2. 对重要库使用 --exclude 排除"
echo "3. 使用 --names 精确指定，避免误操作"
echo "4. 小批次测试后再大批量执行"
echo "5. 保留 manifest 文件作为备份"
echo ""

# ==================== 快速开始 ====================
echo "🚀 快速开始："
echo "----------------------------------------"
echo ""
echo "如果你想立即测试，运行以下命令："
echo ""
echo "# 列出所有知识库（需要先实现 list.py，或使用 API）"
echo "# curl -H 'Authorization: Bearer YOUR_API_KEY' http://localhost:9380/api/v1/datasets"
echo ""
echo "# 预览解析测试库"
echo "python resolve.py --only 测试 --dry-run"
echo ""
echo "# 执行解析"
echo "python resolve.py --only 测试"
echo ""

echo "========================================="
echo "  更多信息请查看 README.md"
echo "========================================="
