#!/usr/bin/env python3
"""
Data Migration Script: Move messages from sessions to conversation table

Purpose:
    Migrate existing free_chat_user_settings.sessions data to new architecture:
    - Extract messages from sessions and write to conversation.message
    - Strip messages from sessions (keep only metadata)
    - Add message_count field to sessions

Principles:
    1. Idempotent: Can be run multiple times safely
    2. Non-destructive: Preserves conversation.message if already exists
    3. Logged: Detailed logging for audit trail

Usage:
    # Dry run (no changes):
    python 004_migrate_sessions_messages.py --dry-run
    
    # Production run:
    python 004_migrate_sessions_messages.py
    
    # Verify migration:
    python 004_migrate_sessions_messages.py --verify

Created: 2025-01-08
"""

import sys
import os
import logging
import argparse
from typing import Tuple

# Add parent directory to path for imports
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), '../../..')))

from api.db.db_models import FreeChatUserSettings, Conversation, DB
from api.db.services.free_chat_user_settings_service import FreeChatUserSettingsService
from api.db.services.conversation_service import ConversationService

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s [%(levelname)s] %(message)s',
    handlers=[
        logging.FileHandler('migration_004.log'),
        logging.StreamHandler()
    ]
)
logger = logging.getLogger(__name__)


def migrate_sessions_to_conversations(dry_run: bool = False) -> Tuple[int, int, int]:
    """
    Main migration function.
    
    Args:
        dry_run: If True, only log what would be done (no DB changes)
    
    Returns:
        (migrated_count, skipped_count, error_count)
    """
    logger.info("=" * 80)
    logger.info(f"Starting migration (dry_run={dry_run})...")
    logger.info("=" * 80)
    
    migrated_count = 0
    skipped_count = 0
    error_count = 0
    
    try:
        # Get all user settings with @DB.connection_context()
        with DB.connection_context():
            all_settings = FreeChatUserSettings.select()
            total_users = all_settings.count()
            logger.info(f"Found {total_users} users with free_chat_user_settings")
            
            for idx, setting in enumerate(all_settings, 1):
                logger.info(f"\n[{idx}/{total_users}] Processing user: {setting.user_id}")
                
                try:
                    sessions = setting.sessions or []
                    if not sessions:
                        logger.info(f"  No sessions for user {setting.user_id}, skipping")
                        skipped_count += 1
                        continue
                    
                    updated_sessions = []
                    session_migrated = False
                    
                    for session in sessions:
                        session_id = session.get("id")
                        conversation_id = session.get("conversation_id")
                        messages = session.get("messages", [])
                        
                        logger.info(f"  Session {session_id}: conversation_id={conversation_id}, messages={len(messages)}")
                        
                        # Migrate messages to conversation if exists
                        if conversation_id and messages:
                            e, conv = ConversationService.get_by_id(conversation_id)
                            
                            if e:
                                existing_messages = conv.message or []
                                
                                if not existing_messages:
                                    # Conversation exists but empty - migrate messages
                                    if not dry_run:
                                        conv.message = messages
                                        conv.save()
                                    logger.info(f"    ✅ Migrated {len(messages)} messages to {conversation_id}")
                                    session_migrated = True
                                else:
                                    # Conversation already has messages - skip (assume already migrated)
                                    logger.info(f"    ⏭️  Skipped {conversation_id} (already has {len(existing_messages)} messages)")
                            else:
                                logger.warning(f"    ⚠️  Conversation {conversation_id} not found for session {session_id}")
                        elif not conversation_id:
                            logger.info(f"    ⏭️  Session {session_id} has no conversation_id (new session)")
                        elif not messages:
                            logger.info(f"    ⏭️  Session {session_id} has no messages")
                        
                        # Create stripped session (metadata only)
                        stripped_session = {
                            "id": session.get("id"),
                            "name": session.get("name"),
                            "conversation_id": conversation_id,
                            "model_card_id": session.get("model_card_id"),
                            "created_at": session.get("created_at"),
                            "updated_at": session.get("updated_at"),
                            "params": session.get("params"),
                            "message_count": len(messages)  # Add message count
                        }
                        
                        # Log if messages were stripped
                        if "messages" in session:
                            logger.info(f"    🗑️  Stripped {len(messages)} messages from session metadata")
                        
                        updated_sessions.append(stripped_session)
                    
                    # Save updated sessions (without messages)
                    if not dry_run:
                        setting.sessions = updated_sessions
                        setting.save()
                    
                    if session_migrated:
                        migrated_count += 1
                        logger.info(f"  ✅ Successfully migrated user {setting.user_id}")
                    else:
                        skipped_count += 1
                        logger.info(f"  ⏭️  Skipped user {setting.user_id} (no migration needed)")
                    
                except Exception as e:
                    error_count += 1
                    logger.error(f"  ❌ Failed to migrate user {setting.user_id}: {e}", exc_info=True)
    
    except Exception as e:
        logger.error(f"Migration failed with error: {e}", exc_info=True)
        raise
    
    logger.info("\n" + "=" * 80)
    logger.info("Migration Summary:")
    logger.info(f"  Total users:     {total_users}")
    logger.info(f"  Migrated:        {migrated_count}")
    logger.info(f"  Skipped:         {skipped_count}")
    logger.info(f"  Errors:          {error_count}")
    logger.info(f"  Dry run:         {dry_run}")
    logger.info("=" * 80)
    
    return migrated_count, skipped_count, error_count


def verify_migration() -> bool:
    """
    Verify migration completed successfully.
    
    Checks:
        1. No sessions contain 'messages' field
        2. All conversations with session references have messages
    
    Returns:
        True if verification passed, False otherwise
    """
    logger.info("=" * 80)
    logger.info("Verifying migration...")
    logger.info("=" * 80)
    
    issues_found = 0
    
    try:
        with DB.connection_context():
            all_settings = FreeChatUserSettings.select()
            
            for setting in all_settings:
                sessions = setting.sessions or []
                
                for session in sessions:
                    session_id = session.get("id")
                    
                    # Check 1: Sessions should NOT contain 'messages' field
                    if "messages" in session:
                        logger.error(f"❌ User {setting.user_id} session {session_id} still has 'messages' field!")
                        issues_found += 1
                    
                    # Check 2: If conversation_id exists, conversation should have messages
                    conversation_id = session.get("conversation_id")
                    if conversation_id:
                        e, conv = ConversationService.get_by_id(conversation_id)
                        if not e:
                            logger.error(f"❌ Conversation {conversation_id} not found!")
                            issues_found += 1
                        elif not conv.message or len(conv.message) == 0:
                            logger.warning(f"⚠️  Conversation {conversation_id} has no messages (might be new session)")
                    
                    # Check 3: message_count should match actual count
                    if conversation_id:
                        e, conv = ConversationService.get_by_id(conversation_id)
                        if e and conv.message:
                            actual_count = len(conv.message)
                            reported_count = session.get("message_count", 0)
                            if actual_count != reported_count:
                                logger.warning(f"⚠️  Message count mismatch: session reports {reported_count}, actual is {actual_count}")
    
    except Exception as e:
        logger.error(f"Verification failed with error: {e}", exc_info=True)
        return False
    
    if issues_found == 0:
        logger.info("✅ Verification PASSED - Migration completed successfully!")
        return True
    else:
        logger.error(f"❌ Verification FAILED - Found {issues_found} issues")
        return False


def main():
    parser = argparse.ArgumentParser(
        description="Migrate FreeChat sessions data to new architecture"
    )
    parser.add_argument(
        '--dry-run',
        action='store_true',
        help="Dry run mode - log actions without making changes"
    )
    parser.add_argument(
        '--verify',
        action='store_true',
        help="Verify migration (check data integrity)"
    )
    
    args = parser.parse_args()
    
    if args.verify:
        # Verification mode
        success = verify_migration()
        sys.exit(0 if success else 1)
    else:
        # Migration mode
        migrated, skipped, errors = migrate_sessions_to_conversations(dry_run=args.dry_run)
        
        if errors > 0:
            logger.error(f"Migration completed with {errors} errors")
            sys.exit(1)
        else:
            logger.info("Migration completed successfully!")
            if not args.dry_run:
                logger.info("Run with --verify flag to verify data integrity")
            sys.exit(0)


if __name__ == "__main__":
    main()
