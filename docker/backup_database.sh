#!/bin/bash
# Docker环境数据库备份脚本

set -e

BACKUP_DIR="./backups"
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
BACKUP_FILE="${BACKUP_DIR}/ragflow_backup_${TIMESTAMP}.sql"

echo "=========================================="
echo "RAGFlow 数据库备份工具"
echo "=========================================="
echo "时间: $(date)"
echo "备份文件: $BACKUP_FILE"
echo "=========================================="
echo ""

# 创建备份目录
mkdir -p "$BACKUP_DIR"

# 从docker-compose.yml读取数据库配置
source .env

MYSQL_HOST=${MYSQL_HOST:-mysql}
MYSQL_PORT=${MYSQL_PORT:-3306}
MYSQL_USER=${MYSQL_USER:-root}
MYSQL_PASSWORD=${MYSQL_PASSWORD}
MYSQL_DATABASE=${MYSQL_DATABASE:-rag_flow}

echo "📋 数据库信息:"
echo "  主机: $MYSQL_HOST"
echo "  端口: $MYSQL_PORT"
echo "  用户: $MYSQL_USER"
echo "  数据库: $MYSQL_DATABASE"
echo ""

# 检查MySQL容器是否运行
if ! docker compose ps mysql | grep -q "Up"; then
    echo "❌ 错误: MySQL 容器未运行"
    exit 1
fi

echo "✅ MySQL容器运行正常"
echo ""

# 执行备份
echo "🚀 开始备份..."
docker compose exec -T mysql mysqldump \
    -u"$MYSQL_USER" \
    -p"$MYSQL_PASSWORD" \
    "$MYSQL_DATABASE" > "$BACKUP_FILE"

EXIT_CODE=$?

if [ $EXIT_CODE -eq 0 ]; then
    # 获取备份文件大小
    BACKUP_SIZE=$(ls -lh "$BACKUP_FILE" | awk '{print $5}')
    echo ""
    echo "✅ 备份成功"
    echo "  文件: $BACKUP_FILE"
    echo "  大小: $BACKUP_SIZE"
    echo ""
    echo "📝 保留策略: 建议保留至少7天"
    echo ""
    echo "🔄 恢复备份: ./restore_database.sh $BACKUP_FILE"
else
    echo ""
    echo "❌ 备份失败 (退出码: $EXIT_CODE)"
    rm -f "$BACKUP_FILE"
    exit $EXIT_CODE
fi
