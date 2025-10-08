#!/bin/bash
# Docker环境迁移脚本执行工具
# 用法: ./run_migration.sh <migration_number> [--dry-run]

set -e

MIGRATION_NUMBER=$1
DRY_RUN_FLAG=$2

if [ -z "$MIGRATION_NUMBER" ]; then
    echo "错误: 请指定迁移脚本编号"
    echo "用法: ./run_migration.sh 006 [--dry-run]"
    exit 1
fi

# 格式化迁移脚本名称
MIGRATION_SCRIPT="api/db/migrations/${MIGRATION_NUMBER}_*.py"

echo "=========================================="
echo "RAGFlow 迁移脚本执行工具"
echo "=========================================="
echo "容器: ragflow"
echo "迁移脚本: ${MIGRATION_SCRIPT}"
echo "模式: ${DRY_RUN_FLAG:-production}"
echo "=========================================="
echo ""

# 检查容器是否运行
if ! docker compose ps ragflow | grep -q "Up"; then
    echo "❌ 错误: ragflow 容器未运行"
    echo "请先启动容器: docker compose up -d"
    exit 1
fi

echo "✅ 容器状态正常"
echo ""

# 列出匹配的迁移脚本
echo "📋 查找迁移脚本..."
SCRIPT_PATH=$(docker compose exec -T ragflow bash -c "ls ${MIGRATION_SCRIPT} 2>/dev/null | head -1")

if [ -z "$SCRIPT_PATH" ]; then
    echo "❌ 错误: 未找到迁移脚本 ${MIGRATION_SCRIPT}"
    echo ""
    echo "可用的迁移脚本:"
    docker compose exec -T ragflow bash -c "ls /ragflow/api/db/migrations/*.py 2>/dev/null"
    exit 1
fi

echo "✅ 找到脚本: $SCRIPT_PATH"
echo ""

# 备份提示
if [ "$DRY_RUN_FLAG" != "--dry-run" ]; then
    echo "⚠️  警告: 即将执行生产模式迁移"
    echo ""
    echo "强烈建议先备份数据库:"
    echo "  ./backup_database.sh"
    echo ""
    read -p "是否继续？(yes/no): " CONFIRM
    if [ "$CONFIRM" != "yes" ]; then
        echo "已取消"
        exit 0
    fi
fi

# 执行迁移
echo ""
echo "🚀 开始执行迁移..."
echo "=========================================="

docker compose exec -T ragflow python $SCRIPT_PATH $DRY_RUN_FLAG

EXIT_CODE=$?

echo "=========================================="
if [ $EXIT_CODE -eq 0 ]; then
    echo "✅ 迁移执行成功"
else
    echo "❌ 迁移执行失败 (退出码: $EXIT_CODE)"
    exit $EXIT_CODE
fi

echo ""
echo "📝 建议: 检查日志确认结果"
echo "  docker compose logs ragflow --tail 50"
