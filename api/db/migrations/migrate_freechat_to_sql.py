#!/usr/bin/env python3
#
#  Copyright 2024 The InfiniFlow Authors. All Rights Reserved.
#
#  Licensed under the Apache License, Version 2.0 (the "License");
#  you may not use this file except in compliance with the License.
#  You may obtain a copy of the License at
#
#      http://www.apache.org/licenses/LICENSE-2.0
#
#  Unless required by applicable law or agreed to in writing, software
#  distributed under the License is distributed on an "AS IS" BASIS,
#  WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
#  See the License for the specific language governing permissions and
#  limitations under the License.
#
"""
数据迁移脚本：从 FreeChatUserSettings.sessions (JSON) 迁移到独立的表结构

执行方式：
    python -m api.db.migrations.migrate_freechat_to_sql
"""

import sys
import logging
import uuid
from pathlib import Path

# 添加项目根目录到 Python 路径
project_root = Path(__file__).parent.parent.parent.parent
sys.path.insert(0, str(project_root))

from api.db.db_models import FreeChatUserSettings, FreeChatSession, FreeChatMessage, DB
from api.db.services.free_chat_session_service import FreeChatSessionService
from api.db.services.free_chat_message_service import FreeChatMessageService
from api.db.services.free_chat_user_settings_service import FreeChatUserSettingsService

logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)


def ensure_tables_exist():
    """
    确保新表存在，如果不存在则创建
    """
    logger.info("Checking if tables exist...")
    
    try:
        # 检查 free_chat_session 表是否存在
        DB.execute_sql("SELECT 1 FROM free_chat_session LIMIT 1")
        logger.info("✓ Table 'free_chat_session' exists")
    except Exception:
        logger.warning("✗ Table 'free_chat_session' does not exist, creating...")
        try:
            FreeChatSession.create_table()
            logger.info("✓ Created table 'free_chat_session'")
        except Exception as e:
            logger.error(f"Failed to create table 'free_chat_session': {e}")
            raise
    
    try:
        # 检查 free_chat_message 表是否存在
        DB.execute_sql("SELECT 1 FROM free_chat_message LIMIT 1")
        logger.info("✓ Table 'free_chat_message' exists")
    except Exception:
        logger.warning("✗ Table 'free_chat_message' does not exist, creating...")
        try:
            FreeChatMessage.create_table()
            logger.info("✓ Created table 'free_chat_message'")
        except Exception as e:
            logger.error(f"Failed to create table 'free_chat_message': {e}")
            raise
    
    logger.info("All required tables are ready!")


def migrate_one_user(user_id: str, sessions_json: list) -> tuple[int, int]:
    """
    迁移单个用户的会话数据

    Args:
        user_id: 用户 ID
        sessions_json: 旧的 sessions JSON 数据

    Returns:
        (migrated_sessions_count, migrated_messages_count)
    """
    sessions_count = 0
    messages_count = 0

    try:
        for session_data in sessions_json:
            session_id = session_data.get('id')
            if not session_id:
                logger.warning(f"[{user_id}] Session without ID, skipping")
                continue

            # 检查会话是否已存在
            exists, _ = FreeChatSessionService.get_by_id(session_id)
            if exists:
                logger.info(f"[{user_id}] Session {session_id} already exists, skipping")
                continue

            # 创建会话
            success, error_msg = FreeChatSessionService.create_session(
                session_id=session_id,
                user_id=user_id,
                name=session_data.get('name', 'Untitled Chat'),
                created_at=session_data.get('created_at', 0),
                conversation_id=session_data.get('conversation_id')
            )

            if not success:
                logger.error(f"[{user_id}] Failed to create session {session_id}: {error_msg}")
                continue

            sessions_count += 1
            logger.info(f"[{user_id}] Created session {session_id}")

            # 迁移消息
            messages = session_data.get('messages', [])
            if messages:
                message_objs = []
                for seq, msg in enumerate(messages):
                    # 获取消息ID，如果不存在或长度不足32，则生成新的
                    msg_id = msg.get('id', '')
                    if not msg_id or len(msg_id) < 32:
                        # 生成新的UUID
                        msg_id = str(uuid.uuid4()).replace('-', '')
                        old_id = msg.get('id', 'none')
                        logger.warning(f"[{user_id}] Invalid message ID '{old_id}' (len={len(old_id) if old_id else 0}), generated new: {msg_id}")
                    
                    message_obj = {
                        'id': msg_id,
                        'session_id': session_id,
                        'role': msg.get('role', 'user'),
                        'content': msg.get('content', ''),
                        'seq': seq,
                        'created_at': msg.get('created_at', 0),
                        'reference': msg.get('reference', [])
                    }
                    message_objs.append(message_obj)

                if message_objs:
                    # 批量创建消息，如果遇到重复则逐条创建（跳过重复）
                    success, error_msg = FreeChatMessageService.batch_create_messages(message_objs)
                    if success:
                        messages_count += len(message_objs)
                        logger.info(f"[{user_id}] Created {len(message_objs)} messages for session {session_id}")
                    else:
                        # 批量创建失败（可能是重复ID），改为逐条创建
                        if "Duplicate entry" in error_msg:
                            logger.warning(f"[{user_id}] Batch insert failed due to duplicate IDs, trying one-by-one...")
                            success_count = 0
                            for msg_obj in message_objs:
                                try:
                                    # 检查是否已存在
                                    exists, _ = FreeChatMessageService.get_by_id(msg_obj['id'])
                                    if exists:
                                        # ID已存在，生成新ID
                                        old_id = msg_obj['id']
                                        msg_obj['id'] = str(uuid.uuid4()).replace('-', '')
                                        logger.warning(f"[{user_id}] Message ID conflict: {old_id} -> {msg_obj['id']}")
                                    
                                    success, err = FreeChatMessageService.create_message(**msg_obj)
                                    if success:
                                        success_count += 1
                                    else:
                                        logger.error(f"[{user_id}] Failed to create message {msg_obj['id']}: {err}")
                                except Exception as e:
                                    logger.error(f"[{user_id}] Exception creating message: {e}")
                            
                            messages_count += success_count
                            logger.info(f"[{user_id}] Created {success_count}/{len(message_objs)} messages for session {session_id}")
                        else:
                            logger.error(f"[{user_id}] Failed to create messages for session {session_id}: {error_msg}")

    except Exception as e:
        logger.error(f"[{user_id}] Error migrating user data: {e}")

    return sessions_count, messages_count


def migrate_all():
    """
    迁移所有用户的会话数据
    """
    logger.info("=" * 60)
    logger.info("Starting FreeChat data migration")
    logger.info("=" * 60)
    
    # 首先确保表存在
    ensure_tables_exist()
    logger.info("")

    total_users = 0
    total_sessions = 0
    total_messages = 0
    failed_users = []

    try:
        # 查询所有有 sessions 数据的用户
        all_settings = FreeChatUserSettings.select()

        for setting in all_settings:
            user_id = setting.user_id
            sessions_json = setting.sessions

            if not sessions_json or len(sessions_json) == 0:
                logger.info(f"[{user_id}] No sessions to migrate, skipping")
                continue

            total_users += 1
            logger.info(f"\n[{user_id}] Migrating {len(sessions_json)} sessions...")

            try:
                sessions_count, messages_count = migrate_one_user(user_id, sessions_json)
                total_sessions += sessions_count
                total_messages += messages_count

                logger.info(f"[{user_id}] ✅ Successfully migrated {sessions_count} sessions, {messages_count} messages")

            except Exception as e:
                logger.error(f"[{user_id}] ❌ Failed to migrate: {e}")
                failed_users.append(user_id)

    except Exception as e:
        logger.error(f"Fatal error during migration: {e}")
        return False

    # 打印总结
    logger.info("\n" + "=" * 60)
    logger.info("Migration Summary")
    logger.info("=" * 60)
    logger.info(f"Total users processed: {total_users}")
    logger.info(f"Total sessions migrated: {total_sessions}")
    logger.info(f"Total messages migrated: {total_messages}")

    if failed_users:
        logger.warning(f"Failed users ({len(failed_users)}): {', '.join(failed_users)}")
    else:
        logger.info("✅ All users migrated successfully!")

    return len(failed_users) == 0


def verify_migration():
    """
    验证迁移结果
    """
    logger.info("\n" + "=" * 60)
    logger.info("Verifying migration...")
    logger.info("=" * 60)

    try:
        old_data_count = 0
        new_sessions_count = FreeChatSession.select().count()
        new_messages_count = FreeChatMessage.select().count()

        # 统计旧数据量
        all_settings = FreeChatUserSettings.select()
        for setting in all_settings:
            sessions = setting.sessions or []
            old_data_count += len(sessions)

        logger.info(f"Old sessions in JSON: {old_data_count}")
        logger.info(f"New sessions in table: {new_sessions_count}")
        logger.info(f"New messages in table: {new_messages_count}")

        if new_sessions_count >= old_data_count:
            logger.info("✅ Migration verification passed!")
            return True
        else:
            logger.warning("⚠️  New data count is less than old data, please check!")
            return False

    except Exception as e:
        logger.error(f"Error during verification: {e}")
        return False


if __name__ == "__main__":
    import argparse

    parser = argparse.ArgumentParser(description="Migrate FreeChat data from JSON to SQL tables")
    parser.add_argument("--verify-only", action="store_true", help="Only verify migration, don't migrate")
    args = parser.parse_args()

    if args.verify_only:
        verify_migration()
    else:
        success = migrate_all()
        if success:
            verify_migration()
            logger.info("\n✅ Migration completed successfully!")
        else:
            logger.error("\n❌ Migration completed with errors!")
            sys.exit(1)
