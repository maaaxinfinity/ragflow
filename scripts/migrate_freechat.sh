#!/bin/bash
#
# FreeChat 数据迁移便捷脚本
# 自动在 Docker 容器内执行迁移
#

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"

# 颜色输出
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo_info() {
    echo -e "${GREEN}[INFO]${NC} $1"
}

echo_warn() {
    echo -e "${YELLOW}[WARN]${NC} $1"
}

echo_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# 查找 ragflow-server 容器
find_container() {
    # 尝试多种容器名称
    local container_names=(
        "ragflow-server"
        "ragflow_ragflow-server_1"
        "ragflow-ragflow-server-1"
    )
    
    for name in "${container_names[@]}"; do
        if docker ps --format '{{.Names}}' | grep -q "^${name}$"; then
            echo "$name"
            return 0
        fi
    done
    
    # 如果找不到，尝试通过镜像名查找
    local container_id=$(docker ps --filter "ancestor=infiniflow/ragflow" --format '{{.Names}}' | head -n 1)
    if [ -n "$container_id" ]; then
        echo "$container_id"
        return 0
    fi
    
    return 1
}

# 主函数
main() {
    local verify_only=0
    
    # 解析参数
    if [[ "$1" == "--verify-only" ]]; then
        verify_only=1
    fi
    
    echo_info "===== FreeChat 数据迁移脚本 ====="
    echo ""
    
    # 查找容器
    echo_info "正在查找 RAGFlow 容器..."
    local container_name=$(find_container)
    
    if [ -z "$container_name" ]; then
        echo_error "找不到运行中的 RAGFlow 容器！"
        echo_error "请确保 RAGFlow 已启动："
        echo "  docker compose -f docker/docker-compose.yml up -d"
        exit 1
    fi
    
    echo_info "找到容器: $container_name"
    echo ""
    
    # 执行迁移
    if [ $verify_only -eq 1 ]; then
        echo_info "执行验证模式（不会修改数据）..."
        docker exec -it "$container_name" python -m api.db.migrations.migrate_freechat_to_sql --verify-only
    else
        echo_warn "即将执行数据迁移！"
        echo_warn "建议先备份数据库："
        echo "  docker exec ragflow-mysql mysqldump -u ragflow -p ragflow > backup.sql"
        echo ""
        read -p "是否继续？(y/N) " -n 1 -r
        echo
        if [[ ! $REPLY =~ ^[Yy]$ ]]; then
            echo_info "已取消迁移"
            exit 0
        fi
        
        echo_info "开始迁移..."
        docker exec -it "$container_name" python -m api.db.migrations.migrate_freechat_to_sql
    fi
    
    exit_code=$?
    
    if [ $exit_code -eq 0 ]; then
        echo ""
        echo_info "===== 迁移完成 ====="
        if [ $verify_only -eq 0 ]; then
            echo_info "建议运行验证："
            echo "  bash scripts/migrate_freechat.sh --verify-only"
        fi
    else
        echo ""
        echo_error "===== 迁移失败 ====="
        exit $exit_code
    fi
}

# 显示帮助
if [[ "$1" == "-h" ]] || [[ "$1" == "--help" ]]; then
    cat << EOF
FreeChat 数据迁移脚本

用法:
  bash scripts/migrate_freechat.sh [OPTIONS]

选项:
  --verify-only    仅验证迁移结果，不执行迁移
  -h, --help       显示帮助信息

示例:
  # 执行迁移
  bash scripts/migrate_freechat.sh

  # 仅验证
  bash scripts/migrate_freechat.sh --verify-only

注意:
  - 迁移前建议备份数据库
  - 迁移脚本会在 Docker 容器内自动执行
  - 支持增量迁移，不会重复迁移已存在的数据
EOF
    exit 0
fi

# 执行主函数
main "$@"
