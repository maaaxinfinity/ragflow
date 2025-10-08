#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
简化版数据库迁移脚本
直接使用 SQL 执行迁移，不依赖 RAGFlow 的其他模块
"""

import argparse
import os
import sys
from pathlib import Path

# Windows 控制台编码修复
if sys.platform == 'win32':
    import codecs
    if sys.stdout.encoding != 'utf-8':
        sys.stdout = codecs.getwriter('utf-8')(sys.stdout.buffer, 'strict')
    if sys.stderr.encoding != 'utf-8':
        sys.stderr = codecs.getwriter('utf-8')(sys.stderr.buffer, 'strict')

try:
    import pymysql
    import pymysql.cursors
except ImportError:
    print("错误: 缺少 pymysql 模块")
    print("请安装: pip install pymysql")
    sys.exit(1)


def get_db_config_from_env():
    """从环境变量获取数据库配置"""
    # 尝试从 docker/.env 文件读取
    env_file = Path(__file__).parent / "docker" / ".env"
    
    config = {
        'host': 'localhost',
        'port': 3306,
        'user': 'root',
        'password': '',
        'database': 'rag_flow',
        'charset': 'utf8mb4',
    }
    
    # 从环境变量读取
    config['host'] = os.getenv('MYSQL_HOST', 'localhost')
    config['port'] = int(os.getenv('MYSQL_PORT', 3306))
    config['user'] = os.getenv('MYSQL_USER', 'root')
    config['password'] = os.getenv('MYSQL_PASSWORD', '')
    config['database'] = os.getenv('MYSQL_DATABASE', 'rag_flow')
    
    # 如果环境变量为空，尝试从 .env 文件读取
    if env_file.exists() and not config['password']:
        print(f"从 {env_file} 读取数据库配置...")
        with open(env_file, 'r', encoding='utf-8') as f:
            for line in f:
                line = line.strip()
                if line.startswith('#') or '=' not in line:
                    continue
                key, value = line.split('=', 1)
                key = key.strip()
                value = value.strip().strip('"').strip("'")
                
                if key == 'MYSQL_HOST':
                    config['host'] = value
                elif key == 'MYSQL_PORT':
                    config['port'] = int(value)
                elif key == 'MYSQL_USER':
                    config['user'] = value
                elif key == 'MYSQL_PASSWORD':
                    config['password'] = value
                elif key == 'MYSQL_DATABASE':
                    config['database'] = value
    
    return config


def check_column_exists(cursor, table_name, column_name):
    """检查列是否存在"""
    cursor.execute("""
        SELECT COUNT(*) 
        FROM information_schema.COLUMNS 
        WHERE TABLE_SCHEMA = DATABASE() 
        AND TABLE_NAME = %s 
        AND COLUMN_NAME = %s
    """, (table_name, column_name))
    result = cursor.fetchone()
    return result[0] > 0


def check_index_exists(cursor, table_name, index_name):
    """检查索引是否存在"""
    cursor.execute("""
        SELECT COUNT(*) 
        FROM information_schema.STATISTICS 
        WHERE TABLE_SCHEMA = DATABASE() 
        AND TABLE_NAME = %s 
        AND INDEX_NAME = %s
    """, (table_name, index_name))
    result = cursor.fetchone()
    return result[0] > 0


def add_model_card_id_column(connection, dry_run=False):
    """添加 model_card_id 列"""
    print("=" * 60)
    print("步骤 1: 添加 model_card_id 列到 conversation 表")
    print("=" * 60)
    
    cursor = connection.cursor()
    
    try:
        # 检查列是否已存在
        if check_column_exists(cursor, 'conversation', 'model_card_id'):
            print("✓ model_card_id 列已存在，跳过迁移")
            return True
        
        if dry_run:
            print("[DRY RUN] 将执行以下操作:")
            print("  - ALTER TABLE conversation ADD COLUMN model_card_id INT NULL")
            print("  - CREATE INDEX idx_conversation_model_card_id ON conversation(model_card_id)")
            return True
        
        # 添加列
        print("正在添加 model_card_id 列...")
        cursor.execute("ALTER TABLE conversation ADD COLUMN model_card_id INT NULL")
        connection.commit()
        print("✓ 成功添加 model_card_id 列")
        
        # 添加索引
        print("正在添加索引...")
        if not check_index_exists(cursor, 'conversation', 'idx_conversation_model_card_id'):
            cursor.execute("CREATE INDEX idx_conversation_model_card_id ON conversation(model_card_id)")
            connection.commit()
            print("✓ 成功添加索引")
        else:
            print("✓ 索引已存在")
        
        return True
        
    except Exception as e:
        print(f"✗ 迁移失败: {e}")
        connection.rollback()
        return False
    finally:
        cursor.close()


def get_statistics(connection):
    """获取数据统计"""
    cursor = connection.cursor()
    
    try:
        # 总对话数
        cursor.execute("SELECT COUNT(*) FROM conversation")
        total_count = cursor.fetchone()[0]
        
        # NULL 数量
        cursor.execute("SELECT COUNT(*) FROM conversation WHERE model_card_id IS NULL")
        null_count = cursor.fetchone()[0]
        
        with_card_count = total_count - null_count
        
        return {
            'total': total_count,
            'with_card': with_card_count,
            'null': null_count
        }
    finally:
        cursor.close()


def cleanup_null_conversations(connection, dry_run=False, auto_confirm=False):
    """清理 model_card_id 为 NULL 的对话"""
    print("\n" + "=" * 60)
    print("步骤 2: 清理未迁移的对话数据")
    print("=" * 60)
    
    cursor = connection.cursor(pymysql.cursors.DictCursor)
    
    try:
        # 统计数量
        cursor.execute("SELECT COUNT(*) as count FROM conversation WHERE model_card_id IS NULL")
        null_count = cursor.fetchone()['count']
        
        print(f"找到 {null_count} 条 model_card_id 为 NULL 的对话记录")
        
        if null_count == 0:
            print("✓ 没有需要清理的记录")
            return True
        
        if dry_run:
            print("[DRY RUN] 将删除以下记录:")
            cursor.execute("""
                SELECT id, dialog_id, user_id, name 
                FROM conversation 
                WHERE model_card_id IS NULL 
                LIMIT 10
            """)
            for row in cursor.fetchall():
                print(f"  - Conversation ID: {row['id']}, Dialog: {row['dialog_id']}, User: {row['user_id']}, Name: {row['name']}")
            
            if null_count > 10:
                print(f"  ... 还有 {null_count - 10} 条记录")
            
            return True
        
        if not auto_confirm:
            confirm = input(f"\n⚠️  将删除 {null_count} 条记录，是否继续? (yes/no): ")
            if confirm.lower() not in ['yes', 'y']:
                print("取消清理操作")
                return False
        
        # 删除记录
        print("正在删除未迁移的对话记录...")
        cursor.execute("DELETE FROM conversation WHERE model_card_id IS NULL")
        connection.commit()
        deleted_count = cursor.rowcount
        
        print(f"✓ 成功删除 {deleted_count} 条记录")
        return True
        
    except Exception as e:
        print(f"✗ 清理失败: {e}")
        connection.rollback()
        return False
    finally:
        cursor.close()


def verify_migration(connection):
    """验证迁移结果"""
    print("\n" + "=" * 60)
    print("步骤 3: 验证迁移结果")
    print("=" * 60)
    
    cursor = connection.cursor()
    
    try:
        # 检查列是否存在
        has_column = check_column_exists(cursor, 'conversation', 'model_card_id')
        
        if not has_column:
            print("✗ model_card_id 列不存在")
            return False
        
        print("✓ model_card_id 列存在")
        
        # 获取统计数据
        stats = get_statistics(connection)
        
        print(f"✓ 数据统计:")
        print(f"  - 总对话数: {stats['total']}")
        print(f"  - 已关联 Model Card: {stats['with_card']}")
        print(f"  - 未关联 Model Card: {stats['null']}")
        
        return True
        
    except Exception as e:
        print(f"✗ 验证失败: {e}")
        return False
    finally:
        cursor.close()


def main():
    parser = argparse.ArgumentParser(
        description="RAGFlow Model Card 数据库迁移脚本（简化版）",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
使用示例:

1. 预览迁移操作:
   python simple_migrate.py --dry-run

2. 执行迁移并清理数据:
   python simple_migrate.py --yes

3. 仅执行迁移:
   python simple_migrate.py --migrate-only

4. 手动指定数据库:
   python simple_migrate.py --host localhost --port 3306 --user root --password xxx --database rag_flow
        """
    )
    
    parser.add_argument('--dry-run', action='store_true', help='预览模式')
    parser.add_argument('--migrate-only', action='store_true', help='仅执行迁移')
    parser.add_argument('--cleanup-only', action='store_true', help='仅清理数据')
    parser.add_argument('--yes', '-y', action='store_true', help='自动确认')
    
    parser.add_argument('--host', help='数据库主机')
    parser.add_argument('--port', type=int, help='数据库端口')
    parser.add_argument('--user', help='数据库用户名')
    parser.add_argument('--password', help='数据库密码')
    parser.add_argument('--database', help='数据库名称')
    
    args = parser.parse_args()
    
    print("=" * 60)
    print("RAGFlow Model Card 数据库迁移")
    print("=" * 60)
    print()
    
    if args.dry_run:
        print("⚠️  预览模式：不会修改任何数据\n")
    
    # 获取数据库配置
    config = get_db_config_from_env()
    
    # 命令行参数覆盖
    if args.host:
        config['host'] = args.host
    if args.port:
        config['port'] = args.port
    if args.user:
        config['user'] = args.user
    if args.password:
        config['password'] = args.password
    if args.database:
        config['database'] = args.database
    
    print(f"数据库配置:")
    print(f"  主机: {config['host']}:{config['port']}")
    print(f"  用户: {config['user']}")
    print(f"  数据库: {config['database']}")
    print()
    
    # 连接数据库
    try:
        connection = pymysql.connect(**config)
        print("✓ 数据库连接成功\n")
    except Exception as e:
        print(f"✗ 数据库连接失败: {e}")
        return 1
    
    try:
        # 步骤 1: 添加列
        if not args.cleanup_only:
            success = add_model_card_id_column(connection, dry_run=args.dry_run)
            if not success:
                return 1
        
        # 步骤 2: 清理数据
        if not args.migrate_only:
            success = cleanup_null_conversations(
                connection,
                dry_run=args.dry_run,
                auto_confirm=args.yes
            )
            if not success:
                return 1
        
        # 步骤 3: 验证
        if not args.dry_run:
            success = verify_migration(connection)
            if not success:
                return 1
        
        print("\n" + "=" * 60)
        print("✓ 所有操作完成")
        print("=" * 60)
        
        if args.dry_run:
            print("\n这是预览模式，实际运行请去掉 --dry-run 参数:")
            print("  python simple_migrate.py --yes")
        
        return 0
        
    except Exception as e:
        print(f"\n✗ 发生错误: {e}")
        import traceback
        traceback.print_exc()
        return 1
    finally:
        connection.close()


if __name__ == '__main__':
    sys.exit(main())
