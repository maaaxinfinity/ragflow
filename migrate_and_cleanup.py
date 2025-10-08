#!/usr/bin/env python3
"""
数据库迁移与清理脚本
功能：
1. 执行 model_card_id 字段迁移
2. 清理未迁移的对话数据
3. 验证迁移结果
"""

import argparse
import logging
import sys
from pathlib import Path

# 添加项目根目录到 Python 路径
project_root = Path(__file__).parent
sys.path.insert(0, str(project_root))

from api.db import database
from api.db.db_models import Conversation, FreeChatUserSettings
from playhouse.migrate import MySQLMigrator, PostgresqlMigrator, migrate
from peewee import IntegerField, IntegrityError

# 配置日志
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)


def get_migrator():
    """根据数据库类型获取迁移器"""
    db = database.DB
    db_type = db.__class__.__name__
    
    if 'MySQL' in db_type:
        logger.info("检测到 MySQL 数据库")
        return MySQLMigrator(db)
    elif 'Postgres' in db_type:
        logger.info("检测到 PostgreSQL 数据库")
        return PostgresqlMigrator(db)
    else:
        raise ValueError(f"不支持的数据库类型: {db_type}")


def check_column_exists(table_name: str, column_name: str) -> bool:
    """检查表中是否存在指定列"""
    db = database.DB
    cursor = db.cursor()
    
    try:
        # MySQL 查询
        if 'MySQL' in db.__class__.__name__:
            cursor.execute(f"""
                SELECT COUNT(*) 
                FROM information_schema.COLUMNS 
                WHERE TABLE_SCHEMA = DATABASE() 
                AND TABLE_NAME = %s 
                AND COLUMN_NAME = %s
            """, (table_name, column_name))
        # PostgreSQL 查询
        else:
            cursor.execute(f"""
                SELECT COUNT(*) 
                FROM information_schema.columns 
                WHERE table_name = %s 
                AND column_name = %s
            """, (table_name, column_name))
        
        result = cursor.fetchone()
        return result[0] > 0
    finally:
        cursor.close()


def add_model_card_id_column(dry_run: bool = False):
    """
    添加 model_card_id 列到 conversation 表
    
    Args:
        dry_run: 如果为 True，只打印将要执行的操作，不实际执行
    """
    logger.info("=" * 60)
    logger.info("步骤 1: 添加 model_card_id 列到 conversation 表")
    logger.info("=" * 60)
    
    # 检查列是否已存在
    if check_column_exists('conversation', 'model_card_id'):
        logger.info("✓ model_card_id 列已存在，跳过迁移")
        return True
    
    if dry_run:
        logger.info("[DRY RUN] 将执行以下操作:")
        logger.info("  - ALTER TABLE conversation ADD COLUMN model_card_id INT NULL")
        logger.info("  - CREATE INDEX idx_conversation_model_card_id ON conversation(model_card_id)")
        return True
    
    try:
        db = database.DB
        migrator = get_migrator()
        
        # 添加 model_card_id 列
        logger.info("正在添加 model_card_id 列...")
        with db.atomic():
            migrate(
                migrator.add_column('conversation', 'model_card_id', IntegerField(null=True))
            )
        
        # 添加索引
        logger.info("正在添加索引...")
        cursor = db.cursor()
        try:
            cursor.execute("CREATE INDEX idx_conversation_model_card_id ON conversation(model_card_id)")
            db.commit()
        except Exception as e:
            # 索引可能已存在
            logger.warning(f"索引创建跳过: {e}")
        finally:
            cursor.close()
        
        logger.info("✓ 成功添加 model_card_id 列和索引")
        return True
        
    except Exception as e:
        logger.error(f"✗ 迁移失败: {e}")
        return False


def cleanup_unmigrated_conversations(dry_run: bool = False, cleanup_all: bool = False):
    """
    清理未迁移的对话数据
    
    Args:
        dry_run: 如果为 True，只统计不删除
        cleanup_all: 如果为 True，删除所有 model_card_id 为 NULL 的记录
    """
    logger.info("=" * 60)
    logger.info("步骤 2: 清理未迁移的对话数据")
    logger.info("=" * 60)
    
    try:
        # 统计需要清理的记录
        unmigrated_count = Conversation.select().where(
            Conversation.model_card_id.is_null()
        ).count()
        
        logger.info(f"找到 {unmigrated_count} 条 model_card_id 为 NULL 的对话记录")
        
        if unmigrated_count == 0:
            logger.info("✓ 没有需要清理的记录")
            return True
        
        if dry_run:
            logger.info("[DRY RUN] 将删除以下记录:")
            for conv in Conversation.select().where(
                Conversation.model_card_id.is_null()
            ).limit(10):
                logger.info(f"  - Conversation ID: {conv.id}, Dialog: {conv.dialog_id}, User: {conv.user_id}")
            
            if unmigrated_count > 10:
                logger.info(f"  ... 还有 {unmigrated_count - 10} 条记录")
            
            return True
        
        if not cleanup_all:
            confirm = input(f"\n⚠️  将删除 {unmigrated_count} 条记录，是否继续? (yes/no): ")
            if confirm.lower() not in ['yes', 'y']:
                logger.info("取消清理操作")
                return False
        
        # 删除记录
        logger.info("正在删除未迁移的对话记录...")
        deleted_count = Conversation.delete().where(
            Conversation.model_card_id.is_null()
        ).execute()
        
        logger.info(f"✓ 成功删除 {deleted_count} 条记录")
        return True
        
    except Exception as e:
        logger.error(f"✗ 清理失败: {e}")
        return False


def cleanup_freechat_sessions(dry_run: bool = False, cleanup_all: bool = False):
    """
    清理 FreeChatUserSettings 中的无效会话
    删除 conversation_id 指向已删除对话的会话
    
    Args:
        dry_run: 如果为 True，只统计不删除
        cleanup_all: 如果为 True，自动确认删除
    """
    logger.info("=" * 60)
    logger.info("步骤 3: 清理 FreeChat 会话数据")
    logger.info("=" * 60)
    
    try:
        # 获取所有有效的 conversation_id
        valid_conv_ids = set(
            conv.id for conv in Conversation.select(Conversation.id)
        )
        
        total_cleaned = 0
        total_users = 0
        
        for setting in FreeChatUserSettings.select():
            sessions = setting.sessions or []
            original_count = len(sessions)
            
            # 过滤掉无效的会话
            valid_sessions = [
                session for session in sessions
                if not session.get('conversation_id') or session['conversation_id'] in valid_conv_ids
            ]
            
            cleaned_count = original_count - len(valid_sessions)
            
            if cleaned_count > 0:
                total_users += 1
                total_cleaned += cleaned_count
                
                logger.info(f"用户 {setting.user_id}: 清理 {cleaned_count}/{original_count} 个无效会话")
                
                if not dry_run:
                    setting.sessions = valid_sessions
                    setting.save()
        
        if total_cleaned == 0:
            logger.info("✓ 没有需要清理的会话")
        else:
            logger.info(f"✓ 共清理 {total_users} 个用户的 {total_cleaned} 个无效会话")
        
        return True
        
    except Exception as e:
        logger.error(f"✗ 会话清理失败: {e}")
        return False


def verify_migration():
    """验证迁移结果"""
    logger.info("=" * 60)
    logger.info("步骤 4: 验证迁移结果")
    logger.info("=" * 60)
    
    try:
        # 检查列是否存在
        has_column = check_column_exists('conversation', 'model_card_id')
        
        if not has_column:
            logger.error("✗ model_card_id 列不存在")
            return False
        
        logger.info("✓ model_card_id 列存在")
        
        # 统计数据
        total_count = Conversation.select().count()
        null_count = Conversation.select().where(
            Conversation.model_card_id.is_null()
        ).count()
        with_card_count = total_count - null_count
        
        logger.info(f"✓ 数据统计:")
        logger.info(f"  - 总对话数: {total_count}")
        logger.info(f"  - 已关联 Model Card: {with_card_count}")
        logger.info(f"  - 未关联 Model Card: {null_count}")
        
        return True
        
    except Exception as e:
        logger.error(f"✗ 验证失败: {e}")
        return False


def main():
    parser = argparse.ArgumentParser(
        description="RAGFlow 数据库迁移与清理脚本",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
使用示例:

1. 预览迁移操作（不执行）:
   python migrate_and_cleanup.py --dry-run

2. 仅执行迁移，不清理数据:
   python migrate_and_cleanup.py --migrate-only

3. 执行迁移并清理数据:
   python migrate_and_cleanup.py

4. 仅清理数据（假设已迁移）:
   python migrate_and_cleanup.py --cleanup-only

5. 自动确认所有操作:
   python migrate_and_cleanup.py --yes
        """
    )
    
    parser.add_argument(
        '--dry-run',
        action='store_true',
        help='预览模式：只显示将要执行的操作，不实际修改数据库'
    )
    
    parser.add_argument(
        '--migrate-only',
        action='store_true',
        help='仅执行迁移，不清理数据'
    )
    
    parser.add_argument(
        '--cleanup-only',
        action='store_true',
        help='仅清理数据，跳过迁移步骤'
    )
    
    parser.add_argument(
        '--yes', '-y',
        action='store_true',
        help='自动确认所有操作，不需要手动输入'
    )
    
    args = parser.parse_args()
    
    logger.info("=" * 60)
    logger.info("RAGFlow Model Card 数据库迁移与清理")
    logger.info("=" * 60)
    
    if args.dry_run:
        logger.info("⚠️  预览模式：不会修改任何数据")
        logger.info("")
    
    try:
        # 步骤 1: 添加 model_card_id 列
        if not args.cleanup_only:
            success = add_model_card_id_column(dry_run=args.dry_run)
            if not success:
                logger.error("迁移失败，终止操作")
                return 1
        
        # 步骤 2 & 3: 清理数据
        if not args.migrate_only:
            success = cleanup_unmigrated_conversations(
                dry_run=args.dry_run,
                cleanup_all=args.yes
            )
            if not success:
                logger.error("对话清理失败")
                return 1
            
            success = cleanup_freechat_sessions(
                dry_run=args.dry_run,
                cleanup_all=args.yes
            )
            if not success:
                logger.error("会话清理失败")
                return 1
        
        # 步骤 4: 验证
        if not args.dry_run:
            success = verify_migration()
            if not success:
                logger.error("验证失败")
                return 1
        
        logger.info("")
        logger.info("=" * 60)
        logger.info("✓ 所有操作完成")
        logger.info("=" * 60)
        
        if args.dry_run:
            logger.info("")
            logger.info("这是预览模式，实际运行请去掉 --dry-run 参数:")
            logger.info("  python migrate_and_cleanup.py")
        
        return 0
        
    except Exception as e:
        logger.error(f"发生错误: {e}", exc_info=True)
        return 1


if __name__ == '__main__':
    sys.exit(main())
